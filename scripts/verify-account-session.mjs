import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function instance(fetcher){
 const module={exports:{}}
 const electron={app:{isPackaged:false,commandLine:{hasSwitch:()=>true},getPath:()=>'.'},safeStorage:{isEncryptionAvailable:()=>false},shell:{openExternal:async()=>{}}}
 const imports={electron,'@shared/edition':{EDITION:{kind:'free',commercialApproved:false,enforcement:false,billingOrigin:'https://billing.example.invalid',entitlementPublicKey:''}},'./account-access':{verifiedAccess:()=>({state:'unknown'})},'./account-dev':{developmentBillingOrigin:()=>null}}
 vm.runInNewContext(ts.transpileModule(readFileSync('src/main/account-service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>imports[name]||require(name),fetch:fetcher,process:{env:{}},URL,Date,performance,AbortSignal,setTimeout,Error,Math,JSON,Buffer})
 const api=new module.exports.AccountService();api.token='fixture-token';return api
}
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
