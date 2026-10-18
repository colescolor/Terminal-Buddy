import {createClient} from '@supabase/supabase-js'
import {dashboardController,message} from './admin-view.mjs'
import {emailCode} from './email-code.mjs'
import {recoveryInbox} from './admin-recovery.mjs'
const el=id=>document.getElementById(id)
async function start(){
 const response=await fetch('/api/config',{cache:'no-store'});if(!response.ok)throw Error()
 const cfg=await response.json()
 const auth=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}})
 let generation=0
 const inbox=recoveryInbox(async(path,body)=>{
  const {data}=await auth.auth.getSession();if(!data.session)throw Error('Sign in again.')
  const r=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)})
  const result=await r.json();if(!r.ok)throw Error(result.error||'Recovery inbox unavailable.');return result
 })
 const board=dashboardController(async filters=>{
  const {data,error}=await auth.auth.getSession();if(error||!data.session)throw Error('Sign in again to view owner records.')
  const result=await fetch('/api/admin/overview',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(filters)})
  if(!result.ok)throw Error(result.status===403?'This account does not have owner access.':result.status===401?'Your sign-in expired. Sign out and sign in again.':'The owner service is unavailable or not configured. Please retry.')
  return result.json()
 })
 const login=emailCode({auth,message,shouldCreateUser:false,onVerified:async()=>{
  el('sign-in').hidden=true;el('sign-out').hidden=false;await board.refresh(true);await inbox.refresh()
 }})
 el('sign-out').onclick=async()=>{
  generation++;board.clear();inbox.clear();login.reset();el('sign-in').hidden=false;el('sign-out').hidden=true;el('code-form').hidden=true;el('code').value=''
  message('Signed out. Account records cleared from this page.')
  await auth.auth.signOut({scope:'local'}).catch(()=>{})
 }
}
start().catch(()=>{message('The test owner service is not configured yet.',true);document.querySelectorAll('form button').forEach(b=>b.disabled=true)})
