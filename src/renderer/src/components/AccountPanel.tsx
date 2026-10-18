import {useEffect,useState} from 'react'
import type {AccountView} from '@shared/account'
const names:Record<string,string>={free:'Free edition', 'signed-out':'Sign in to Terminal Buddy',eligible:'Your 14-day trial is ready',trial:'Your trial is active',paid:'Subscription active',cancelling:'Cancellation scheduled',past_due:'Payment needs attention',expired:'Your trial or paid access has ended',confirming:'Confirming subscription',unknown:'Unable to verify access'}
export function AccountCard({value,run,busy=false}:{value:AccountView;run:(action:string)=>void;busy?:boolean}):React.JSX.Element {
 const [consent,setConsent]=useState(false)
 const date=(n?:number)=>n?new Date(n).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):''
 return <section className="account-card" aria-labelledby="account-title">
  <div className="account-heading"><span className="account-label">ACCOUNT</span><span className="account-badge">{value.state==='trial'?Math.max(0,Math.ceil(((value.trialEndsAt||0)-Date.now())/86400000))+' days left':value.state==='paid'?'$6 / month':value.offline?'Offline':'Terminal Buddy'}</span></div>
  <h3 id="account-title">{names[value.state]||names.unknown}</h3>
  {value.email&&<p className="account-email">{value.email}</p>}
  {value.state==='free'?<p>This edition remains free. No account, card or trial is required.</p>:<>
   {value.state==='signed-out'&&<p>Sign in with a verified email in your browser. Internet access is required to sign in and activate the trial.</p>}
   {value.state==='eligible'&&<p>Try all application features for 14 days. No card required. Your trial starts only when you choose below.</p>}
   {value.state==='trial'&&<p>Full access until <strong>{date(value.trialEndsAt)}</strong>. No automatic charge when your trial ends.</p>}
   {value.state==='paid'&&<p>Your paid access is verified through <strong>{date(value.accessUntil)}</strong>.</p>}
   {value.state==='cancelling'&&<p>Renewal is canceled. Keep access through <strong>{date(value.accessUntil)}</strong>.</p>}
   {value.state==='past_due'&&<p>Update your payment method. Proposed grace access lasts through <strong>{date(value.accessUntil)}</strong>.</p>}
   {value.state==='expired'&&<p>You can keep using open terminals and retrieve your saved work. Subscribe to start new sessions in the future commercial edition.</p>}
   {value.state==='unknown'&&<p>A connection problem is not a cancellation. Refresh online to verify access. Existing terminals remain available.</p>}
   {value.state==='confirming'&&<p>We are checking the payment provider. Refresh status shortly; a browser success page alone does not confirm payment.</p>}
   {value.offline&&<p className="account-note">Offline: cached access cannot extend your trial or paid-through date.</p>}
   <div className="account-actions">
    {value.state==='signed-out'&&<button className="btn primary" disabled={busy} onClick={()=>run('signIn')}>Sign in with email</button>}
    {value.state==='eligible'&&<button className="btn primary" disabled={busy} onClick={()=>run('startTrial')}>Start free trial — no card</button>}
    {value.customer&&<button className="btn" disabled={busy} onClick={()=>run('manage')}>Manage billing</button>}
    {value.state!=='signed-out'&&<button className="btn" disabled={busy} onClick={()=>run('refresh')}>Refresh status</button>}
    {value.state!=='signed-out'&&<button className="btn" disabled={busy} onClick={()=>run('signOut')}>Sign out</button>}
   </div>
   {['trial','eligible','expired'].includes(value.state)&&<div className="account-purchase"><h4>One individual plan. $6/month.</h4><p>Charged today, then every month until canceled through Manage billing. Buying during the trial starts billing today; unused trial days do not postpone your first payment.</p><label className="account-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I understand the recurring charge and cancellation.</label><button className="btn primary" disabled={busy||!consent} onClick={()=>run('subscribe')}>Subscribe — $6/month, charged today</button></div>}
  </>}
  <p className="account-note">Claude/Codex accounts and usage are separate.</p>
  {value.message&&<p role="status" className="account-note">{value.message}</p>}
  <div className="account-actions"><button className="btn" onClick={()=>run('support')}>Get help</button><button className="btn" onClick={()=>run('notices')}>Third-party licenses</button><button className="btn" onClick={()=>run('chromium')}>Chromium notices</button></div>
 </section>
}
export default function AccountPanel():React.JSX.Element{
 const [value,setValue]=useState<AccountView>({state:'unknown',configured:false,enforcement:false})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notices,setNotices]=useState<string|null>(null)
 useEffect(()=>{void window.buddy.account.status().then(setValue)},[])
 const run=async(action:string)=>{
  if(action==='notices'){setNotices(await window.buddy.account.notices());return}
  setBusy(true);setError('')
  try{const result=await window.buddy.account.action(action);if(result)setValue(result)}
  catch(e){setError(e instanceof Error?e.message:'Please retry.')}finally{setBusy(false)}
 }
 return <><AccountCard value={value} run={a=>void run(a)} busy={busy}/>{error&&<p role="alert">{error}</p>}{notices!==null&&<details open className="account-notices"><summary>Third-party licenses</summary><pre>{notices}</pre></details>}</>
}
