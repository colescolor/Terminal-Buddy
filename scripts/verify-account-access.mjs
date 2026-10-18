import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {generateKeyPairSync,sign} from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url),module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync('src/main/account-access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Buffer,Set,JSON,Number,Math})
const {verifiedAccess,canCreateWorkspace}=module.exports
const devModule={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync('src/main/account-dev.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:devModule,exports:devModule.exports,URL,Error})
test('hosted test billing is restricted to an unpackaged isolated profile and exact approved origin',()=>{
 const resolve=devModule.exports.developmentBillingOrigin,origin='https://terminal-buddy-billing-test.netlify.app'
 assert.equal(resolve(false,true,origin),origin)
 assert.equal(resolve(true,true,origin),null)
 assert.equal(resolve(false,false,origin),null)
 assert.equal(resolve(false,true,'http://127.0.0.1:4318'),'http://127.0.0.1:4318')
 for(const value of [origin+'/account/',origin+'?secret=x',origin+'.example.com','http://terminal-buddy-billing-test.netlify.app','https://user:pass@terminal-buddy-billing-test.netlify.app'])assert.throws(()=>resolve(false,true,value))
})
const keys=generateKeyPairSync('ed25519'),key=keys.publicKey.export({type:'spki',format:'pem'}),now=1800000000000,DAY=86400000
function record(extra={}){
 const claims={issuer:'terminal-buddy-test',audience:'terminal-buddy-desktop',subject:'account-1',state:'trial',verifiedAt:now,accessUntil:now+14*DAY,offlineUntil:now+7*DAY,...extra}
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url')
 return {accountId:'account-1',entitlement:{payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64url')}}
}
test('offline allowance is bounded, survives serialization, and cannot extend trial or paid dates',()=>{
 const r=JSON.parse(JSON.stringify(record()))
 assert.equal(verifiedAccess(r,key,now+6*DAY,now).allow,true)
 assert.equal(verifiedAccess(r,key,now+7*DAY,now).allow,false)
 assert.equal(verifiedAccess(record({accessUntil:now+DAY,offlineUntil:now+DAY}),key,now+DAY,now).state,'expired')
 assert.equal(verifiedAccess(record({offlineUntil:now+8*DAY}),key,now,now).allow,false)
})
test('tamper, wrong account/key and backward/forward clock changes do not grant access',()=>{
 const r=record()
 assert.equal(verifiedAccess({...r,accountId:'other'},key,now,now).allow,false)
 assert.equal(verifiedAccess({...r,entitlement:{...r.entitlement,payload:r.entitlement.payload+'a'}},key,now,now).allow,false)
 assert.equal(verifiedAccess(r,'bad key',now,now).allow,false)
 assert.equal(verifiedAccess(r,key,now-600000,now).allow,false)
 assert.equal(verifiedAccess(r,key,now+30*DAY,now).allow,false)
})
test('free edition never requires a trial; expired/signed-out gates only the new-session decision',()=>{
 assert.equal(canCreateWorkspace(false,null,'',now,now),true)
 assert.equal(canCreateWorkspace(true,null,key,now,now),false)
 assert.equal(canCreateWorkspace(true,record(),key,now,now),true)
 const text=readFileSync('src/main/account-service.ts','utf8')
 assert.doesNotMatch(text,/ptys\.|\.kill\(|catalog|session-feed|rmSync/)
 const entry=readFileSync('src/main/index.ts','utf8')
 assert.equal((entry.match(/account\?\.assertCanCreate\(\)/g)||[]).length,1)
})
