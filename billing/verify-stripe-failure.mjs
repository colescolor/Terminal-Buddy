// Real provider TEST renewal failure; never a live charge or real customer.
import Stripe from 'stripe'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {writeFile,mkdir} from 'node:fs/promises'
import {stripeGateway} from './stripe.mjs'
import {accessFor,DAY} from './policy.mjs'
const env=process.env,run=randomUUID(),report={run,checks:[],mode:'test'}
let stripe,subscription
try{
 if(!process.argv.includes('--run-test')||!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Explicit TEST invocation required')
 stripe=new Stripe(env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:2});const gateway=stripeGateway(env);await gateway.validatePrice()
 const clock=await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:'Terminal Buddy failed renewal QA '+run})
 report.clock=clock.id
 const customer=await stripe.customers.create({name:'Terminal Buddy failed renewal QA',test_clock:clock.id,metadata:{terminal_buddy_qa:run}})
 const good=await stripe.paymentMethods.attach('pm_card_visa',{customer:customer.id})
 subscription=await stripe.subscriptions.create({customer:customer.id,items:[{price:env.STRIPE_MONTHLY_PRICE_ID}],default_payment_method:good.id,payment_behavior:'error_if_incomplete'})
 report.subscription=subscription.id
 const paid=await gateway.snapshot(customer.id);assert.ok(paid.paidThrough>0)
 const bad=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:customer.id})
 await stripe.subscriptions.update(subscription.id,{default_payment_method:bad.id})
 const advance=async frozen_time=>{
  await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time})
  for(let n=0;n<60;n++){if((await stripe.testHelpers.testClocks.retrieve(clock.id)).status==='ready')return;await new Promise(r=>setTimeout(r,2000))}throw Error('Clock timeout')
 }
 await advance(Math.floor(paid.paidThrough/1000)+7200)
 let failure=await gateway.snapshot(customer.id)
 if(failure.status==='active'){await advance(Math.floor(paid.paidThrough/1000)+14400);failure=await gateway.snapshot(customer.id)}
 assert.equal(failure.status,'past_due');assert.equal(failure.paidThrough,paid.paidThrough)
 const account={trial_started_at:1,trial_ends_at:1+14*DAY,billing:failure}
 assert.equal(accessFor(account,paid.paidThrough+DAY,3).state,'past_due')
 assert.equal(accessFor(account,paid.paidThrough+3*DAY,3).state,'expired')
 report.checks.push('Actual Stripe renewal decline leaves paid-through unchanged','Backend grants proposed three-day grace and expires exactly at its boundary')
 report.completed=true;console.log('PASS real TEST renewal failure, unchanged paid-through, bounded three-day policy grace and expiry.')
}catch(e){report.completed=false;report.failure=e instanceof assert.AssertionError?e.message:(e.type||e.code||'Provider test failed');console.error('FAIL: '+report.failure);process.exitCode=1}
finally{
 if(stripe&&subscription?.id)try{await stripe.subscriptions.cancel(subscription.id)}catch{report.cleanupPending=true}
 report.checkedAt=new Date().toISOString();await mkdir('.local',{recursive:true});await writeFile('.local/stripe-failure-'+run+'.json',JSON.stringify(report,null,2));console.log('Evidence: billing/.local/stripe-failure-'+run+'.json')
}
