import {createRequire} from 'node:module'
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {_electron,expect}=await import('../billing/node_modules/@playwright/test/index.mjs')
const folder=await mkdtemp(resolve('billing/.local/login-welcome-')),profile=join(folder,'profile'),home=join(folder,'home')
await mkdir(profile);await mkdir(home)
await writeFile(join(profile,'settings.json'),JSON.stringify({walkthroughVersion:1,trayIcon:false,desktopNotifications:false,defaultShellId:'cmd'}))
const env={...process.env,HOME:home,USERPROFILE:home,BUDDY_BILLING_DEV_ORIGIN:'https://terminal-buddy-billing-test.netlify.app',BUDDY_BILLING_DEV_PUBLIC_KEY:await readFile('billing/.local/entitlement-public.pem','utf8')};delete env.ELECTRON_RUN_AS_NODE
const app=await _electron.launch({executablePath:require('electron'),args:['out/main/index.js','--user-data-dir='+profile],env})
try{
 const page=await app.firstWindow()
 await expect(page.getByRole('button',{name:'Login',exact:true})).toBeVisible()
 await expect(page.locator('.new-session-dialog')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Open something…',exact:true})).toHaveCount(0)
 const box=await page.getByRole('button',{name:'Login',exact:true}).boundingBox();assert.ok(box.height>=56&&box.width>=230)
 await mkdir('artifacts/billing-hosted',{recursive:true})
 await page.screenshot({path:'artifacts/billing-hosted/login-welcome.png'})
 await app.evaluate(({shell})=>{globalThis.testOpenedOrigin='';shell.openExternal=async url=>{globalThis.testOpenedOrigin=new URL(url).origin}})
 await page.getByRole('button',{name:'Login',exact:true}).click()
 await expect(page.getByRole('button',{name:'Finish login in your browser…'})).toBeVisible()
 for(let i=0;i<30;i++){if(await app.evaluate(()=>globalThis.testOpenedOrigin))break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(await app.evaluate(()=>globalThis.testOpenedOrigin),'https://terminal-buddy-billing-test.netlify.app')
 await page.evaluate(()=>window.buddy.account.action('signOut'))
 console.log('PASS: real Electron signed-out welcome shows large Login, no project chooser, and opens approved sign-in; isolated test flow canceled without creating an account.')
}finally{await app.close()}
