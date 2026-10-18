import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomBytes} from 'node:crypto'
import {fixture,USER,OTHER} from './fixture.mjs'
import {service} from '../service.mjs'
import {handler} from '../http.mjs'
import {DAY,accessFor} from '../policy.mjs'
import {stripeGateway} from '../stripe.mjs'
test('verified one-use device exchange; transactional trial survives a second installation and service restart',async()=>{
 const f=await fixture()
 try{
  const login=await f.login();assert.equal(await f.api.authenticate(login.token),USER)
  await assert.rejects(f.api.deviceExchange(login),/Invalid or expired/)
  const statuses=await Promise.all([f.api.startTrial(USER),f.api.startTrial(USER)])
  assert.equal(statuses[0].trialEndsAt,f.now()+14*DAY);assert.equal(statuses[0].trialEndsAt,statuses[1].trialEndsAt)
  f.advance(DAY);await f.login()
  const restarted=service(f.options)
  assert.equal((await restarted.startTrial(USER)).trialEndsAt,statuses[0].trialEndsAt)
  f.advance(15*DAY);assert.equal((await f.api.status(USER)).state,'expired')
  assert.equal(f.calls.customers,0);assert.equal(f.calls.checkouts,0)
 }finally{await f.db.close()}
})
test('unverified email, wrong state/verifier, expired handoff, and cross-account request fields fail',async()=>{
 const f=await fixture()
 try{
  const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url')
  const flow=await f.api.deviceStart({challenge:createHash('sha256').update(verifier).digest('base64url'),state})
  assert.deepEqual(await f.api.deviceCheck({id:flow.id,state}),{available:true})
  assert.deepEqual(await f.api.deviceCheck({id:flow.id,state:verifier}),{available:false})
  assert.deepEqual(await f.api.deviceCheck({id:'invalid',state}),{available:false})
  await assert.rejects(f.api.deviceApprove('bad',{id:flow.id,state}),/Verify your email/)
  await assert.rejects(f.api.deviceApprove('verified-fixture',{id:flow.id,state:'wrong'}),/expired/)
  await f.api.deviceApprove('verified-fixture',{id:flow.id,state})
  assert.deepEqual(await f.api.deviceCheck({id:flow.id,state}),{available:false})
  await assert.rejects(f.api.deviceExchange({id:flow.id,state,verifier:state}),/Invalid/)
  f.advance(301000);await assert.rejects(f.api.deviceExchange({id:flow.id,state,verifier}),/expired/)
  assert.deepEqual(await f.api.deviceCheck({id:flow.id,state}),{available:false})
  const login=await f.login()
  const h=handler(f.api,{origin:'http://127.0.0.1:4318'})
  const r=await h(new Request('http://127.0.0.1:4318/api/checkout',{method:'POST',headers:{Authorization:'Bearer '+login.token},body:JSON.stringify({acceptRecurring:true,customerId:'cus_other',priceId:'price_other',accountId:OTHER})}))
  assert.equal(r.status,400);assert.equal(f.calls.checkouts,0)
  assert.equal((await h(new Request('http://127.0.0.1:4318/api/status',{method:'POST'}))).status,401)
  assert.equal((await h(new Request('http://127.0.0.1:4318/api/status',{method:'POST',headers:{origin:'https://evil.invalid'}}))).status,403)
 }finally{await f.db.close()}
})
test('explicit purchase, duplicate clicks, delayed payment, renewal, grace and scheduled cancellation',async()=>{
 const f=await fixture()
 try{
  await f.login();await f.api.startTrial(USER)
  await assert.rejects(f.api.checkout(USER,{}),/Confirm USD/)
  const sessions=await Promise.all([f.api.checkout(USER,{acceptRecurring:true}),f.api.checkout(USER,{acceptRecurring:true})])
  assert.equal(sessions[0].url,sessions[1].url);assert.equal(f.calls.checkouts,1)
  f.snapshot.hasSubscription=true;f.snapshot.status='incomplete'
  assert.equal((await f.api.checkout(USER,{acceptRecurring:true})).confirming,true)
  f.advance(15*DAY);assert.equal((await f.api.status(USER)).state,'confirming')
  Object.assign(f.snapshot,{status:'active',paidThrough:f.now()+30*DAY})
  let e=f.signed('invoice.paid','evt_paid');await f.api.webhook(e.raw,e.signature)
  assert.equal((await f.api.status(USER)).state,'paid')
  f.snapshot.paidThrough+=30*DAY;e=f.signed('invoice.paid','evt_renew');await f.api.webhook(e.raw,e.signature)
  assert.equal((await f.api.status(USER)).accessUntil,f.snapshot.paidThrough)
  f.snapshot.cancelAtPeriodEnd=true;assert.equal((await f.api.status(USER)).state,'cancelling')
  f.advance(61*DAY);f.snapshot.status='past_due';f.snapshot.cancelAtPeriodEnd=false
  assert.equal((await f.api.status(USER)).state,'past_due')
  f.advance(3*DAY);assert.equal((await f.api.status(USER)).state,'expired')
  await f.api.portal(USER);assert.deepEqual(f.calls.portals,['cus_fixture'])
  const session=await f.login();await f.api.signOut(session.token);await assert.rejects(f.api.authenticate(session.token),/Sign in/)
  assert.equal((await f.db.query('SELECT trial_started_at FROM accounts WHERE id=$1',[USER])).rows.length,1)
 }finally{await f.db.close()}
})
test('webhook verification, duplicate and out-of-order events reconcile current truth; failures retry',async()=>{
 const f=await fixture()
 try{
  await f.login();await f.api.checkout(USER,{acceptRecurring:true})
  let e=f.signed('invoice.payment_failed','evt_old')
  await assert.rejects(f.api.webhook(e.raw,'invalid'),/signature/)
  await assert.rejects(f.api.webhook(e.raw+' ',e.signature),/signature/)
  Object.assign(f.snapshot,{status:'active',hasSubscription:true,paidThrough:f.now()+30*DAY})
  await f.api.webhook(e.raw,e.signature)
  assert.equal((await f.api.status(USER)).state,'paid')
  assert.equal((await f.api.webhook(e.raw,e.signature)).duplicate,true)
  const old=f.stripe.snapshot;f.stripe.snapshot=async()=>{throw Error('network')}
  e=f.signed('invoice.paid','evt_retry');await assert.rejects(f.api.webhook(e.raw,e.signature))
  assert.equal((await f.db.query('SELECT * FROM processed_events WHERE id=$1',['evt_retry'])).rows.length,0)
  f.stripe.snapshot=old;await f.api.webhook(e.raw,e.signature)
  f.snapshot.paidThrough+=30*DAY;await f.api.reconcile()
  assert.equal((await f.api.status(USER)).accessUntil,f.snapshot.paidThrough)
 }finally{await f.db.close()}
})
test('failed checkout safely retries; mismatched customer is refused; live configuration is refused',async()=>{
 const f=await fixture()
 try{
  await f.login();const original=f.stripe.checkout
  f.stripe.checkout=async()=>{throw Error('provider timeout')}
  await assert.rejects(f.api.checkout(USER,{acceptRecurring:true}))
  f.stripe.checkout=async(...args)=>({...await original(...args),customer:'cus_other'})
  await assert.rejects(f.api.checkout(USER,{acceptRecurring:true}),/mismatch/)
  f.stripe.checkout=original;assert.ok((await f.api.checkout(USER,{acceptRecurring:true})).url)
  assert.throws(()=>stripeGateway({STRIPE_SECRET_KEY:'sk_live_forbidden'}),/TEST/)
  assert.equal(accessFor({trial_started_at:1,trial_ends_at:2,billing:{}},3).state,'expired')
 }finally{await f.db.close()}
})

test('verified browser can revoke only its own desktop logins, without resetting the trial',async()=>{
 const f=await fixture();try{
  const first=await f.login(),second=await f.login();const trial=await f.api.startTrial(USER)
  const otherToken=randomBytes(32).toString('base64url')
  await f.db.query('INSERT INTO accounts(id,email) VALUES($1,$2)',[OTHER,'other@example.invalid'])
  await f.db.query('INSERT INTO desktop_sessions(token_hash,account_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[createHash('sha256').update(otherToken).digest('base64url'),OTHER,f.now(),f.now()+DAY])
  await assert.rejects(f.api.revokeDevices('unverified'),e=>e.status===401)
  assert.equal(await f.api.authenticate(first.token),USER)
  await f.api.revokeDevices('verified-fixture')
  await assert.rejects(f.api.authenticate(first.token),e=>e.status===401)
  await assert.rejects(f.api.authenticate(second.token),e=>e.status===401)
  assert.equal(await f.api.authenticate(otherToken),OTHER)
  await f.login();assert.equal((await f.api.startTrial(USER)).trialEndsAt,trial.trialEndsAt)
 }finally{await f.db.close()}
})
