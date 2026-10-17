import {createClient} from '@supabase/supabase-js'
import {dashboardController,message} from './admin-view.mjs'
const el=id=>document.getElementById(id)
async function start(){
 const response=await fetch('/api/config',{cache:'no-store'});if(!response.ok)throw Error()
 const cfg=await response.json()
 const auth=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}})
 let generation=0
 const board=dashboardController(async filters=>{
  const {data,error}=await auth.auth.getSession();if(error||!data.session)throw Error('Sign in again to view owner records.')
  const result=await fetch('/api/admin/overview',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(filters)})
  if(!result.ok)throw Error(result.status===403?'This account does not have owner access.':result.status===401?'Your sign-in expired. Sign out and sign in again.':'The owner service is unavailable or not configured. Please retry.')
  return result.json()
 })
 async function attempt(form,fn){const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn()}catch{message('Sign-in could not be completed. Check the code or try again.',true)}finally{buttons.forEach(b=>b.disabled=false)}}
 el('email-form').onsubmit=e=>{e.preventDefault();void attempt(e.target,async()=>{
  const {error}=await auth.auth.signInWithOtp({email:el('email').value,options:{shouldCreateUser:false}});if(error)throw error
  el('code-form').hidden=false;message('Check your email for the owner sign-in code.');el('code').focus()
 })}
 el('code-form').onsubmit=e=>{e.preventDefault();const current=++generation;void attempt(e.target,async()=>{
  const {error}=await auth.auth.verifyOtp({email:el('email').value,token:el('code').value,type:'email'});if(error)throw error
  el('code').value='';if(current!==generation)return
  el('sign-in').hidden=true;el('sign-out').hidden=false;await board.refresh(true)
 })}
 el('sign-out').onclick=async()=>{
  generation++;board.clear();el('sign-in').hidden=false;el('sign-out').hidden=true;el('code-form').hidden=true;el('code').value=''
  message('Signed out. Account records cleared from this page.')
  await auth.auth.signOut({scope:'local'})
 }
}
start().catch(()=>{message('The test owner service is not configured yet.',true);document.querySelectorAll('form button').forEach(b=>b.disabled=true)})
