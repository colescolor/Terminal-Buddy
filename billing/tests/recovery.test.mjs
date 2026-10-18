import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,USER,OTHER} from './fixture.mjs'
import {recoveryService} from '../recovery.mjs'
import {handler} from '../http.mjs'
const OWNER='33333333-3333-4333-8333-333333333333'
async function setup(){
 const f=await fixture()
 const verifyUser=async token=>token==='requester'?{id:USER,email:'new@example.invalid',email_confirmed_at:'yes',aal:'aal2'}:token==='other'?{id:OTHER,email:'other@example.invalid',email_confirmed_at:'yes',aal:'aal2'}:token==='owner'?{id:OWNER,email:'owner@example.invalid',email_confirmed_at:'yes',aal:'aal2'}:token==='unverified'?{id:USER,email:'new@example.invalid'}:null
 return {...f,recovery:recoveryService({db:f.db,verifyUser,owners:new Set([OWNER]),now:f.now})}
}
const body={originalEmail:'lost@example.invalid',reason:'I lost this inbox.'}
test('recovery requires verified contact, does not reveal account existence, and never grants access or changes billing',async()=>{
 const f=await setup();try{
  await assert.rejects(f.recovery.request('',body),e=>e.status===401)
  await assert.rejects(f.recovery.request('unverified',body),e=>e.status===401)
  const a=await f.recovery.request('requester',body)
  assert.equal(a.request.status,'open');assert.equal(a.request.contactEmail,'new@example.invalid')
  assert.equal((await f.db.query('SELECT count(*)::int n FROM accounts')).rows[0].n,0)
  assert.equal((await f.db.query('SELECT count(*)::int n FROM desktop_sessions')).rows[0].n,0)
  assert.equal(f.calls.customers,0);assert.equal(f.calls.checkouts,0)
  await assert.rejects(f.recovery.request('requester',{...body,accountId:OTHER}),e=>e.status===400)
 }finally{await f.db.close()}
})
test('recovery retries are idempotent, requesters cannot read other cases, and only configured owners may reply',async()=>{
 const f=await setup();try{
  const [a,b]=await Promise.all([f.recovery.request('requester',body),f.recovery.request('requester',body)])
  assert.equal(a.request.id,b.request.id)
  assert.equal((await f.recovery.mine('other',{})).requests.length,0)
  await assert.rejects(f.recovery.mine('other',{id:a.request.id}),e=>e.status===400)
  await assert.rejects(f.recovery.list('requester',{}),e=>e.status===403)
  const review={id:a.request.id,revision:0,status:'review',reply:'Please keep checking this private page.'}
  await assert.rejects(f.recovery.review('requester',review),e=>e.status===403)
  await f.recovery.review('owner',review)
  assert.equal((await f.recovery.mine('requester',{})).requests[0].reply,review.reply)
  await assert.rejects(f.recovery.review('owner',review),e=>e.status===409)
  assert.equal((await f.recovery.list('owner',{})).requests.length,1)
  await f.recovery.review('owner',{...review,revision:1,status:'closed'})
  assert.equal((await f.recovery.list('owner',{})).requests.length,0)
  assert.equal((await f.recovery.list('owner',{closed:true})).requests.length,1)
 }finally{await f.db.close()}
})
test('recovery bounds input and daily submissions; browser table access remains denied',async()=>{
 const f=await setup();try{
  await assert.rejects(f.recovery.request('requester',{...body,reason:'x'.repeat(1001)}),e=>e.status===400)
  for(let i=0;i<3;i++){
   const {request}=await f.recovery.request('requester',body)
   await f.recovery.review('owner',{id:request.id,revision:0,status:'closed',reply:'Closed without changing account access.'})
  }
  await assert.rejects(f.recovery.request('requester',body),e=>e.status===429)
  f.advance(86400001);assert.equal((await f.recovery.request('requester',body)).request.status,'open')
  const http=handler(f.api,{origin:'https://billing.example.invalid'},null,f.recovery)
  for(const value of ['null','[]','"text"'])assert.equal((await http(new Request('https://billing.example.invalid/api/recovery/request',{method:'POST',body:value}))).status,400)
  assert.equal((await http(new Request('https://billing.example.invalid/api/recovery/request',{method:'POST',body:'x'.repeat(8193)}))).status,413)
  assert.equal((await http(new Request('https://billing.example.invalid/api/device/start',{method:'POST',body:'x'.repeat(4097)}))).status,413)
 }finally{await f.db.close()}
})
