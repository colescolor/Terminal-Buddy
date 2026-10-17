// Imported only by the loopback preview. Never by deployed API/functions/browser entry points.
import {DAY} from './policy.mjs'
export async function seedOwnerPreview(db,now=Date.now()){
 const examples=[
  ['alex','trial',{},now-4*DAY],['blair','paid',{status:'active',paidThrough:now+24*DAY},now-20*DAY],
  ['casey','expired',{},now-20*DAY],['devon','cancelling',{status:'active',cancelAtPeriodEnd:true,paidThrough:now+9*DAY},now-30*DAY],
  ['ellis','past_due',{status:'past_due',paidThrough:now-DAY},now-40*DAY],['frankie','confirming',{status:'incomplete'},now-20*DAY],
  ['gray','eligible',{},null]
 ]
 for(const [index,[name,state,billing,trial]] of examples.entries()){
  if(Object.keys(billing).length){billing.customerId='cus_local'+name;billing.syncedAt=now-3600000}
  await db.query('INSERT INTO accounts(id,email,trial_started_at,trial_ends_at,billing) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',
   ['33333333-3333-4333-8333-'+String(index+1).padStart(12,'0'),name+'@example.invalid',trial,trial?trial+14*DAY:null,JSON.stringify(billing)])
 }
}
