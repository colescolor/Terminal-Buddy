import {DAY} from './policy.mjs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const states=['eligible','trial','paid','cancelling','past_due','confirming','expired']
const fail=(message,status)=>{throw Object.assign(Error(message),{status})}
export function ownerIds(value='') {
 const ids=value.split(',').map(x=>x.trim()).filter(Boolean)
 if(ids.some(id=>!uuid.test(id)))throw Error('OWNER_USER_IDS must contain Supabase user UUIDs.')
 return new Set(ids.map(id=>id.toLowerCase()))
}
export async function authorizeOwner(verifyUser,owners,token,requireMfa=true){
 if(!owners.size)fail('Owner dashboard is not configured.',503)
 if(typeof token!=='string'||token.length>8192)fail('Sign in to the owner dashboard.',401)
 let user;try{user=await verifyUser(token)}catch{fail('Sign in again.',401)}
 if(!user?.email_confirmed_at)fail('Verify your email first.',401)
 if(!owners.has(user.id?.toLowerCase()))fail('This account does not have owner access.',403)
 if(requireMfa&&user.aal!=='aal2')fail('Verify your authenticator code to access owner records.',403)
 return user
}
export function ownerService({db,verifyUser,owners=new Set(),now=Date.now,graceDays=3,live=false}) {
 return {async access(token){
  const user=await authorizeOwner(verifyUser,owners,token,false)
  return {mfaRequired:user.aal!=='aal2'}
 },async overview(token,body={}) {
  // Authorization is server-side, keyed to immutable provider IDs, never email or browser flags.
  const user=await authorizeOwner(verifyUser,owners,token)
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['search','state','page'].includes(k)))fail('Invalid filter.',400)
  const {search='',state='',page=0}=body
  if(typeof search!=='string'||search.length>120||typeof state!=='string'||(state&&!states.includes(state))||!Number.isInteger(page)||page<0||page>2000)fail('Invalid filter.',400)
  const at=now(), grace=graceDays*DAY
  // Mirrors accessFor, with tests checking every state against the shared policy.
  const cte=`WITH records AS (SELECT id,email,trial_started_at,trial_ends_at,billing,
   COALESCE((billing->>'paidThrough')::bigint,0) AS paid FROM accounts),
   access AS (SELECT *,CASE
    WHEN paid>$1 THEN CASE WHEN billing->>'cancelAtPeriodEnd'='true' OR billing->>'status'='canceled' THEN 'cancelling' ELSE 'paid' END
    WHEN billing->>'status'='past_due' AND paid>0 AND $1<paid+$2 THEN 'past_due'
    WHEN trial_ends_at>$1 THEN 'trial'
    WHEN billing->>'status'='incomplete' OR billing->>'confirming'='true' THEN 'confirming'
    WHEN trial_started_at IS NOT NULL THEN 'expired' ELSE 'eligible' END AS access_state FROM records)`
  const pattern='%'+search.trim().replace(/[\\%_]/g,'\\$&')+'%'
  const where=" WHERE ($3='' OR access_state=$3) AND email ILIKE $4 ESCAPE '\\'"
  return db.transaction(async tx=>{
   // These statements only read billing records. Refresh never mutates subscriptions.
   const summary=await tx.query(cte+' SELECT access_state,count(*)::int AS count FROM access GROUP BY access_state',[at,grace])
   const totals=Object.fromEntries(states.map(s=>[s,0]));for(const row of summary.rows)totals[row.access_state]=row.count
   const matched=await tx.query(cte+' SELECT count(*)::int AS count FROM access'+where,[at,grace,state,pattern])
   const result=await tx.query(cte+' SELECT * FROM access'+where+' ORDER BY id LIMIT 50 OFFSET $5',[at,grace,state,pattern,page*50])
   return {mode:live?'live':'test',asOf:at,ownerEmail:user.email,totals,total:Object.values(totals).reduce((a,b)=>a+b,0),matched:matched.rows[0].count,page,pageSize:50,
    accounts:result.rows.map(a=>({id:a.id,email:a.email,state:a.access_state,
     trialStartedAt:Number(a.trial_started_at||0),trialEndsAt:Number(a.trial_ends_at||0),paidThrough:Number(a.paid),
     subscriptionStatus:a.billing.status||null,lastSyncedAt:Number(a.billing.syncedAt||0),
     stripeUrl:/^cus_[A-Za-z0-9]+$/.test(a.billing.customerId||'')?'https://dashboard.stripe.com/'+(live?'':'test/')+'customers/'+a.billing.customerId:null}))}
  })
 }}
}
