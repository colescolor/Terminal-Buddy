import {createClient} from '@supabase/supabase-js'
import {emailCode} from './email-code.mjs'
const el=id=>document.getElementById(id),message=text=>{el('status').textContent=text}
async function start(){
 const response=await fetch('/api/config');if(!response.ok)throw Error()
 const cfg=await response.json(),auth=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}})
 let generation=0,busy=false
 async function call(path,body){
  const {data}=await auth.auth.getSession();if(!data.session)throw Error('Sign in again to view your requests.')
  const r=await fetch('/api/recovery/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)})
  const result=await r.json();if(!r.ok)throw Error(result.error||'Please retry.');return result
 }
 async function refresh(){
  const current=generation,data=await call('mine',{});if(current!==generation)return
  el('requests').replaceChildren()
  el('request-form').hidden=data.requests.some(r=>r.status!=='closed')
  for(const r of data.requests){const section=document.createElement('section');for(const value of ['Request '+r.id,'Status: '+r.status,'Original account: '+r.originalEmail,r.reply||'Awaiting owner review.']){const p=document.createElement('p');p.textContent=value;section.append(p)}el('requests').append(section)}
  if(!data.requests.length)el('requests').textContent='No requests yet.'
 }
 const login=emailCode({auth,message,onVerified:async session=>{
  el('contact').textContent='Verified contact: '+session.user.email;el('recovery-panel').hidden=false
  try{await refresh();message('Your contact email is verified.')}catch(e){message(e.message)}
 }})
 el('request-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;const current=generation,button=event.target.querySelector('button');button.disabled=true
  try{await call('request',{originalEmail:el('original-email').value,reason:el('reason').value});if(current!==generation)return;el('reason').value='';await refresh();message('Request received for review. No account or subscription has been transferred.')}
  catch(e){if(current===generation)message(e.message)}finally{busy=false;button.disabled=false}
 }
 el('refresh').onclick=()=>void refresh().catch(e=>message(e.message))
 el('sign-out').onclick=async()=>{generation++;el('recovery-panel').hidden=true;el('requests').replaceChildren();el('contact').textContent='';el('reason').value='';el('original-email').value='';login.reset();await auth.auth.signOut({scope:'local'}).catch(()=>{});message('Signed out. Request details cleared.')}
}
start().catch(()=>{message('Recovery is temporarily unavailable. Please try again later.');document.querySelectorAll('button').forEach(b=>b.disabled=true)})
