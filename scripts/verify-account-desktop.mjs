import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {_electron,expect}=await import('../billing/node_modules/@playwright/test/index.mjs')
const root=mkdtempSync(join(tmpdir(),'buddy-account-test-')),profile=join(root,'profile'),home=join(root,'home')
mkdirSync(profile);mkdirSync(home);mkdirSync('artifacts',{recursive:true})
writeFileSync(join(profile,'settings.json'),JSON.stringify({walkthroughVersion:1,trayIcon:false,desktopNotifications:false,defaultShellId:'cmd'}))
const env={...process.env,HOME:home,USERPROFILE:home};delete env.ELECTRON_RUN_AS_NODE;delete env.BUDDY_BILLING_DEV_ORIGIN
const app=await _electron.launch({executablePath:require('electron'),args:['out/main/index.js','--user-data-dir='+profile],env,timeout:30000})
try{
 const page=await app.firstWindow()
 await page.waitForFunction(()=>!!window.buddy)
 assert.equal((await page.evaluate(()=>window.buddy.account.status())).state,'free')
 await page.keyboard.press('Escape')
 await page.locator('button[title^="Settings"]').click()
 await expect(page.getByRole('heading',{name:'Free edition',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Third-party licenses',exact:true}).click()
 await expect(page.locator('.account-notices')).toContainText('Meta Platforms')
 await expect(page.locator('.account-notices')).toContainText('Paul Henschel')
 await page.screenshot({path:'artifacts/account-desktop-free.png',fullPage:true})
 await page.keyboard.press('Escape')
 const id=await page.evaluate(async()=>{const list=await window.buddy.shells.list();const shell=list.find(x=>x.id==='cmd')||list[0];const s=await window.buddy.pty.create({shellId:shell.id});return s.id})
 await page.evaluate(id=>{window.accountOutput='';window.buddy.pty.onData((session,data)=>{if(session===id)window.accountOutput+=data})},id)
 await page.evaluate(()=>window.buddy.account.action('signOut'))
 await page.evaluate(id=>window.buddy.pty.write(id,'echo BUDDY_ACCOUNT_SIGNOUT_OK\r'),id)
 await page.waitForFunction(()=>window.accountOutput?.includes('BUDDY_ACCOUNT_SIGNOUT_OK'))
 const secure=await app.evaluate(({safeStorage})=>({available:safeStorage.isEncryptionAvailable(),backend:process.platform==='linux'?safeStorage.getSelectedStorageBackend():process.platform}))
 console.log('PASS real Electron free account, license viewer, sign-out preserves running PTY; secure-storage capability:',JSON.stringify(secure))
 await page.evaluate(id=>window.buddy.pty.kill(id),id)
}finally{await app.close()}
