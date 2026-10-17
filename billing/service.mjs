import {createHash,randomBytes,randomUUID,sign} from 'node:crypto'
import {lockedAccount,saveBilling} from './db.mjs'
import {accessFor,DAY} from './policy.mjs'
const hash=value=>createHash('sha256').update(value).digest('base64url')
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})}
const idOf=v=>typeof v==='string'?v:v?.id
export function service({db,stripe,verifyUser,privateKey,origin,now=Date.now,offlineDays=7,graceDays=3}) {
 if(!Number.isInteger(offlineDays)||offlineDays<0||offlineDays>7||!Number.isInteger(graceDays)||graceDays<0||graceDays>7)throw Error('Invalid access policy.')
 const sync=async(account,tx)=>{
  const b=account.billing
  if(b.customerId){const snapshot=await stripe.snapshot(b.customerId);if(snapshot.duplicate)fail('Multiple subscriptions need support review.',409)
   account.billing={...b,...snapshot,syncedAt:now(),confirming:snapshot.status==='incomplete'};await saveBilling(tx,account.id,account.billing)}
  return account
 }
 const status=account=>{
  const verifiedAt=now(),access=accessFor(account,verifiedAt,graceDays)
  const claims={issuer:'terminal-buddy-test',audience:'terminal-buddy-desktop',subject:account.id,
   ...access,verifiedAt,offlineUntil:Math.min(access.accessUntil,verifiedAt+offlineDays*DAY)}
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url')
  return {email:account.email,accountId:account.id,state:access.state,trialEndsAt:Number(account.trial_ends_at||0),
   accessUntil:access.accessUntil,customer:!!account.billing.customerId,
   entitlement:{payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64url')}}
 }
 const authenticate=async token=>{
  if(typeof token!=='string'||token.length<32||token.length>256)fail('Sign in again.',401)
  const r=await db.query('SELECT account_id FROM desktop_sessions WHERE token_hash=$1 AND expires_at>$2',[hash(token),now()])
  if(!r.rows[0])fail('Sign in again.',401)
  return r.rows[0].account_id
 }
 return {
  authenticate,
  async deviceStart({challenge,state}){
   if(!/^[A-Za-z0-9_-]{43}$/.test(challenge||'')||!/^[A-Za-z0-9_-]{43}$/.test(state||''))fail('Invalid sign-in request.')
   await db.query('DELETE FROM device_flows WHERE expires_at<$1',[now()])
   const pending=await db.query('SELECT count(*) AS total FROM device_flows WHERE consumed=false')
   if(Number(pending.rows[0].total)>=1000)fail('Sign-in is busy. Please retry later.',429)
   const id=randomUUID()
   await db.query('INSERT INTO device_flows(id,challenge,state_hash,expires_at) VALUES($1,$2,$3,$4)',[id,challenge,hash(state),now()+300000])
   return {id,url:origin+'/account/?device='+id+'&state='+state,expiresIn:300}
  },
  async deviceApprove(jwt,{id,state}){
   const user=await verifyUser(jwt)
   if(!user?.email_confirmed_at||!user.email)fail('Verify your email first.',401)
   return db.transaction(async tx=>{
    const r=await tx.query('SELECT * FROM device_flows WHERE id=$1 FOR UPDATE',[id])
    const flow=r.rows[0]
    if(!flow||flow.consumed||flow.account_id||Number(flow.expires_at)<=now()||flow.state_hash!==hash(state||''))fail('Sign-in request expired or already used.',409)
    await tx.query('INSERT INTO accounts(id,email) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET email=$2',[user.id,user.email])
    await tx.query('UPDATE device_flows SET account_id=$2 WHERE id=$1',[id,user.id])
    return {approved:true}
   })
  },
  async deviceExchange({id,verifier,state}){
   if(!/^[A-Za-z0-9_-]{43}$/.test(verifier||''))fail('Invalid exchange.')
   return db.transaction(async tx=>{
    const r=await tx.query('SELECT * FROM device_flows WHERE id=$1 FOR UPDATE',[id]),f=r.rows[0]
    if(!f||f.consumed||Number(f.expires_at)<=now()||f.challenge!==hash(verifier)||f.state_hash!==hash(state||''))fail('Invalid or expired exchange.',401)
    if(!f.account_id)return {pending:true}
    const token=randomBytes(32).toString('base64url')
    await tx.query('UPDATE device_flows SET consumed=true WHERE id=$1',[id])
    await tx.query('INSERT INTO desktop_sessions(token_hash,account_id,created_at,expires_at) VALUES($1,$2,$3,$4)',[hash(token),f.account_id,now(),now()+30*DAY])
    return {token,accountId:f.account_id}
   })
  },
  async status(id){return lockedAccount(db,id,async(a,tx)=>status(await sync(a,tx)))},
  async startTrial(id){return lockedAccount(db,id,async(a,tx)=>{
   if(!a.trial_started_at){const started=now();await tx.query('UPDATE accounts SET trial_started_at=$2,trial_ends_at=$3 WHERE id=$1',[id,started,started+14*DAY]);a.trial_started_at=started;a.trial_ends_at=started+14*DAY}
   return status(a)
  })},
  async checkout(id,body){
   if(body?.acceptRecurring!==true||Object.keys(body).some(k=>k!=='acceptRecurring'))fail('Confirm USD 6/month, charged today, renewing monthly until canceled.')
   // Commit the customer mapping before Checkout so provider failures cannot orphan a purchase.
   await lockedAccount(db,id,async(a,tx)=>{
    if(!a.billing.customerId){const c=await stripe.customer(a);a.billing.customerId=c.id;await saveBilling(tx,id,a.billing)}
   })
   return lockedAccount(db,id,async(a,tx)=>{
    let b=a.billing
    await sync(a,tx);b=a.billing
    if(b.hasSubscription)return {confirming:true,message:'An existing subscription is being confirmed. Refresh status or manage billing.'}
    if(b.checkoutId){
     const existing=await stripe.checkoutStatus(b.checkoutId)
     if(idOf(existing.customer)!==b.customerId)fail('Checkout account mismatch.',403)
     if(existing.status==='open')return {url:existing.url}
     if(existing.status==='complete'&&!b.knownSubscriptionIds?.includes(idOf(existing.subscription)))return {confirming:true}
     b.checkoutSequence=(b.checkoutSequence||0)+1
    }
    const checkout=await stripe.checkout(a,b,origin)
    if(checkout.livemode||idOf(checkout.customer)!==b.customerId)fail('Checkout account mismatch.',403)
    b.checkoutId=checkout.id;await saveBilling(tx,id,b)
    return {url:checkout.url}
   })
  },
  async portal(id){return lockedAccount(db,id,async(a)=>{
   if(!a.billing.customerId)fail('No billing account yet.',409)
   return {url:(await stripe.portal(a.billing.customerId)).url}
  })},
  async signOut(token){await db.query('DELETE FROM desktop_sessions WHERE token_hash=$1',[hash(token)]);return {ok:true}},
  async webhook(raw,signature){
   let event;try{event=stripe.verifyEvent(raw,signature)}catch{fail('Invalid webhook signature.',400)}
   if(event.livemode!==false)fail('Live events are disabled.',400)
   const supported=/^(customer.subscription.(created|updated|deleted|paused|resumed)|invoice.(paid|payment_failed|payment_action_required)|checkout.session.(completed|async_payment_succeeded|async_payment_failed|expired))$/.test(event.type)
   if(!supported)return {ignored:true}
   const customer=idOf(event.data.object.customer)
   return db.transaction(async tx=>{
    const inserted=await tx.query('INSERT INTO processed_events(id,event_type,processed_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[event.id,event.type,now()])
    if(!inserted.rows.length)return {duplicate:true}
    const rows=await tx.query("SELECT * FROM accounts WHERE billing->>'customerId'=$1 FOR UPDATE",[customer])
    if(rows.rows[0])await sync(rows.rows[0],tx)
    return {received:true}
   })
  },
  async reconcile(){const r=await db.query("SELECT id FROM accounts WHERE billing->>'customerId' IS NOT NULL");for(const row of r.rows)await lockedAccount(db,row.id,sync);return {accounts:r.rows.length}}
 }
}
