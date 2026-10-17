import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fixture,USER} from './fixture.mjs'
test('trial persists after the actual local database closes and reopens',async()=>{
 const root=await mkdtemp(join(tmpdir(),'buddy-billing-persistence-'))
 let f=await fixture(root)
 await f.login();const original=await f.api.startTrial(USER);await f.db.close()
 f=await fixture(root)
 try{f.advance(2*86400000);await f.login();assert.equal((await f.api.startTrial(USER)).trialEndsAt,original.trialEndsAt)}
 finally{await f.db.close()}
})
test('HTTP status cannot use a different account; portal requires server customer mapping',async()=>{
 const f=await fixture()
 try{await f.login();await assert.rejects(f.api.portal(USER),/No billing account/);await assert.rejects(f.api.status('22222222-2222-4222-8222-222222222222'),/Sign in/)}
 finally{await f.db.close()}
})
