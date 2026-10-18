import {chromium,expect} from '@playwright/test'
import {readFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[]
const origin='https://billing.example.invalid',id='11111111-1111-4111-8111-111111111111'
let verified=false,enrolled=false,hasFactor=false,records=0,invalid=false
const user=()=>({id,email:'owner@example.invalid',email_confirmed_at:'2026-10-17',factors:hasFactor?[{id:'factor-fixture',factor_type:'totp',status:'verified'}]:[]})
const session=()=>({access_token:['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,aal:verified?'aal2':'aal1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.'),refresh_token:'fixture',token_type:'bearer',expires_in:3600,user:user()})
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(u.hostname==='billing.example.invalid'){
   if(u.pathname==='/api/config')return route.fulfill({json:{origin,supabaseUrl:'https://auth.example.invalid',supabaseKey:'publishable-fixture'}})
   if(u.pathname==='/api/admin/access')return route.fulfill({json:{mfaRequired:!verified}})
   if(u.pathname==='/api/admin/overview'){records++;assert.ok(verified);return route.fulfill({json:{total:0,totals:{trial:0,paid:0,cancelling:0,expired:0},accounts:[],matched:0,page:0,pageSize:50,ownerEmail:'owner@example.invalid',asOf:Date.now()}})}
   if(u.pathname==='/api/admin/recovery/list'){assert.ok(verified);return route.fulfill({json:{requests:[]}})}
   const files={'/admin/':'public/admin/index.html','/admin.js':'public/admin.js','/admin.css':'public/admin.css'}
   if(files[u.pathname])return route.fulfill({body:await readFile(files[u.pathname]),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'})
  }
  if(u.hostname==='auth.example.invalid'){
   if(u.pathname.endsWith('/otp'))return route.fulfill({json:{}})
   if(u.pathname==='/auth/v1/verify')return route.fulfill({json:session()})
   if(u.pathname.endsWith('/user'))return route.fulfill({json:user()})
   if(u.pathname==='/auth/v1/factors'){enrolled=true;return route.fulfill({json:{id:'factor-fixture',type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/><text x="12" y="110" fill="black">SYNTHETIC TEST QR</text></svg>',secret:'SYNTHETIC-TEST-KEY',uri:'otpauth://totp/fixture'}}})}
   if(u.pathname.endsWith('/challenge'))return route.fulfill({json:{id:'challenge-fixture',expires_at:9999999999}})
   if(u.pathname.endsWith('/factors/factor-fixture/verify')){
    if(invalid)return route.fulfill({status:422,json:{code:'mfa_verification_failed',msg:'Invalid code'}})
    verified=true;hasFactor=true;return route.fulfill({json:session()})
   }
   if(u.pathname.endsWith('/logout'))return route.fulfill({status:204})
  }
  return route.abort()
 })
 const login=async()=>{await page.getByLabel('Email address',{exact:true}).fill('owner@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click();await page.getByLabel('Email verification code').fill('12345678');await page.getByRole('button',{name:'Verify and continue'}).click()}
 await page.goto(origin+'/admin/');await login();await expect(page.locator('#mfa')).toBeVisible();assert.equal(records,0)
 await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();await expect(page.locator('#mfa-qr')).toBeVisible();assert.ok(enrolled)
 await page.waitForFunction(()=>document.getElementById('mfa-qr').complete&&document.getElementById('mfa-qr').naturalWidth===220)
 await mkdir('../artifacts/admin-mfa-screenshots',{recursive:true})
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'../artifacts/admin-mfa-screenshots/setup-'+width+'.png',fullPage:true})}
 invalid=true;await page.getByLabel('Authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify authenticator',exact:true}).click();await expect(page.locator('#status')).toContainText('could not be verified');assert.equal(records,0)
 invalid=false;await page.getByLabel('Authenticator code',{exact:true}).fill('654321');await page.getByRole('button',{name:'Verify authenticator',exact:true}).click();await expect(page.locator('#dashboard')).toBeVisible();assert.equal(records,1);await expect(page.locator('#mfa-secret')).toBeEmpty();assert.equal(await page.locator('#mfa-qr').getAttribute('src'),null)
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#dashboard')).toBeHidden();assert.equal(await page.evaluate(()=>localStorage.length),0)
 verified=false;await login();await expect(page.locator('#mfa-form')).toBeVisible();await expect(page.locator('#mfa-enroll')).toBeHidden();assert.equal(records,1)
 await page.getByLabel('Authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify authenticator',exact:true}).click();await expect(page.locator('#dashboard')).toBeVisible();assert.equal(records,2)
 assert.deepEqual(errors,[]);console.log('PASS MFA first enrollment, returning owner, invalid code, no pre-MFA records, secret clearing, sign-out, and 390/768/1440 layouts. Supabase responses mocked; no real factor enrolled.')
}finally{await browser.close()}
