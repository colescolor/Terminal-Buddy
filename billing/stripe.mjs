import Stripe from 'stripe'
import { offer } from './policy.mjs'
import {billingMode} from './mode.mjs'
export function stripeGateway(env, injectedClient, approvedRelease) {
 const mode=billingMode(env,approvedRelease)
 const stripe=injectedClient||new Stripe(env.STRIPE_SECRET_KEY,{maxNetworkRetries:2,timeout:12000})
 let verifiedAccount=false
 const account=async()=>{if(mode.live&&!verifiedAccount){const value=await stripe.accounts.retrieve();if(value.id!==mode.accountId||!value.charges_enabled)throw Error('The approved Stripe account is not ready to accept payments.');verifiedAccount=true}}
 const priceId=env.STRIPE_MONTHLY_PRICE_ID
 if(!/^price_/.test(priceId||''))throw Error('Configure the approved test monthly Price ID.')
 const validatePrice=async()=>{
  await account()
  const p=await stripe.prices.retrieve(priceId)
  if(p.livemode!==mode.live||!p.active||p.currency!==offer.currency||p.unit_amount!==offer.amount||p.recurring?.interval!=='month'||p.recurring?.interval_count!==1)throw Error('Price must be active '+mode.name+' USD 6.00/month, every one month.')
 }
 return {
  validatePrice,
  async customer(user){await account();return stripe.customers.create({email:user.email,metadata:{account_id:user.id}},{idempotencyKey:'buddy-customer-'+user.id})},
  async snapshot(customerId){
   await account()
   const subscriptions={data:[]},invoices={data:[]}
   for await(const s of stripe.subscriptions.list({customer:customerId,status:'all',limit:100}))subscriptions.data.push(s)
   for await(const i of stripe.invoices.list({customer:customerId,status:'paid',limit:100}))invoices.data.push(i)
   if(subscriptions.data.some(s=>s.livemode!==mode.live)||invoices.data.some(i=>i.livemode!==mode.live))throw Error('Stripe data does not match billing mode.')
   const relevant=subscriptions.data.filter(s=>s.items.data.some(i=>i.price.id===priceId))
   const active=relevant.find(s=>!['canceled','incomplete_expired'].includes(s.status))
   const blockers=subscriptions.data.filter(s=>!['canceled','incomplete_expired'].includes(s.status))
   let paidThrough=0
   const paidSubscriptionIds=new Set()
   for(const invoice of invoices.data){
    const subscription=invoice.parent?.subscription_details?.subscription||invoice.subscription
    const id=typeof subscription==='string'?subscription:subscription?.id
    if(invoice.currency!=='usd'||invoice.amount_paid<=0||!relevant.some(s=>s.id===id))continue
    const lines=[]
    if(invoice.lines.has_more){for await(const line of stripe.invoices.listLineItems(invoice.id,{limit:100}))lines.push(line)}
    else lines.push(...invoice.lines.data)
    for(const line of lines){
     const price=line.pricing?.price_details?.price||line.price?.id
     if(price===priceId&&line.amount>0){paidThrough=Math.max(paidThrough,line.period.end*1000);paidSubscriptionIds.add(id)}
    }
   }
   return {status:active?.status||'canceled',subscriptionId:active?.id||null,
    // The hosted portal can set cancel_at to the period end while leaving
    // cancel_at_period_end false (observed with API 2026-09-30.endive).
    cancelAtPeriodEnd:!!active?.cancel_at_period_end||Number(active?.cancel_at)>0,paidThrough,
    duplicate:blockers.length>1,
    hasSubscription:blockers.length>0,knownSubscriptionIds:relevant.map(s=>s.id),paidSubscriptionIds:[...paidSubscriptionIds]}
  },
  async checkoutStatus(id){await account();const value=await stripe.checkout.sessions.retrieve(id);if(value.livemode!==mode.live)throw Error('Checkout mode mismatch.');return value},
  async checkout(account,billing,origin){
   await validatePrice()
   return stripe.checkout.sessions.create({mode:'subscription',customer:billing.customerId,
    // Keep the approved direct-merchant Checkout flow even if a new Stripe
    // account defaults to the separate Managed Payments service.
    managed_payments:{enabled:false},
    line_items:[{price:priceId,quantity:1}],
    client_reference_id:account.id,subscription_data:{metadata:{account_id:account.id}},
    success_url:origin+'/account/?checkout=return',cancel_url:origin+'/account/?checkout=cancel'},
    {idempotencyKey:'buddy-checkout-v3-'+account.id+'-'+(billing.checkoutSequence||0)})
  },
  async portal(customer){await account();return stripe.billingPortal.sessions.create({customer,return_url:env.BILLING_ORIGIN+'/account/',
   ...(env.STRIPE_PORTAL_CONFIGURATION_ID?{configuration:env.STRIPE_PORTAL_CONFIGURATION_ID}:{})})},
  verifyEvent:(raw,signature)=>stripe.webhooks.constructEvent(raw,signature,env.STRIPE_WEBHOOK_SECRET),
 }
}
