import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,USER} from './fixture.mjs'
import {service} from '../service.mjs'
import {subscriberAlerts,resendAlerts,notificationIssues} from '../subscriber-alerts.mjs'

test('first confirmed payment sends once; trials, failed payment, renewal, invalid and duplicate events do not send extra alerts',async()=>{
 const f=await fixture(),sent=[]
 const alerts=subscriberAlerts({db:f.db,now:f.now,delivery:{message:(a,id)=>({email:a.email,id}),send:async(body,key)=>{sent.push({body,key});return 'mail_1'}}})
 const api=service({...f.options,alerts})
 try{
  await f.login();await api.startTrial(USER);await api.checkout(USER,{acceptRecurring:true})
  assert.equal(sent.length,0)
  let e=f.signed('invoice.payment_failed','evt_fail');await api.webhook(e.raw,e.signature)
  assert.equal(sent.length,0)
  Object.assign(f.snapshot,{status:'active',hasSubscription:true,subscriptionId:'sub_first',paidThrough:f.now()+30*86400000,paidSubscriptionIds:['sub_first']})
  e=f.signed('invoice.paid','evt_paid')
  await assert.rejects(api.webhook(e.raw,'invalid'),/signature/);assert.equal(sent.length,0)
  await api.webhook(e.raw,e.signature);await api.webhook(e.raw,e.signature)
  assert.equal(sent.length,1)
  f.snapshot.paidThrough+=30*86400000
  e=f.signed('invoice.paid','evt_renewal');await api.webhook(e.raw,e.signature)
  e=f.signed('customer.subscription.updated','evt_late');await api.webhook(e.raw,e.signature)
  await api.reconcile();assert.equal(sent.length,1)
  f.snapshot.paidSubscriptionIds.push('sub_second')
  e=f.signed('invoice.paid','evt_resubscribe');await api.webhook(e.raw,e.signature)
  assert.equal(sent.length,2);assert.notEqual(sent[0].key,sent[1].key)
 }finally{await f.db.close()}
})

test('delivery outage never blocks paid access; durable retry keeps the same body/key and stops after the provider dedup window',async()=>{
 const f=await fixture(),attempts=[];let fail=true
 const delivery={message:(a,id)=>({email:a.email,id}),send:async(body,key)=>{attempts.push({body,key});if(fail)throw Error('timeout');return 'accepted'}}
 const alerts=subscriberAlerts({db:f.db,delivery,now:f.now}),api=service({...f.options,alerts})
 try{
  await f.login();await api.checkout(USER,{acceptRecurring:true})
  Object.assign(f.snapshot,{status:'active',hasSubscription:true,paidThrough:f.now()+30*86400000,paidSubscriptionIds:['sub_retry']})
  const e=f.signed('invoice.paid');await api.webhook(e.raw,e.signature)
  assert.equal((await api.status(USER)).state,'paid')
  assert.equal(attempts.length,1)
  await f.db.query('UPDATE accounts SET email=$2 WHERE id=$1',[USER,'changed@example.invalid'])
  fail=false
  const restarted=subscriberAlerts({db:f.db,delivery,now:f.now})
  await Promise.all([restarted.flushAccount(USER),restarted.flushAccount(USER)])
  assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1])
  fail=true;f.snapshot.paidSubscriptionIds.push('sub_timeout')
  await api.reconcile();const count=attempts.length
  f.advance(23*3600000);await api.reconcile()
  assert.equal(attempts.length,count)
  assert.equal((await f.db.query('SELECT billing FROM accounts WHERE id=$1',[USER])).rows[0].billing.subscriberAlerts.sub_timeout.state,'review')
 }finally{await f.db.close()}
})

test('missing email configuration keeps a pending alert without breaking billing and can deliver once configured',async()=>{
 const f=await fixture()
 try{
  await f.login();await f.api.checkout(USER,{acceptRecurring:true})
  f.snapshot.paidSubscriptionIds=['sub_pending']
  await f.api.status(USER)
  const disabled=subscriberAlerts({db:f.db,delivery:null,now:f.now})
  assert.deepEqual(await disabled.flushPending(),{disabled:true})
  let sent=0
  const enabled=subscriberAlerts({db:f.db,now:f.now,delivery:{message:()=>({}),send:async()=>{sent++;return 'accepted'}}})
  await enabled.flushPending();await enabled.flushPending();assert.equal(sent,1)
 }finally{await f.db.close()}
})

test('Resend adapter uses server recipient and idempotency, labels sandbox, and redacts provider errors',async()=>{
 const env={RESEND_API_KEY:'re_fixture',SUBSCRIBER_ALERT_FROM:'alerts@example.invalid',SUBSCRIBER_ALERT_TO:'owner@example.invalid'}
 assert.deepEqual(notificationIssues({}),[]);assert.equal(resendAlerts({}),null)
 assert.ok(notificationIssues({...env,SUBSCRIBER_ALERT_TO:'a@example.invalid,b@example.invalid'}).length)
 let captured
 const delivery=resendAlerts(env,async(url,opts)=>{captured={url,opts};return Response.json({id:'mail_1'})})
 const body=delivery.message({email:'customer@example.invalid'},'sub_confirmed')
 assert.match(body.subject,/TEST/);assert.deepEqual(body.to,['owner@example.invalid'])
 await delivery.send(body,'stable-key')
 assert.equal(captured.url,'https://api.resend.com/emails')
 assert.equal(captured.opts.headers['Idempotency-Key'],'stable-key')
 assert.ok(captured.opts.signal)
 const unavailable=resendAlerts(env,async()=>new Response('sensitive-provider-payload',{status:429}))
 await assert.rejects(unavailable.send(body,'stable-key'),e=>e.message==='Subscriber email provider unavailable.')
})
