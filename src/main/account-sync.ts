import type {AccountView} from '@shared/account'

// One scheduler for all windows. No provider calls from renderer polling.
export class AccountSync {
 private lastAttempt = -Infinity
 private pending: Promise<void> | null = null
 private stopped = false
 constructor(private account: {view(): AccountView; refresh(): Promise<AccountView>},
  private publish: (value: AccountView) => void, private now = Date.now) {}
 async check(reason: 'startup' | 'focus' | 'timer' = 'timer'): Promise<void> {
  if(this.stopped)return
  if(this.pending)return this.pending
  const current=this.account.view()
  if(!current.configured||['free','signed-out'].includes(current.state))return
  const interval=current.billingPending?5000:reason==='focus'?15000:300000
  if(this.now()-this.lastAttempt<interval)return
  this.lastAttempt=this.now()
  const run=async()=>{
   try {const value=await this.account.refresh();if(!this.stopped)this.publish(value)}
   catch {/* The service retains bounded verified access during outages. */}
  }
  this.pending=run()
  try {await this.pending} finally {this.pending=null}
 }
 stop(): void {this.stopped=true}
}
