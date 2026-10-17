import test from 'node:test'
import assert from 'node:assert/strict'
import {stripeGateway} from '../stripe.mjs'
const listing=items=>({async *[Symbol.asyncIterator](){yield* items}})
test('Stripe adapter validates the fixed price, sends no trial, and reads paid periods across pages',async()=>{
 let price={active:true,livemode:false,currency:'usd',unit_amount:600,recurring:{interval:'month',interval_count:1}},captured
 const stripe={
  prices:{retrieve:async id=>{assert.equal(id,'price_approved');return price}},
  checkout:{sessions:{create:async(body,options)=>{captured={body,options};return {id:'cs_test'}}}},
  subscriptions:{list:()=>listing([{id:'sub_correct',status:'active',livemode:false,items:{data:[{price:{id:'price_approved'}}]}}])},
  invoices:{list:()=>listing([
   {id:'in_wrong',livemode:false,currency:'usd',amount_paid:600,parent:{subscription_details:{subscription:'sub_other'}},lines:{data:[{amount:600,pricing:{price_details:{price:'price_approved'}},period:{end:9999999999}}]}},
   {id:'in_paid',livemode:false,currency:'usd',amount_paid:600,parent:{subscription_details:{subscription:'sub_correct'}},lines:{has_more:true,data:[]}}
  ]),listLineItems:()=>listing([{amount:600,pricing:{price_details:{price:'price_approved'}},period:{end:1800000000}}])}
 }
 const api=stripeGateway({STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_MONTHLY_PRICE_ID:'price_approved'},stripe)
 await api.checkout({id:'account'},{customerId:'cus_server'},'https://billing.example.invalid')
 assert.deepEqual(captured.body.line_items,[{price:'price_approved',quantity:1}])
 assert.equal(captured.body.customer,'cus_server');assert.equal(captured.body.mode,'subscription')
 assert.equal(captured.body.subscription_data.trial_period_days,undefined)
 assert.equal(captured.options.idempotencyKey,'buddy-checkout-account-0')
 assert.equal((await api.snapshot('cus_server')).paidThrough,1800000000000)
 for(const patch of [{unit_amount:700},{currency:'eur'},{livemode:true},{active:false},{recurring:{interval:'year',interval_count:1}}]){
  const old=price;price={...old,...patch};await assert.rejects(api.checkout({id:'account'},{customerId:'cus_server'},'https://billing.example.invalid'),/Price must/);price=old
 }
})
