export function ownerMfa({auth,call,message,onReady,document=globalThis.document}){
 const el=id=>document.getElementById(id)
 let factorId='',generation=0,busy=false
 const clear=()=>{generation++;factorId='';busy=false;el('mfa').hidden=true;el('mfa-qr').removeAttribute('src');el('mfa-secret').textContent='';el('mfa-code').value='';el('mfa-enroll').disabled=false;el('mfa-verify').disabled=false}
 async function begin(){
  clear();const current=generation
  const access=await call('/admin/access',{})
  if(current!==generation)return
  if(!access.mfaRequired){await onReady();return}
  el('mfa').hidden=false;el('mfa-form').hidden=true;el('mfa-setup').hidden=true;el('mfa-enroll').hidden=true
  const {data,error}=await auth.auth.mfa.listFactors()
  if(current!==generation)return
  if(error)throw Error('Unable to read authenticator setup. Sign out and retry.')
  const factor=data.totp.find(f=>f.status==='verified')
  if(factor){factorId=factor.id;el('mfa-form').hidden=false;el('mfa-code').focus();message('Enter the code from your authenticator app.')}
  else{el('mfa-enroll').hidden=false;message('Set up an authenticator before viewing owner records.')}
 }
 el('mfa-enroll').onclick=async()=>{
  if(busy)return;busy=true;const current=generation;el('mfa-enroll').disabled=true
  try{
   const {data,error}=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'Terminal Buddy owner '+new Date().toISOString()})
   if(current!==generation)return
   if(error)throw Error('Authenticator setup failed. Retry, or review existing factors with support.')
   // auth-js 2.118 prefixes the provider SVG with a data URL already.
   // Encode the SVG once (including # colors), never a nested data URL.
   const svg=data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/,'')
   if(!svg.includes('<svg'))throw Error('Authenticator QR code is unavailable. Retry setup.')
   factorId=data.id;el('mfa-qr').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
   el('mfa-secret').textContent=data.totp.secret;el('mfa-setup').hidden=false;el('mfa-form').hidden=false;el('mfa-enroll').hidden=true;el('mfa-code').focus()
   message('Scan the QR code privately, then enter the authenticator code. Do not share the setup key.')
  }catch(e){if(current===generation){message(e.message,true);el('mfa-enroll').disabled=false}}
  finally{if(current===generation)busy=false}
 }
 el('mfa-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!factorId)return
  const code=el('mfa-code').value.trim();if(!/^\d{6}$/.test(code)){message('Enter the six-digit authenticator code.',true);return}
  busy=true;const current=generation;el('mfa-verify').disabled=true
  try{
   const {error}=await auth.auth.mfa.challengeAndVerify({factorId,code})
   if(current!==generation)return
   if(error)throw Error('That authenticator code could not be verified. Try the current code.')
   const access=await call('/admin/access',{})
   if(current!==generation)return
   if(access.mfaRequired)throw Error('Second-factor verification is still required.')
   clear();await onReady()
  }catch(e){if(current===generation)message(e.message,true)}
  finally{if(current===generation){busy=false;el('mfa-verify').disabled=false;el('mfa-code').value=''}}
 }
 return {begin,clear}
}
