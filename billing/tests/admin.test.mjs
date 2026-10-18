import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,USER,OTHER} from './fixture.mjs'
import {ownerService,ownerIds} from '../admin.mjs'
import {handler} from '../http.mjs'
import {seedOwnerPreview} from '../owner-fixtures.mjs'
import {accessFor} from '../policy.mjs'
test('owner data requires a verified allowlisted provider ID, not email or desktop tokens',async()=>{
 const f=await fixture();try{
  const owner=ownerService({db:f.db,verifyUser:async token=>token==='owner'?{id:USER,email:'owner@example.invalid',email_confirmed_at:'2026-10-17',aal:'aal2'}:token==='impostor'?{id:OTHER,email:'owner@example.invalid',email_confirmed_at:'2026-10-17',aal:'aal2'}:token==='unverified'?{id:USER,email:'owner@example.invalid'}:null,owners:ownerIds(USER)})
  const http=handler(f.api,{origin:'https://billing.example.invalid'},owner)
  const request=(token,body={},origin='https://billing.example.invalid')=>http(new Request('https://billing.example.invalid/api/admin/overview',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin},body:JSON.stringify(body)}))
  assert.equal((await request('owner')).status,200)
  assert.equal((await request('impostor')).status,403)
  assert.equal((await request('unverified')).status,401)
  assert.equal((await request('unknown')).status,401)
  const desktop=await f.login();assert.equal((await request(desktop.token)).status,401)
  assert.equal((await request('owner',{},'https://evil.example.invalid')).status,403)
  assert.equal((await request('owner',{owner:true})).status,400)
  assert.equal((await request('owner',{page:-1})).status,400)
  assert.equal((await request('owner',{state:'all'})).status,400)
  assert.throws(()=>ownerIds('not-a-user-id'))
  await assert.rejects(()=>ownerService({...f.options}).overview('owner'),e=>e.status===503)
 }finally{await f.db.close()}
})
test('owner overview is read-only, paginated, filtered and matches access policy across states',async()=>{
 const f=await fixture();try{
  await seedOwnerPreview(f.db,f.now())
  const owner=ownerService({...f.options,owners:new Set([USER])})
  const before=(await f.db.query('SELECT * FROM accounts ORDER BY id')).rows
  const all=await owner.overview('verified-fixture')
  assert.equal(all.total,7);assert.equal(all.accounts.length,7)
  for(const account of before){assert.equal(all.accounts.find(a=>a.id===account.id).state,accessFor(account,f.now()).state)}
  assert.equal(all.totals.trial,1);assert.equal(all.totals.paid,1);assert.equal(all.totals.cancelling,1);assert.equal(all.totals.past_due,1)
  const paid=await owner.overview('verified-fixture',{state:'paid'});assert.equal(paid.matched,1);assert.equal(paid.total,7)
  assert.match(paid.accounts[0].stripeUrl,/^https:\/\/dashboard\.stripe\.com\/test\/customers\/cus_/)
  assert.equal((await owner.overview('verified-fixture',{search:'ALEX'})).matched,1)
  assert.equal((await owner.overview('verified-fixture',{search:'%'})).matched,0)
  assert.equal((await owner.overview('verified-fixture',{search:"' OR true; --"})).matched,0)
  assert.deepEqual((await f.db.query('SELECT * FROM accounts ORDER BY id')).rows,before)
  assert.equal(f.calls.snapshot,0);assert.equal(f.calls.checkouts,0)
  assert.doesNotMatch(JSON.stringify(all),/token_hash|state_hash|checkoutId|entitlement|verifier/)
  for(let n=0;n<52;n++)await f.db.query('INSERT INTO accounts(id,email) VALUES($1,$2)',['44444444-4444-4444-8444-'+String(n).padStart(12,'0'),'test'+n+'@example.invalid'])
  const first=await owner.overview('verified-fixture'),second=await owner.overview('verified-fixture',{page:1})
  assert.equal(first.accounts.length,50);assert.equal(second.accounts.length,9)
  assert.equal(new Set([...first.accounts,...second.accounts].map(a=>a.id)).size,59)
 }finally{await f.db.close()}
})
