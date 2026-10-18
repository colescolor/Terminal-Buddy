import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,USER,OTHER} from './fixture.mjs'
test('bounded reconciliation continues after a failed customer and fairly rotates retries without removing access',async()=>{
 const f=await fixture();try{
  await f.login();await f.api.checkout(USER,{acceptRecurring:true})
  await f.db.query('UPDATE accounts SET billing=$2 WHERE id=$1',[USER,JSON.stringify({customerId:'cus_failure',paidThrough:f.now()+100000,syncedAt:1})])
  await f.db.query('INSERT INTO accounts(id,email,billing) VALUES($1,$2,$3)',[OTHER,'fixture@example.invalid',JSON.stringify({customerId:'cus_success',syncedAt:2})])
  f.stripe.snapshot=async customer=>{if(customer==='cus_failure')throw Error('outage');return {status:'active',paidThrough:f.now()+200000}}
  assert.deepEqual(await f.api.reconcile({limit:1}),{accounts:1,failed:1})
  const failed=(await f.db.query('SELECT billing FROM accounts WHERE id=$1',[USER])).rows[0].billing
  assert.equal(failed.paidThrough,f.now()+100000);assert.equal(failed.syncedAt,1)
  assert.deepEqual(await f.api.reconcile({limit:1}),{accounts:1,failed:0})
  assert.equal((await f.db.query('SELECT billing FROM accounts WHERE id=$1',[OTHER])).rows[0].billing.paidThrough,f.now()+200000)
  await assert.rejects(f.api.reconcile({limit:999}),e=>e.status===400)
 }finally{await f.db.close()}
})
