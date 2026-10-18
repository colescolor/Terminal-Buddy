import test from 'node:test'
import assert from 'node:assert/strict'
import {billingMode} from '../mode.mjs'
import {stripeGateway} from '../stripe.mjs'
import {fixture,USER} from './fixture.mjs'
import {service} from '../service.mjs'
const approved={liveApproved:true,billingOrigin:'https://billing.example.com',supabaseOrigin:'https://project.supabase.co',stripeAccountId:'acct_approved'}
const env={BILLING_MODE:'live',STRIPE_SECRET_KEY:'rk_live_fixture',BILLING_ORIGIN:approved.billingOrigin,SUPABASE_URL:approved.supabaseOrigin,STRIPE_MONTHLY_PRICE_ID:'price_approved'}
test('live mode requires reviewed source configuration, matching origins and matching secret type',()=>{
 assert.equal(billingMode({STRIPE_SECRET_KEY:'sk_test_fixture'}).live,false)
 assert.throws(()=>billingMode(env),/approved/)
 assert.throws(()=>billingMode({...env,STRIPE_SECRET_KEY:'sk_test_fixture'},approved),/mode/)
 assert.throws(()=>billingMode({...env,BILLING_ORIGIN:'https://other.example.com'},approved),/origin/)
 assert.throws(()=>billingMode({...env,SUPABASE_URL:'https://other.supabase.co'},approved),/origin/)
 assert.equal(billingMode(env,approved).issuer,'terminal-buddy')
 assert.throws(()=>billingMode({...env,BILLING_MODE:'typo'},approved),/test or live/)
})
test('mock live gateway refuses a different Stripe account before creating any customer; validates live price',async()=>{
 let accountId='acct_other',creates=0,live=true
 const stripe={accounts:{retrieve:async()=>({id:accountId,charges_enabled:true})},customers:{create:async()=>{creates++;return {id:'cus_fixture'}}},prices:{retrieve:async()=>({livemode:live,active:true,currency:'usd',unit_amount:600,recurring:{interval:'month',interval_count:1}})}}
 const api=stripeGateway(env,stripe,approved)
 await assert.rejects(api.customer({id:USER,email:'sample@example.invalid'}),/approved Stripe account/);assert.equal(creates,0)
 accountId='acct_approved';await api.validatePrice();live=false;await assert.rejects(api.validatePrice(),/Price must/)
})
test('mock live service rejects signed sandbox events and issues production-only entitlements',async()=>{
 const f=await fixture()
 try{
  await f.login();const api=service({...f.options,live:true})
  const e=f.signed('invoice.paid','evt_wrong_environment')
  await assert.rejects(api.webhook(e.raw,e.signature),/environment/)
  const status=await api.startTrial(USER)
  assert.equal(JSON.parse(Buffer.from(status.entitlement.payload,'base64url')).issuer,'terminal-buddy')
  assert.equal((await f.db.query('SELECT count(*) AS total FROM processed_events')).rows[0].total,0)
 }finally{await f.db.close()}
})
