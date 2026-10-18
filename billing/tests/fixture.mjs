import {PGlite} from '@electric-sql/pglite'
import {generateKeyPairSync,createHash,randomBytes} from 'node:crypto'
import Stripe from 'stripe'
import {migrate} from '../db.mjs'
import {service} from '../service.mjs'
export const USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222'
export async function fixture(directory){
 const db=new PGlite(directory);await migrate(db)
 const keys=generateKeyPairSync('ed25519')
 const sdk=new Stripe('sk_test_local_fixture_only')
 let now=Date.UTC(2026,9,17,12)
 const calls={customers:0,checkouts:0,portals:[],snapshot:0}
 const snapshot={status:'canceled',hasSubscription:false,paidThrough:0,cancelAtPeriodEnd:false,knownSubscriptionIds:[]}
 const sessions=new Map()
 const stripe={
  async customer(){calls.customers++;return {id:'cus_fixture'}},
  async snapshot(){calls.snapshot++;return {...snapshot}},
  async checkout(a,b){calls.checkouts++;const c={id:'cs_fixture_'+(b.checkoutSequence||0),customer:b.customerId,livemode:false,url:'https://checkout.stripe.com/c/pay/test_fixture',status:'open'};sessions.set(c.id,c);return c},
  async checkoutStatus(id){return sessions.get(id)},
  async portal(id){calls.portals.push(id);return {url:'https://billing.stripe.com/p/session/test_fixture'}},
  verifyEvent:(raw,signature)=>sdk.webhooks.constructEvent(raw,signature,'whsec_local_fixture_only')
 }
 const options={db,stripe,privateKey:keys.privateKey,origin:'http://127.0.0.1:4318',now:()=>now,
  verifyUser:async jwt=>jwt==='verified-fixture'?{id:USER,email:'demo@example.invalid',email_confirmed_at:'2026-10-17',aal:'aal2'}:null}
 const api=service(options)
 const signed=(type,id='evt_fixture')=>{const raw=JSON.stringify({id,type,livemode:false,data:{object:{customer:'cus_fixture'}}});return {raw,signature:sdk.webhooks.generateTestHeaderString({payload:raw,secret:'whsec_local_fixture_only'})}}
 const login=async()=>{
  const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url')
  const flow=await api.deviceStart({challenge:createHash('sha256').update(verifier).digest('base64url'),state})
  await api.deviceApprove('verified-fixture',{id:flow.id,state})
  const credentials=await api.deviceExchange({id:flow.id,state,verifier})
  return {...credentials,id:flow.id,state,verifier}
 }
 return {db,api,options,stripe,calls,snapshot,sessions,keys,signed,login,now:()=>now,advance:ms=>now+=ms}
}
