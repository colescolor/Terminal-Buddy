export const DAY=86400000
export const offer=Object.freeze({currency:'usd',amount:600,interval:'month',trialDays:14})
export function accessFor(account,now,graceDays=3) {
 const b=account.billing||{}, paid=Number(b.paidThrough||0), trial=Number(account.trial_ends_at||0)
 if(paid>now)return {state:b.cancelAtPeriodEnd||b.status==='canceled'?'cancelling':'paid',accessUntil:paid}
 if(b.status==='past_due'&&paid>0&&now<paid+graceDays*DAY)return {state:'past_due',accessUntil:paid+graceDays*DAY}
 if(trial>now)return {state:'trial',accessUntil:trial}
 if(b.status==='incomplete'||b.confirming)return {state:'confirming',accessUntil:0}
 return {state:account.trial_started_at?'expired':'eligible',accessUntil:0}
}
