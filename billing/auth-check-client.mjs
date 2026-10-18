import {createClient} from '@supabase/supabase-js'
const $=selector=>document.querySelector(selector)
const status=$('#status')
async function start(){
 const cfg=await fetch('/config').then(r=>r.json())
 const client=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 let verifiedCount=0,lastEmail=''
 $('#email-form').onsubmit=async event=>{
  event.preventDefault();$('#send').disabled=true
  lastEmail=$('#email').value.trim()
  try{
   const {error}=await client.auth.signInWithOtp({email:lastEmail})
   if(error)throw error
   $('#code-form').hidden=false;$('#email').readOnly=true
   status.textContent='Code requested. Check your inbox and spam folder, then enter the code below. Delivery is not confirmed until you receive it.'
   $('#code').focus()
  }catch(error){status.textContent=error.status===429?'Email rate limit reached. Wait before trying again.':'Email request failed. Check the Supabase/Resend logs; no billing action occurred.'}
  finally{setTimeout(()=>{$('#send').disabled=false},60000)}
 }
 $('#code-form').onsubmit=async event=>{
  event.preventDefault();$('#verify').disabled=true
  try{
   const {data,error}=await client.auth.verifyOtp({email:lastEmail,token:$('#code').value.trim(),type:'email'})
   if(error||!data.session)throw error||Error('No session')
   const confirmed=await client.auth.getUser()
   if(confirmed.error||!confirmed.data.user.email_confirmed_at)throw Error('Email not verified')
   verifiedCount++;$('#code').value='';$('#code-form').hidden=true;$('#email-form').hidden=true;$('#again').hidden=false
   status.textContent=`PASS: real email verification succeeded (${verifiedCount} successful check${verifiedCount===1?'':'s'} in this page). No trial or payment started.`
  }catch{status.textContent='Verification failed. Check the latest code and try again. No trial or payment started.'}
  finally{$('#verify').disabled=false}
 }
 $('#again').onclick=async()=>{
  $('#again').disabled=true
  try{await client.auth.signOut({scope:'local'});$('#again').hidden=true;$('#email-form').hidden=false;$('#email').readOnly=false;status.textContent='Signed out. Request another code to test the returning-user email.'}
  finally{$('#again').disabled=false}
 }
}
start().catch(()=>{status.textContent='Local auth check is not configured. No email or payment was sent.';document.querySelectorAll('button').forEach(b=>b.disabled=true)})
