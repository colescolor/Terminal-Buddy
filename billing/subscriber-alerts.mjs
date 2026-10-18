import {createHash} from 'node:crypto'
import {lockedAccount,saveBilling} from './db.mjs'

const email=/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/
export function notificationIssues(env){
 const names=['RESEND_API_KEY','SUBSCRIBER_ALERT_FROM','SUBSCRIBER_ALERT_TO']
 if(!names.some(n=>env[n]))return []
 const issues=names.filter(n=>!env[n]?.trim()).map(n=>n+': missing for subscriber alerts')
 for(const n of names.slice(1))if(env[n]&&!email.test(env[n]))issues.push(n+': use one plain email address')
 if(env.RESEND_API_KEY&&!/^re_[A-Za-z0-9_]+$/.test(env.RESEND_API_KEY))issues.push('RESEND_API_KEY: invalid format')
 return issues
}
export function resendAlerts(env,fetcher=fetch,live=false){
 if(notificationIssues(env).length||!env.RESEND_API_KEY)return null
 return {
  message(account,subscriptionId){return {
   from:env.SUBSCRIBER_ALERT_FROM,to:[env.SUBSCRIBER_ALERT_TO],
   subject:(live?'':'[TEST] ')+'New Terminal Buddy subscriber',
   text:[live?'A Terminal Buddy subscription has its first confirmed payment.':'A Terminal Buddy subscription has its first confirmed test payment.',
    'Subscriber: '+account.email,'Plan: USD $6/month',...(live?[]:['No real money was charged.']),
    'Stripe: https://dashboard.stripe.com/'+(live?'':'test/')+'subscriptions/'+subscriptionId].join('\n\n')
  }},
  async send(body,key){
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify(body),signal:AbortSignal.timeout(8000)})
   if(!response.ok)throw Error('Subscriber email provider unavailable.')
   const result=await response.json()
   if(typeof result.id!=='string')throw Error('Subscriber email acceptance not confirmed.')
   return result.id
  }
 }
}

// A durable outbox inside the existing server-only billing record. No email on
// trial activation, Checkout creation, or renewal; one entry per paid subscription.
export function queueSubscriberAlerts(account,paidSubscriptionIds,at){
 const alerts=account.billing.subscriberAlerts??={}
 for(const id of paidSubscriptionIds||[])if(/^sub_[A-Za-z0-9_]+$/.test(id)&&!alerts[id])alerts[id]={state:'pending',queuedAt:at}
}
export function subscriberAlerts({db,delivery,now=Date.now}){
 async function flushAccount(id){
  if(!delivery)return {disabled:true}
  const job=await lockedAccount(db,id,async(a,tx)=>{
   for(const [subscriptionId,item] of Object.entries(a.billing.subscriberAlerts||{})){
    if(item.state!=='pending'||(item.leaseUntil||0)>now())continue
    // Resend keeps keys for 24h. Stop ambiguous retries before that expires;
    // automatic delivery must never become an unbounded duplicate email loop.
    if(item.firstAttemptAt&&now()-item.firstAttemptAt>=23*3600000){
     item.state='review';await saveBilling(tx,id,a.billing);continue
    }
    item.firstAttemptAt??=now();item.leaseUntil=now()+300000
    item.message??=delivery.message(a,subscriptionId)
    await saveBilling(tx,id,a.billing)
    return {subscriptionId,message:item.message,key:'buddy-test-subscriber-'+createHash('sha256').update(subscriptionId).digest('hex')}
   }
  })
  if(!job)return {idle:true}
  let providerId
  try{providerId=await delivery.send(job.message,job.key)}catch{
   await lockedAccount(db,id,async(a,tx)=>{const item=a.billing.subscriberAlerts[job.subscriptionId];item.leaseUntil=0;await saveBilling(tx,id,a.billing)})
   return {retry:true}
  }
  await lockedAccount(db,id,async(a,tx)=>{
   const item=a.billing.subscriberAlerts[job.subscriptionId]
   item.state='sent';item.sentAt=now();item.providerId=providerId;delete item.message;delete item.leaseUntil
   await saveBilling(tx,id,a.billing)
  })
  return {sent:true}
 }
 return {flushAccount,async flushPending(limit=5){
  if(!delivery)return {disabled:true}
  const rows=await db.query("SELECT id FROM accounts WHERE EXISTS (SELECT 1 FROM jsonb_each(COALESCE(billing->'subscriberAlerts','{}'::jsonb)) AS a WHERE a.value->>'state'='pending') ORDER BY id LIMIT $1",[limit])
  const result={sent:0,retry:0}
  for(const row of rows.rows){const r=await flushAccount(row.id);if(r.sent)result.sent++;if(r.retry)result.retry++}
  return result
 }}
}
