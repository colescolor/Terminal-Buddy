import {app,safeStorage,shell} from 'electron'
import {readFileSync,writeFileSync,existsSync,renameSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {createHash,randomBytes} from 'node:crypto'
import {EDITION} from '@shared/edition'
import type {AccountRecord,AccountView} from '@shared/account'
import {canCreateWorkspace,verifiedAccess} from './account-access'
import {developmentBillingOrigin} from './account-dev'
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))
export class AccountService {
 private token=''; private record:AccountRecord|null=null; private highestWall=0; private signingIn=false; private generation=0
 private lastWall=Date.now(); private lastMono=performance.now(); private clockChanged=false
 private origin=EDITION.billingOrigin
 private key=EDITION.entitlementPublicKey
 readonly enforcement=EDITION.kind==='commercial'&&EDITION.commercialApproved&&EDITION.enforcement
 private file=''
 constructor(){
  const developmentOrigin=developmentBillingOrigin(app.isPackaged,app.commandLine.hasSwitch('user-data-dir'),process.env.BUDDY_BILLING_DEV_ORIGIN)
  if(developmentOrigin){
   this.origin=developmentOrigin;this.key=process.env.BUDDY_BILLING_DEV_PUBLIC_KEY||''
  }
  this.file=join(app.getPath('userData'),'buddy-account.secure')
  if(this.secure()&&existsSync(this.file)){
   try {const saved=JSON.parse(safeStorage.decryptString(readFileSync(this.file)));this.token=saved.token||'';this.record=saved.record||null;this.highestWall=saved.highestWall||0}catch{/* Require sign-in instead of using an unreadable credential. */}
  }
 }
 private secure(){return safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text')}
 private persist(){
  if(!this.secure())return // Memory-only when OS-backed encryption is unavailable; never plaintext.
  const encrypted=safeStorage.encryptString(JSON.stringify({token:this.token,record:this.record,highestWall:this.highestWall}))
  writeFileSync(this.file+'.tmp',encrypted,{mode:0o600});renameSync(this.file+'.tmp',this.file)
 }
 private tick(){
  const wall=Date.now(),mono=performance.now()
  if(Math.abs((wall-this.lastWall)-(mono-this.lastMono))>300000)this.clockChanged=true
  this.highestWall=Math.max(this.highestWall,wall);this.lastWall=wall;this.lastMono=mono
 }
 private async request(path:string,body:unknown={},token=this.token):Promise<any>{
  if(!this.origin)throw Error('The future account service is not configured.')
  const u=new URL(this.origin)
  if(u.protocol!=='https:'&&(app.isPackaged||u.hostname!=='127.0.0.1'))throw Error('Invalid billing service.')
  const response=await fetch(this.origin+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'})
  const data=await response.json() as any
  if(!response.ok)throw Object.assign(Error(response.status===401?'Sign in again to refresh your account.':data.error||'Account service is temporarily unavailable.'),{status:response.status})
  return data
 }
 view(offline=false,message?:string):AccountView{
  this.tick()
  if(!this.origin)return {state:'free',configured:false,enforcement:false,message:'This edition remains free. No account or trial is required.'}
  if(!this.token)return {state:'signed-out',configured:true,enforcement:this.enforcement,message}
  const access=this.clockChanged?{state:'unknown' as const}:verifiedAccess(this.record,this.key,Date.now(),this.highestWall)
  this.persist()
  return {state:access.state,email:this.record?.email,trialEndsAt:this.record?.trialEndsAt,accessUntil:this.record?.accessUntil,
   customer:this.record?.customer,configured:true,enforcement:this.enforcement,offline,message}
 }
 assertCanCreate(){
  this.tick();this.persist()
  if(this.enforcement&&(this.clockChanged||!canCreateWorkspace(true,this.record,this.key,Date.now(),this.highestWall)))
   throw Error('Open Settings → Account to refresh access or subscribe. Existing terminals and saved work remain available.')
 }
 async refresh():Promise<AccountView>{
  if(!this.token)return this.view()
  const generation=this.generation
  try {
   const record=await this.request('/status') as AccountRecord
   if(generation!==this.generation)return this.view()
   if(verifiedAccess(record,this.key,Date.now(),0).state==='unknown')throw Error('Access could not be verified.')
   this.record=record;this.highestWall=Date.now();this.clockChanged=false;this.lastWall=Date.now();this.lastMono=performance.now();this.persist();return this.view()
  }catch(error){
   if(generation!==this.generation)return this.view()
   if((error as {status?:number}).status===401){this.token='';this.record=null;this.persist();return this.view(false,'Your login expired or was revoked. Sign in again. Running terminals are unaffected.')}
   return this.view(true,'Status could not be refreshed. Previously verified access is bounded; running terminals are unaffected.')
  }
 }
 async startTrial(){
  if(!this.token)throw Error('Sign in before starting a trial.')
  await this.request('/trial');return this.refresh()
 }
 async signIn(){
  if(this.signingIn)throw Error('Sign-in is already open in your browser.')
  this.signingIn=true;const generation=++this.generation
  try{
   const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url')
   const challenge=createHash('sha256').update(verifier).digest('base64url')
   const flow=await this.request('/device/start',{challenge,state},'')
   const url=new URL(flow.url)
   if(url.origin!==this.origin||url.pathname!=='/account/'||url.searchParams.get('state')!==state||url.searchParams.get('device')!==flow.id)throw Error('Invalid sign-in callback state.')
   await shell.openExternal(url.href)
   for(let i=0;i<100;i++){
    if(generation!==this.generation)return this.view()
    await delay(3000)
    const exchange=await this.request('/device/exchange',{id:flow.id,verifier,state},'')
    if(!exchange.pending){if(generation!==this.generation)return this.view();this.token=exchange.token;this.record=null;this.persist();return this.refresh()}
   }
   throw Error('Sign-in expired. Please try again.')
  }finally{this.signingIn=false}
 }
 async subscribe(accepted:boolean){
  const result=await this.request('/checkout',{acceptRecurring:accepted})
  if(result.url)await this.openStripe(result.url,'checkout.stripe.com')
  return this.view(false,'Confirming subscription. Return here and refresh after Checkout; the browser return page does not grant access.')
 }
 async manage(){const result=await this.request('/portal');await this.openStripe(result.url,'billing.stripe.com');return this.view()}
 private async openStripe(value:string,host:string){
  const u=new URL(value)
  if(u.protocol!=='https:'||u.hostname!==host||u.username||u.password)throw Error('Invalid billing link.')
  await shell.openExternal(u.href)
 }
 async signOut(){
  const token=this.token;this.generation++;this.token='';this.record=null;this.persist()
  try{if(token)await this.request('/sign-out',{},token)}catch{/* Local credentials are cleared even offline; remote sessions expire in 30 days. */}
  return this.view()
 }
 support(){return shell.openExternal(EDITION.supportUrl)}
}
