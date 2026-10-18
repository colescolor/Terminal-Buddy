import {createClient} from '@supabase/supabase-js'
import {emailCode} from './email-code.mjs'
async function start(){
 const status=document.querySelector('#status'),email=document.querySelector('#email'),code=document.querySelector('#code')
 const emailForm=document.querySelector('#email-form'),codeForm=document.querySelector('#code-form'),approve=document.querySelector('#approve')
 const cfgResponse=await fetch('/api/config');if(!cfgResponse.ok)throw Error()
 const cfg=await cfgResponse.json()
 const auth=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const query=new URLSearchParams(location.search),device=query.get('device'),state=query.get('state')
 let jwt='',busy=false,login
 const expire=()=>{
  jwt='';code.value='';emailForm.hidden=true;codeForm.hidden=true;approve.hidden=true
  login?.stop()
  status.textContent='This app connection request expired or was already used. Return to Terminal Buddy and click Login or Sign in with email to open a fresh request. Then request a new email code in the new tab.'
 }
 async function attempt(fn,message){
  if(busy)return
  busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true)
  try{await fn()}catch{status.textContent=message}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false)}
 }
 const available=async()=>{
  if(!device&&!state)return true
  const r=await fetch('/api/device/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:device,state})})
  if(!r.ok)throw Error()
  if(!(await r.json()).available){expire();return false}return true
 }
 login=emailCode({auth,message:text=>{status.textContent=text},beforeSend:available,onVerified:async session=>{
  jwt=session.access_token
  status.textContent='Email verified. Connect only if you started sign-in in Terminal Buddy.'
  approve.hidden=!device||!state
  if(device&&state)approve.focus()
  else{
   status.textContent='Email verified. Use Login in Terminal Buddy to connect the app. You can also revoke desktop logins below.'
   const panel=document.createElement('section'),text=document.createElement('p'),button=document.createElement('button')
   text.textContent='Lost a device? Sign out all devices. Running terminals and saved work stay intact. Offline cached access can last until its existing expiry.'
   button.textContent='Sign out all devices';button.type='button';panel.append(text,button);status.after(panel)
   button.onclick=()=>void attempt(async()=>{
    const r=await fetch('/api/account/revoke-devices',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:'{}'})
    if(!r.ok)throw Error()
    button.hidden=true;status.textContent='Desktop logins revoked. Devices must sign in again when they next refresh online. Running terminals were not stopped.'
   },'Could not revoke desktop logins. Please retry.')
  }
 }})
 approve.onclick=()=>void attempt(async()=>{
  const r=await fetch('/api/device/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({id:device,state})})
  if(r.status===409){expire();await auth.auth.signOut({scope:'local'}).catch(()=>{});return}
  if(!r.ok)throw Error()
  jwt='';approve.hidden=true;status.textContent='Device connected. Return to Terminal Buddy. You may close this page.'
  history.replaceState(null,'','/account/')
  await auth.auth.signOut({scope:'local'}).catch(()=>{})
 },'Your email was verified, but the app connection could not finish. Check your connection and try Connect again. If the request expired, restart sign-in in Terminal Buddy.')
 if(device||state){
  emailForm.hidden=true
  const r=await fetch('/api/device/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:device,state})})
  if(!r.ok)throw Error()
  if(!(await r.json()).available){expire();return}
  emailForm.hidden=false
 }
 if(query.has('checkout'))status.textContent='Return to Terminal Buddy and refresh status to confirm your subscription. This page does not grant access.'
}
start().catch(()=>{document.querySelector('#status').textContent='The test account service is unavailable. Return to the app and restart sign-in shortly. No trial or payment has started.';document.querySelectorAll('button').forEach(b=>b.disabled=true)})
