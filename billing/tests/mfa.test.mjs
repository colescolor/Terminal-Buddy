import test from 'node:test'
import assert from 'node:assert/strict'
import {authorizeOwner,ownerService} from '../admin.mjs'
import {verifiedIdentity} from '../verified-identity.mjs'
import {recoveryService} from '../recovery.mjs'
const id='11111111-1111-4111-8111-111111111111',owners=new Set([id])
test('owner directory and recovery require AAL2; enrollment gate exposes no records',async()=>{
 const user={id,email_confirmed_at:'yes',aal:'aal1'}
 const verifyUser=async()=>user
 const db={query(){throw Error('Database must not be read before MFA')}}
 assert.deepEqual(await ownerService({db,verifyUser,owners}).access('jwt'),{mfaRequired:true})
 await assert.rejects(ownerService({db,verifyUser,owners}).overview('jwt'),e=>e.status===403)
 const recovery=recoveryService({db,verifyUser,owners})
 await assert.rejects(recovery.list('jwt',{}),e=>e.status===403)
 await assert.rejects(recovery.review('jwt',{}),e=>e.status===403)
 user.aal='aal2';assert.equal((await authorizeOwner(verifyUser,owners,'jwt')).id,id)
 user.id='22222222-2222-4222-8222-222222222222'
 await assert.rejects(authorizeOwner(verifyUser,owners,'jwt',false),e=>e.status===403)
})
test('MFA comes from provider-verified claims matching the verified user',async()=>{
 const user={id,aal:'aal2',user_metadata:{aal:'aal2'},email_confirmed_at:'yes'}
 const auth={getUser:async()=>({data:{user}}),getClaims:async()=>({data:{claims:{sub:id,aal:'aal1'}}})}
 assert.equal((await verifiedIdentity(auth,'jwt')).aal,'aal1')
 auth.getClaims=async()=>({data:{claims:{sub:'other',aal:'aal2'}}})
 await assert.rejects(verifiedIdentity(auth,'jwt'),e=>e.status===401)
 auth.getClaims=async()=>({error:Error('signature')})
 await assert.rejects(verifiedIdentity(auth,'jwt'),e=>e.status===401)
})
