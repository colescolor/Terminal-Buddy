import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const module={exports:{}}
vm.runInNewContext(ts.transpileModule(readFileSync('src/main/account-sync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date,Promise})
const {AccountSync}=module.exports
test('automatic checks reconcile delayed payment, coalesce windows, then back off',async()=>{
 let clock=0,calls=0,finish;const updates=[]
 let state={state:'eligible',configured:true,billingPending:true}
 const sync=new AccountSync({view:()=>state,refresh:()=>{calls++;return new Promise(r=>{finish=r})}},v=>updates.push(v),()=>clock)
 const first=sync.check('focus');void sync.check('focus');void sync.check();assert.equal(calls,1)
 finish(state);await first
 clock=4999;await sync.check();assert.equal(calls,1)
 clock=5000;const second=sync.check();state={state:'paid',configured:true,billingPending:false};finish(state);await second
 assert.equal(updates.at(-1).state,'paid');assert.equal(calls,2)
 clock=10000;await sync.check();assert.equal(calls,2)
 clock=305000;const third=sync.check();finish(state);await third;assert.equal(calls,3)
})
test('free and signed-out editions make no requests; focus checks are throttled',async()=>{
 let clock=0,calls=0,state={state:'free',configured:false}
 const sync=new AccountSync({view:()=>state,refresh:async()=>{calls++;return state}},()=>{},()=>clock)
 await sync.check('startup');state={state:'signed-out',configured:true};await sync.check('focus');assert.equal(calls,0)
 state={state:'trial',configured:true};await sync.check('focus');clock=1000;await sync.check('focus');assert.equal(calls,1)
 clock=15000;await sync.check('focus');assert.equal(calls,2)
 sync.stop();clock=900000;await sync.check();assert.equal(calls,2)
})
test('outages do not create paid state or a rapid retry loop; stopping drops pending publications',async()=>{
 let clock=0,calls=0,finish;const updates=[]
 const sync=new AccountSync({view:()=>({state:'eligible',configured:true,billingPending:true}),refresh:async()=>{calls++;if(calls===1)throw Error('offline');return new Promise(r=>{finish=r})}},v=>updates.push(v),()=>clock)
 await sync.check();await sync.check();assert.equal(calls,1);assert.equal(updates.length,0)
 clock=5000;const pending=sync.check();sync.stop();finish({state:'paid'});await pending;assert.equal(updates.length,0)
})
