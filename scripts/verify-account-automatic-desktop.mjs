// Real Electron UI, isolated profile, synthetic signed loopback billing records.
// Never authenticates a real account or calls Stripe/Supabase.
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
import {generateKeyPairSync,sign} from 'node:crypto'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {_electron,expect}=await import('../billing/node_modules/@playwright/test/index.mjs')
const keys=generateKeyPairSync('ed25519'),DAY=86400000
let state='trial',requests=0,checkouts=0,fail=false
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json')
 if(req.headers.authorization!=='Bearer synthetic-account-token'){res.writeHead(401).end('{}');return}
 if(req.url==='/api/checkout'){checkouts++;res.end(JSON.stringify({confirming:true}));return}
 if(req.url==='/api/status'){
  requests++;if(fail){res.writeHead(503).end('{}');return}
  const now=Date.now(),until=['trial','paid','cancelling'].includes(state)?now+DAY:0
  const claims={issuer:'terminal-buddy-test',audience:'terminal-buddy-desktop',subject:'synthetic-account',state,verifiedAt:now,accessUntil:until,offlineUntil:until}
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url')
  res.end(JSON.stringify({state,email:'sample@example.invalid',accountId:'synthetic-account',trialEndsAt:now+DAY,accessUntil:until,customer:true,entitlement:{payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64url')}}));return
 }
 res.end('{}')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port
const root=mkdtempSync(join(tmpdir(),'buddy-auto-test-')),profile=join(root,'profile'),home=join(root,'home')
mkdirSync(profile);mkdirSync(home);mkdirSync('artifacts/account-automatic',{recursive:true})
writeFileSync(join(profile,'settings.json'),JSON.stringify({walkthroughVersion:1,trayIcon:false,desktopNotifications:false,defaultShellId:'cmd'}))
const env={...process.env,HOME:home,USERPROFILE:home,BUDDY_BILLING_DEV_ORIGIN:origin,BUDDY_BILLING_DEV_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'})};delete env.ELECTRON_RUN_AS_NODE
const launch=()=>_electron.launch({executablePath:require('electron'),args:[resolve('out/main/index.js'),'--user-data-dir='+profile],env,timeout:30000})
let app
try{
 app=await launch();await app.firstWindow()
 const encrypted=await app.evaluate(({safeStorage})=>{
  if(!safeStorage.isEncryptionAvailable())throw Error('OS secure storage is required for this isolated test')
  return safeStorage.encryptString(JSON.stringify({token:'synthetic-account-token',record:null,highestWall:0})).toString('base64')
 })
 writeFileSync(join(profile,'buddy-account.secure'),Buffer.from(encrypted,'base64'))
 await app.close();app=await launch()
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.buddy)
 await expect(page.locator('dialog.new-session-dialog')).toBeVisible({timeout:10000})
 await page.keyboard.press('Escape');await page.locator('button[title^="Settings"]').click()
 await expect(page.getByRole('heading',{name:'Your trial is active',exact:true})).toBeVisible()
 await page.screenshot({path:'artifacts/account-automatic/trial.png'})
 await page.getByRole('checkbox',{name:'I understand the recurring charge and cancellation.'}).check()
 await page.getByRole('button',{name:'Subscribe — $6/month, charged today',exact:true}).click()
 await expect(page.locator('.account-sync')).toContainText('Checking billing automatically')
 await page.screenshot({path:'artifacts/account-automatic/pending.png'})
 assert.equal(checkouts,1);state='paid'
 await expect(page.getByRole('heading',{name:'Subscription active',exact:true})).toBeVisible({timeout:20000})
 await expect(page.locator('.account-sync')).toContainText('Subscription confirmed')
 await expect(page.getByRole('button',{name:'Manage billing',exact:true})).toBeVisible()
 await page.screenshot({path:'artifacts/account-automatic/paid.png'})
 assert.ok(requests>=2)
 state='cancelling';await app.evaluate(({app,BrowserWindow})=>app.emit('browser-window-focus',{},BrowserWindow.getAllWindows()[0])); // Throttled focus; next eligible focus verifies.
 await new Promise(r=>setTimeout(r,16000));await app.evaluate(({app,BrowserWindow})=>app.emit('browser-window-focus',{},BrowserWindow.getAllWindows()[0]))
 await expect(page.getByRole('heading',{name:'Cancellation scheduled',exact:true})).toBeVisible({timeout:10000})
 await page.screenshot({path:'artifacts/account-automatic/cancelling.png'})
 fail=true;await page.getByRole('button',{name:'Check again',exact:true}).click()
 await expect(page.locator('.account-sync')).toContainText('Offline')
 await expect(page.getByRole('heading',{name:'Cancellation scheduled',exact:true})).toBeVisible()
 fail=false;state='expired';await page.getByRole('button',{name:'Check again',exact:true}).click()
 await expect(page.locator('.settings').getByRole('heading',{name:'Your trial or paid access has ended',exact:true})).toBeVisible()
 await page.screenshot({path:'artifacts/account-automatic/expired.png'})
 console.log('PASS real Electron automatic pending-to-paid without refresh, focus reconciliation, all account views update, offline access retained, manual fallback. Billing provider is a synthetic signed loopback fixture.')
}finally{if(app)await app.close();await new Promise(r=>server.close(r))}
