// Packaged subscription startup/native-module smoke test. No login, provider call or payment.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {_electron,expect} from '../billing/node_modules/@playwright/test/index.mjs'
const root=await mkdtemp(join(tmpdir(),'buddy-subscription-smoke-'))
const profile=join(root,'profile'),home=join(root,'home')
await mkdir(profile);await mkdir(home);await mkdir('artifacts',{recursive:true})
await writeFile(join(profile,'settings.json'),JSON.stringify({walkthroughVersion:1,trayIcon:false,desktopNotifications:false}))
if(!process.env.BUDDY_EXE)throw Error('Set BUDDY_EXE to the packaged subscription executable')
const env={...process.env,HOME:home,USERPROFILE:home}
delete env.ELECTRON_RUN_AS_NODE;delete env.BUDDY_BILLING_DEV_ORIGIN;delete env.BUDDY_BILLING_PUBLIC_KEY
const app=await _electron.launch({executablePath:resolve(process.env.BUDDY_EXE),args:['--user-data-dir='+profile],env,timeout:45000})
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.buddy)
 const status=await page.evaluate(()=>window.buddy.account.status())
 assert.equal(status.state,'signed-out');assert.equal(status.enforcement,true);assert.equal(status.configured,true)
 const blocked=await page.evaluate(async()=>{try{await window.buddy.pty.create({});return false}catch{return true}})
 assert.equal(blocked,true,'Signed-out subscription cannot open a new workspace')
 const security=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences())
 assert.equal(security.contextIsolation,true);assert.equal(security.nodeIntegration,false)
 await page.keyboard.press('Escape')
 await page.locator('button[title^="Settings"]').click()
 await expect(page.getByRole('heading',{name:'Sign in to Terminal Buddy',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Third-party licenses',exact:true}).click()
 await expect(page.locator('.account-notices')).toContainText('Meta Platforms')
 await page.screenshot({path:'artifacts/subscription-'+process.platform+'-'+process.arch+'.png',fullPage:true})
 // Exercise the actual packaged native module independently of account access.
 // This harness runs only in CI/local tests; it adds no app access override.
 const native=await app.evaluate(async({app})=>{
  const {createRequire}=process.mainModule.require('node:module')
  const load=createRequire(app.getAppPath()+'/package.json')
  const pty=load('@lydell/node-pty')
  return new Promise((resolve,reject)=>{
   const win=process.platform==='win32'
   const child=pty.spawn(win?'cmd.exe':'/bin/sh',win?['/d','/c','echo BUDDY_NATIVE_SUBSCRIPTION_OK']:['-c','printf BUDDY_NATIVE_SUBSCRIPTION_OK'],{cols:80,rows:24,cwd:app.getPath('temp'),env:process.env})
   let output=''
   const timer=setTimeout(()=>{child.kill();reject(Error('Native PTY test timed out'))},10000)
   child.onData(chunk=>{output+=chunk})
   child.onExit(()=>{clearTimeout(timer);resolve({marker:output.includes('BUDDY_NATIVE_SUBSCRIPTION_OK'),arch:process.arch})})
  })
 })
 assert.equal(native.marker,true);assert.equal(native.arch,process.arch)
 console.log('PASS packaged subscription: signed-out gate, policy/license UI, context isolation and native PTY on '+process.platform+'/'+process.arch+'. No live purchase or signed-in flow exercised.')
}finally{await app.close()}
