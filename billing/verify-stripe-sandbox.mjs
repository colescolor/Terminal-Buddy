// Opt-in provider integration test. Creates ONLY new fictional sandbox customers.
// Does not simulate a completed hosted Checkout or a user-operated portal session.
import Stripe from 'stripe'
import {Pool} from 'pg'
import {PGlite} from '@electric-sql/pglite'
import {randomUUID,generateKeyPairSync} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {stripeGateway} from './stripe.mjs'
import {service} from './service.mjs'
import {migrate} from './db.mjs'
import {databaseConnection} from './connection.mjs'
const env=process.env,run=randomUUID(),report={run,startedAt:new Date().toISOString(),mode:'test',checks:[],limitations:['Purchases use Stripe test PaymentMethods through API, not completed hosted Checkout.','Portal session creation/configuration is checked; user-operated portal cancellation is separate.','Desktop email login and authenticator enrollment require the owner.']}
let pool,db,stripe,clock,subscription,failedSubscription
const save=async()=>{await mkdir('.local',{recursive:true});await writeFile('.local/stripe-lifecycle-'+run+'.json',JSON.stringify(report,null,2))}
const pass=name=>{report.checks.push(name);console.log('PASS: '+name)}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
try{
 if(!process.argv.includes('--run-test')||!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')||env.BILLING_ORIGIN!=='https://terminal-buddy-billing-test.netlify.app')throw Error('Explicit test environment required')
 stripe=new Stripe(env.STRIPE_SECRET_KEY,{maxNetworkRetries:2,timeout:15000})
 const gateway=stripeGateway(env);await gateway.validatePrice()
 pool=new Pool({...databaseConnection(env),max:1,connectionTimeoutMillis:10000,statement_timeout:15000})
 db=new PGlite();await migrate(db)
 let now=Date.now()
 clock=await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(now/1000),name:'Terminal Buddy QA '+run})
 assert.equal(clock.livemode,false);report.clock=clock.id
 const accountId=randomUUID(),email='sandbox-'+run+'@example.invalid'
 const customer=await stripe.customers.create({name:'Terminal Buddy automated sandbox QA',email,test_clock:clock.id,metadata:{terminal_buddy_qa:run}})
 report.customer=customer.id;report.accountId=accountId
 const billing={customerId:customer.id,qaRun:run}
 await pool.query('INSERT INTO accounts(id,email,billing) VALUES($1,$2,$3)',[accountId,email,JSON.stringify(billing)])
 await db.query('INSERT INTO accounts(id,email,billing) VALUES($1,$2,$3)',[accountId,email,JSON.stringify(billing)])
 const api=service({db,stripe:gateway,verifyUser:async()=>null,privateKey:generateKeyPairSync('ed25519').privateKey,origin:env.BILLING_ORIGIN,now:()=>now})
 const trial=await api.startTrial(accountId)
 assert.equal(trial.state,'trial');assert.equal((await api.startTrial(accountId)).trialEndsAt,trial.trialEndsAt)
 assert.equal((await stripe.subscriptions.list({customer:customer.id})).data.length,0)
 pass('Idempotent 14-day backend trial creates no Stripe subscription or charge')
 now=trial.trialEndsAt+1;assert.equal((await api.status(accountId)).state,'expired');now=clock.frozen_time*1000
 pass('No-card trial expires without a charge')
 const checkout=await api.checkout(accountId,{acceptRecurring:true}),again=await api.checkout(accountId,{acceptRecurring:true})
 assert.equal(checkout.url,again.url);assert.ok(checkout.url.startsWith('https://checkout.stripe.com/'))
 report.checkoutCreated=true;pass('Real hosted Checkout session creation and repeat-click reuse')
 const checkoutId=(await db.query('SELECT billing FROM accounts WHERE id=$1',[accountId])).rows[0].billing.checkoutId
 await stripe.checkout.sessions.expire(checkoutId)
 const method=await stripe.paymentMethods.attach('pm_card_visa',{customer:customer.id})
 await stripe.customers.update(customer.id,{invoice_settings:{default_payment_method:method.id}})
 subscription=await stripe.subscriptions.create({customer:customer.id,items:[{price:env.STRIPE_MONTHLY_PRICE_ID}],payment_behavior:'error_if_incomplete',metadata:{terminal_buddy_qa:run}},{idempotencyKey:'buddy-qa-'+run})
 assert.equal(subscription.livemode,false);assert.equal(subscription.status,'active');report.subscription=subscription.id
 let paid=await api.status(accountId);assert.equal(paid.state,'paid');const firstPaid=paid.accessUntil
 pass('Real Stripe TEST paid invoice grants access through its invoice period')
 const duplicate=await api.checkout(accountId,{acceptRecurring:true});assert.equal(duplicate.confirming,true)
 assert.equal((await stripe.subscriptions.list({customer:customer.id,status:'active'})).data.length,1)
 pass('Existing subscription prevents a second Checkout purchase')
 const portal=await api.portal(accountId);assert.ok(portal.url.startsWith('https://billing.stripe.com/'))
 const portalConfig=await stripe.billingPortal.configurations.retrieve(env.STRIPE_PORTAL_CONFIGURATION_ID)
 assert.equal(portalConfig.features.subscription_cancel.mode,'at_period_end');assert.equal(portalConfig.features.subscription_update.enabled,false)
 pass('Real test portal created; cancellation is at period end and plan switching disabled')
 // Observe real Stripe-originated HTTP delivery. No locally signed payload is sent.
 for(let n=0;n<30;n++){
  const stored=(await pool.query('SELECT billing FROM accounts WHERE id=$1',[accountId])).rows[0].billing
  if(stored.paidThrough===firstPaid){report.webhookPaidThrough=stored.paidThrough;break}
  if(n===29)throw Error('Actual hosted webhook did not update paid access')
  await wait(2000)
 }
 pass('Actual Stripe webhook delivery updated the isolated hosted test account')
 const advance=async seconds=>{
  await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time:seconds})
  for(let n=0;n<60;n++){const c=await stripe.testHelpers.testClocks.retrieve(clock.id);if(c.status==='ready'){now=seconds*1000;return}await wait(2000)}
  throw Error('Clock did not become ready')
 }
 await advance(Math.floor(firstPaid/1000)+7200)
 // Renewal invoices can need another clock advance for asynchronous finalization.
 let renewed=await gateway.snapshot(customer.id)
 if(renewed.paidThrough<=firstPaid){await advance(Math.floor(now/1000)+7200);renewed=await gateway.snapshot(customer.id)}
 assert.ok(renewed.paidThrough>firstPaid);assert.equal((await api.status(accountId)).state,'paid')
 pass('Test-clock renewal produces another paid invoice and extends access')
 subscription=await stripe.subscriptions.update(subscription.id,{cancel_at_period_end:true})
 paid=await api.status(accountId);assert.equal(paid.state,'cancelling');assert.equal(paid.accessUntil,renewed.paidThrough)
 pass('Scheduled cancellation preserves the full paid-through period')
 await advance(Math.floor(renewed.paidThrough/1000)+1)
 assert.equal((await stripe.subscriptions.retrieve(subscription.id)).status,'canceled')
 assert.equal((await api.status(accountId)).state,'expired')
 pass('Cancellation completes at period end; backend access expires')
 const failedCustomer=await stripe.customers.create({name:'Terminal Buddy decline QA',test_clock:clock.id,metadata:{terminal_buddy_qa:run}})
 const declined=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:failedCustomer.id})
 failedSubscription=await stripe.subscriptions.create({customer:failedCustomer.id,items:[{price:env.STRIPE_MONTHLY_PRICE_ID}],default_payment_method:declined.id,payment_behavior:'allow_incomplete',metadata:{terminal_buddy_qa:run}})
 const failure=await gateway.snapshot(failedCustomer.id);assert.equal(failure.paidThrough,0);assert.equal(failure.status,'incomplete')
 pass('Actual declined TEST payment grants no paid access')
 await stripe.subscriptions.cancel(failedSubscription.id);failedSubscription=null
 const events=await pool.query('SELECT id,event_type FROM processed_events ORDER BY processed_at DESC LIMIT 100')
 let verified=0;for(const row of events.rows){const event=await stripe.events.retrieve(row.id);if(event.data.object.customer===customer.id){assert.equal(event.livemode,false);assert.equal(event.type,row.event_type);verified++}}
 assert.ok(verified>0);report.verifiedStripeEvents=verified;pass('Processed webhook IDs verified directly against Stripe TEST events')
 report.completed=true
}catch(error){report.completed=false;report.failure=error instanceof assert.AssertionError?error.message:(error.type||error.code||'Provider integration step failed');console.error('FAIL: '+report.failure);process.exitCode=1}
finally{
 // Only subscriptions created by this invocation are stopped. Keep evidence/clock records.
 if(stripe&&subscription?.id)try{const s=await stripe.subscriptions.retrieve(subscription.id);if(s.status!=='canceled')await stripe.subscriptions.cancel(s.id)}catch{report.cleanupPending=true}
 if(stripe&&failedSubscription?.id)try{await stripe.subscriptions.cancel(failedSubscription.id)}catch{report.cleanupPending=true}
 report.finishedAt=new Date().toISOString();await save();if(pool)await pool.end();if(db)await db.close();console.log('Evidence: billing/.local/stripe-lifecycle-'+run+'.json')
}
