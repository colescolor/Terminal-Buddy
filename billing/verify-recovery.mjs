import {chromium,expect} from '@playwright/test'
import {readFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const origin='https://billing.example.invalid'
const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.')
let records=[],otpCalls=0,rateLimited=false
try{
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(u.hostname==='billing.example.invalid'){
   if(u.pathname==='/api/config')return route.fulfill({json:{origin,supabaseUrl:'https://auth.example.invalid',supabaseKey:'publishable-fixture'}})
   if(u.pathname==='/api/recovery/mine'||u.pathname==='/api/admin/recovery/list')return route.fulfill({json:{requests:records}})
   if(u.pathname==='/api/recovery/request'){
    const b=req.postDataJSON();records=[{id:'11111111-1111-4111-8111-111111111111',originalEmail:b.originalEmail,contactEmail:'reachable@example.invalid',reason:b.reason,status:'open',reply:'',revision:0}]
    return route.fulfill({json:{request:records[0]}})
   }
   if(u.pathname==='/api/admin/recovery/review'){const b=req.postDataJSON();Object.assign(records[0],b,{revision:1});return route.fulfill({json:{request:records[0]}})}
   if(u.pathname==='/api/admin/overview')return route.fulfill({json:{total:0,totals:{trial:0,paid:0,cancelling:0,expired:0},accounts:[],matched:0,page:0,pageSize:50,ownerEmail:'owner@example.invalid',asOf:Date.now()}})
   const files={'/recovery/':'public/recovery/index.html','/recovery.js':'public/recovery.js','/account.css':'public/account.css','/admin/':'public/admin/index.html','/admin.js':'public/admin.js','/admin.css':'public/admin.css'}
   if(files[u.pathname])return route.fulfill({body:await readFile(files[u.pathname]),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'})
  }
  if(u.hostname==='auth.example.invalid'){
   if(u.pathname.endsWith('/otp')){otpCalls++;return route.fulfill(rateLimited?{status:429,json:{code:'over_email_send_rate_limit',msg:'fixture'}}:{json:{}})}
   if(u.pathname.endsWith('/verify'))return route.fulfill({json:{access_token:jwt,refresh_token:'fixture',token_type:'bearer',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'reachable@example.invalid',email_confirmed_at:new Date().toISOString()}}})
   if(u.pathname.endsWith('/logout'))return route.fulfill({status:204})
  }
  return route.abort()
 })
 const login=async(label='Verify email')=>{await page.getByLabel('Email address',{exact:true}).fill('reachable@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click();await page.getByLabel('Email verification code').fill('12345678');await page.getByRole('button',{name:label,exact:true}).click()}
 await page.goto(origin+'/recovery/');await login()
 await expect(page.locator('#recovery-panel')).toBeVisible()
 await page.getByLabel('Original account email').fill('lost@example.invalid');await page.getByLabel('What happened?').fill('<img src=x onerror=alert(1)> lost inbox')
 await page.getByRole('button',{name:'Submit recovery request'}).click();await expect(page.locator('#status')).toContainText('Request received');await expect(page.locator('#request-form')).toBeHidden()
 await mkdir('../artifacts/recovery-screenshots',{recursive:true})
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'../artifacts/recovery-screenshots/request-'+width+'.png',fullPage:true})}
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#requests')).toBeEmpty();assert.equal(await page.evaluate(()=>localStorage.length),0)
 await page.goto(origin+'/admin/');await login('Verify and continue');await expect(page.locator('#recovery-inbox')).toBeVisible();await expect(page.locator('#recovery-rows img')).toHaveCount(0)
 await page.getByLabel('Private reply to requester').fill('Please retain access to this inbox while we review. No account transfer has occurred.')
 await page.getByRole('button',{name:'Send reply / mark under review',exact:true}).click();await expect(page.locator('#recovery-rows')).toContainText('Status: review')
 await page.setViewportSize({width:390,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'../artifacts/recovery-screenshots/admin-390.png',fullPage:true})
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#recovery-rows')).toBeEmpty()
 await page.goto(origin+'/recovery/');await login();await expect(page.locator('#requests')).toContainText('No account transfer has occurred')
 await page.goto(origin+'/recovery/');rateLimited=true
 await page.getByLabel('Email address',{exact:true}).fill('reachable@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click()
 await expect(page.locator('#status')).toContainText('Too many code requests');await expect(page.locator('#email-form button').first()).toBeDisabled()
 const calls=otpCalls;await page.locator('#email-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(otpCalls,calls)
 assert.deepEqual(errors,[])
 console.log('PASS recovery intake, private reply, identity-code UX, cooldown/429, no HTML injection, sign-out clearing, no local token persistence, 390/768/1440 layouts. Provider responses mocked; no email or recovery request sent.')
}finally{await browser.close()}
