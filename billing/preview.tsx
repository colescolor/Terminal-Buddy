import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {AccountCard} from '../src/renderer/src/components/AccountPanel'
import '../src/renderer/src/account.css'
const states=['signed-out','eligible','trial','paid','cancelling','past_due','expired','confirming','unknown','free']
const initial=new URLSearchParams(location.search).get('state')||'trial'
function Preview(){
 const [state,setState]=useState(initial),[message,setMessage]=useState(''),[portal,setPortal]=useState(false)
 const value:any={state,configured:state!=='free',enforcement:false,email:state==='signed-out'?undefined:'alex@example.invalid',customer:['paid','cancelling','past_due'].includes(state),trialEndsAt:Date.now()+9*86400000,accessUntil:Date.now()+21*86400000,message}
 const run=(action:string)=>{
  if(action==='startTrial')setState('trial')
  else if(action==='subscribe'){setState('confirming');setMessage('Simulated checkout. No payment or real provider call. Choose Paid above to preview confirmation.')}
  else if(action==='signIn')setState('eligible')
  else if(action==='signOut')setState('signed-out')
  else if(action==='manage')setPortal(true)
  else if(action==='refresh')setMessage('Preview refreshed. State is fictional and cannot grant desktop access.')
  else setMessage(action==='support'?'Production support route: GitHub issues.':'License viewer is available in the desktop Settings screen.')
 }
 return <main><p className="preview-label">LOCAL DESIGN & STATE PREVIEW · NO REAL PAYMENTS</p><h1>Terminal Buddy account</h1><nav aria-label="Preview states">{states.map(s=><button className="btn" key={s} aria-pressed={s===state} onClick={()=>{setState(s);setPortal(false);setMessage('')}}>{s}</button>)}</nav><AccountCard value={value} run={run}/>{portal&&<aside role="status"><h2>Manage billing</h2><p>The real app opens Stripe’s hosted customer portal in your system browser.</p><p>Payment methods · Invoices · Cancel renewal</p><p>This is a navigation preview, not a replica of Stripe or a live billing portal.</p><button className="btn" onClick={()=>{setState('cancelling');setPortal(false)}}>Preview cancellation scheduled</button></aside>}<p className="preview-label">Existing free releases remain unchanged. This preview is never built into the desktop or production API.</p></main>
}
createRoot(document.getElementById('root')!).render(<Preview/>)
