import {createClient} from '@supabase/supabase-js'
async function start(){
const status=document.querySelector('#status'),email=document.querySelector('#email'),code=document.querySelector('#code')
const cfg=await fetch('/api/config').then(r=>r.json())
const auth=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const query=new URLSearchParams(location.search),device=query.get('device'),state=query.get('state')
let jwt=''
async function attempt(fn){try{await fn()}catch{status.textContent='Unable to complete sign-in. Check your code or restart sign-in in the app.'}}
document.querySelector('#email-form').onsubmit=e=>{e.preventDefault();void attempt(async()=>{
 const {error}=await auth.auth.signInWithOtp({email:email.value});if(error)throw error
 document.querySelector('#code-form').hidden=false;status.textContent='Enter the code from your email. Do not share it with anyone.'
})}
document.querySelector('#code-form').onsubmit=e=>{e.preventDefault();void attempt(async()=>{
 const {data,error}=await auth.auth.verifyOtp({email:email.value,token:code.value,type:'email'});if(error||!data.session)throw error
 jwt=data.session.access_token
 status.textContent='Signed in as '+data.user.email+'. Confirm only if you started sign-in in Terminal Buddy.'
 document.querySelector('#approve').hidden=!device||!state
 if(!device)status.textContent='Return to Terminal Buddy and refresh status. A checkout return page is not payment confirmation.'
})}
document.querySelector('#approve').onclick=()=>void attempt(async()=>{
 const r=await fetch('/api/device/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({id:device,state})})
 if(!r.ok)throw Error()
 jwt='';await auth.auth.signOut({scope:'local'})
 document.querySelector('#approve').hidden=true;status.textContent='Device connected. Return to Terminal Buddy. You may close this page.'
 history.replaceState(null,'','/account/')
})
if(query.has('checkout'))status.textContent='Return to Terminal Buddy and refresh status to confirm your subscription. This page does not grant access.'


}
start().catch(()=>{document.querySelector("#status").textContent="The test account service is not configured yet. No trial or payment has started.";document.querySelectorAll("form button").forEach(b=>b.disabled=true)})
