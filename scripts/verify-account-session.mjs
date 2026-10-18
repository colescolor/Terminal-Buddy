import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function instance(fetcher,verify=()=>({state:'unknown'}),options={}){
 const module={exports:{}}
 const electron={app:{isPackaged:false,commandLine:{hasSwitch:()=>true},getPath:()=>'.'},safeStorage:{isEncryptionAvailable:()=>false},shell:{openExternal:async()=>{}}}
 if(options.safeStorage)electron.safeStorage=options.safeStorage
 const imports={electron,'@shared/edition':{EDITION:{kind:'free',commercialApproved:false,enforcement:false,billingOrigin:options.origin??'https://billing.example.invalid',entitlementPublicKey:''}},'./account-access':{verifiedAccess:verify},'./account-dev':{developmentBillingOrigin:()=>null}}
 vm.runInNewContext(ts.transpileModule(readFileSync('src/main/account-service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>imports[name]||require(name),fetch:fetcher,process:{env:{}},URL,Date,performance,AbortSignal,setTimeout,Error,Math,JSON,Buffer})
 const api=new module.exports.AccountService();api.token='fixture-token';return api
}

test('free startup and new workspaces never initialize the OS account keychain',async()=>{
 const api=instance(()=>{throw Error('Unexpected network request')},undefined,{origin:'',safeStorage:{isEncryptionAvailable:()=>{throw Error('Unexpected keychain access')}}})
 assert.equal(api.view().state,'free')
 assert.doesNotThrow(()=>api.assertCanCreate())
 api.token='';await api.signOut()
})

test('a fresh signed-out billing profile opens without touching the OS keychain',async()=>{
 const api=instance(()=>{throw Error('Unexpected network request')},undefined,{safeStorage:{isEncryptionAvailable:()=>{throw Error('Unexpected keychain access')}}})
 api.token=''
 assert.equal(api.view().state,'signed-out')
 assert.doesNotThrow(()=>api.assertCanCreate())
 await api.signOut()
})
test('revoked/expired desktop authentication prompts login; an outage preserves the token and does not claim cancellation',async()=>{
 const revoked=instance(async()=>Response.json({error:'Unauthorized'},{status:401}))
 const view=await revoked.refresh();assert.equal(view.state,'signed-out');assert.match(view.message,/expired or was revoked/);assert.equal(revoked.token,'')
 const offline=instance(async()=>Response.json({error:'Unavailable'},{status:503}))
 assert.equal((await offline.refresh()).offline,true);assert.equal(offline.token,'fixture-token')
})
test('a stale refresh cannot resurrect a signed-out account',async()=>{
 let finish
 const api=instance(()=>new Promise(resolve=>{finish=resolve}))
 const pending=api.refresh();api.generation++;api.token='';api.record=null
 finish(Response.json({error:'Unauthorized'},{status:401}))
 assert.equal((await pending).state,'signed-out');assert.equal(api.token,'')
})

test('Checkout displays bounded pending feedback but only verified paid status clears it; requests coalesce',async()=>{
 let finish,calls=0
 const api=instance(async url=>{if(url.endsWith('/checkout'))return Response.json({confirming:true});calls++;return new Promise(r=>{finish=r})},r=>({state:r?.state||'eligible'}))
 assert.equal((await api.subscribe(true)).billingPending,true)
 const first=api.refresh(),second=api.refresh();assert.equal(calls,1)
 finish(Response.json({state:'paid',accountId:'fixture',accessUntil:Date.now()+86400000}));await Promise.all([first,second])
 assert.equal(api.view().state,'paid');assert.equal(api.view().billingPending,false);assert.ok(api.view().checkedAt)
 api.billingPendingUntil=Date.now()-1;assert.equal(api.view().billingPending,false)
})

test('sign-out during Checkout initiation cannot reopen payment or restore pending UI',async()=>{
 let finish
 const api=instance(url=>url.endsWith('/checkout')?new Promise(r=>{finish=r}):Promise.resolve(Response.json({ok:true})))
 const pending=api.subscribe(true);await api.signOut();finish(Response.json({url:'https://checkout.stripe.com/test'}))
 assert.equal((await pending).state,'signed-out');assert.equal(api.billingPendingUntil,0)
})
