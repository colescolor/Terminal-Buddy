import {randomUUID} from 'node:crypto'
import {authorizeOwner} from './admin.mjs'
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})}
const address=/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/
const object=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>keys.includes(k))
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max
const view=row=>({id:row.id,originalEmail:row.original_email,contactEmail:row.requester_email,reason:row.reason,status:row.status,reply:row.reply,revision:row.revision,createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)})
export function recoveryService({db,verifyUser,owners,now=Date.now}){
 const verified=async token=>{
  if(typeof token!=='string'||token.length>8192)fail('Verify your contact email first.',401)
  let user;try{user=await verifyUser(token)}catch{fail('Verify your contact email first.',401)}
  if(!user?.email_confirmed_at||!user.email)fail('Verify your contact email first.',401)
  return user
 }
 return {
  async request(token,body){
   const user=await verified(token)
   if(!object(body,['originalEmail','reason'])||!text(body.originalEmail,254)||!address.test(body.originalEmail.trim())||!text(body.reason,1000))fail('Enter the original email and a short explanation (up to 1,000 characters).')
   // Never look up the claimed original account or reveal whether it exists.
   return db.transaction(async tx=>{
    const existing=await tx.query("SELECT * FROM recovery_requests WHERE requester_id=$1 AND status<>'closed'",[user.id])
    if(existing.rows[0])return {request:view(existing.rows[0])}
    const count=await tx.query('SELECT count(*)::int AS n FROM recovery_requests WHERE requester_id=$1 AND created_at>$2',[user.id,now()-86400000])
    if(count.rows[0].n>=3)fail('Please wait before opening another recovery request.',429)
    const at=now()
    await tx.query("INSERT INTO recovery_requests(id,requester_id,requester_email,original_email,reason,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(requester_id) WHERE status<>'closed' DO NOTHING",[randomUUID(),user.id,user.email,body.originalEmail.trim().toLowerCase(),body.reason.trim(),at])
    const r=await tx.query("SELECT * FROM recovery_requests WHERE requester_id=$1 AND status<>'closed'",[user.id])
    return {request:view(r.rows[0])}
   })
  },
  async mine(token,body){
   const user=await verified(token);if(!object(body,[]))fail('Unexpected fields.')
   const r=await db.query('SELECT * FROM recovery_requests WHERE requester_id=$1 ORDER BY created_at DESC LIMIT 10',[user.id])
   return {requests:r.rows.map(view)}
  },
  async list(token,body){
   await authorizeOwner(verifyUser,owners,token)
   if(!object(body,['closed'])||(body.closed!==undefined&&typeof body.closed!=='boolean'))fail('Invalid filter.')
   const r=await db.query("SELECT * FROM recovery_requests WHERE ($1 OR status<>'closed') ORDER BY created_at DESC LIMIT 50",[body.closed===true])
   return {requests:r.rows.map(view)}
  },
  async review(token,body){
   const owner=await authorizeOwner(verifyUser,owners,token)
   if(!object(body,['id','revision','status','reply'])||!/^[0-9a-f-]{36}$/i.test(body.id||'')||!Number.isInteger(body.revision)||!['review','closed'].includes(body.status)||!text(body.reply,1000))fail('Provide a review status and a private reply (up to 1,000 characters).')
   const r=await db.query('UPDATE recovery_requests SET status=$2,reply=$3,revision=revision+1,updated_at=$4,reviewed_by=$5 WHERE id=$1 AND revision=$6 RETURNING *',[body.id,body.status,body.reply.trim(),now(),owner.id,body.revision])
   if(!r.rows[0])fail('This request changed. Refresh before saving.',409)
   // Deliberately no account/email/role/billing changes. Review is not restoration.
   return {request:view(r.rows[0])}
  }
 }
}
