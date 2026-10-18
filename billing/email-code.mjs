// Shared passwordless UX. Supabase remains the authority for OTP expiry and limits.
export function emailCode({auth,message,onVerified,shouldCreateUser=true,beforeSend=async()=>true}){
 const el=id=>document.getElementById(id),email=el('email'),code=el('code'),form=el('email-form'),verify=el('code-form')
 const send=form.querySelector('button'),submit=verify.querySelector('button')
 const change=document.createElement('button');change.type='button';change.textContent='Use a different email';change.hidden=true;form.append(change)
 let busy=false,sentEmail='',until=0,generation=0,finished=false,stopped=false
 const render=()=>{send.disabled=busy||finished||stopped||Date.now()<until;submit.disabled=busy||finished||stopped;email.readOnly=!!sentEmail||busy;change.disabled=busy;send.textContent=Date.now()<until?'Resend in '+Math.ceil((until-Date.now())/1000)+'s':sentEmail?'Resend code':'Send sign-in code'}
 const timer=setInterval(render,1000)
 const reset=()=>{generation++;sentEmail='';until=0;finished=false;stopped=false;code.value='';email.readOnly=false;form.hidden=false;verify.hidden=true;change.hidden=true;render()}
 change.onclick=()=>{reset();email.focus();message('Enter the email you want to sign in with.')}
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||finished||stopped||Date.now()<until)return
  busy=true;render();const current=generation
  try{
   if(!await beforeSend())return
   const address=(sentEmail||email.value).trim().toLowerCase()
   const {error}=await auth.auth.signInWithOtp({email:address,options:{shouldCreateUser}})
   if(current!==generation)return
   if(error){if(error.status===429){until=Date.now()+60000;message('Too many code requests. Wait a minute before trying again. If this continues, try later.');return}throw error}
   sentEmail=address;email.value=address;until=Date.now()+60000;code.value='';verify.hidden=false;change.hidden=false;code.focus()
   message('Check '+address+' for the latest sign-in code, including spam. No password is needed.')
  }catch{if(current===generation)message('Unable to send a code. Check your email address and connection, then try again.')}
  finally{busy=false;render()}
 }
 verify.onsubmit=async event=>{
  event.preventDefault();if(busy||!sentEmail||finished||stopped)return
  busy=true;render();const current=generation
  try{
   const {data,error}=await auth.auth.verifyOtp({email:sentEmail,token:code.value.trim(),type:'email'})
   if(current!==generation)return
   if(error||!data.session)throw error||Error()
   code.value='';finished=true;form.hidden=true;verify.hidden=true;change.hidden=true
   await onVerified(data.session)
  }catch{if(current===generation)message('That code could not be verified. Use the latest code, or choose Resend code after the countdown.')}
  finally{busy=false;render()}
 }
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true})
 return {reset,stop(){stopped=true;generation++;form.hidden=true;verify.hidden=true;code.value='';render()}}
}
