import {chromium,expect} from '@playwright/test'
import {readFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
await mkdir('../artifacts/owner-screenshots',{recursive:true})
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4318/owner-preview/')
  await expect(page.locator('#accounts tr')).toHaveCount(7)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow at '+width)
  await page.screenshot({path:'../artifacts/owner-screenshots/owner-'+width+'.png',fullPage:true})
 }
 const total=await page.locator('#total').textContent()
 await page.getByRole('combobox').selectOption('expired');await page.getByRole('button',{name:'Apply filters'}).click()
 await expect(page.locator('#accounts tr')).toHaveCount(1);await expect(page.locator('#total')).toHaveText(total)
 await page.getByLabel('Find an email').fill('nothing@example.invalid');await page.getByRole('button',{name:'Apply filters'}).click();await expect(page.locator('#empty')).toBeVisible()
 // Exercise the real compiled owner page + Supabase SDK without sending email or contacting providers.
 const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.')
 const sample=await (await fetch('http://127.0.0.1:4318/api/admin/overview',{method:'POST',headers:{Authorization:'Bearer verified-fixture'},body:'{}'})).json()
 sample.accounts[0].email='<img src=x onerror=alert(1)>@example.invalid'
 let deny=false,unavailable=false,otp=false
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url())
  if(u.hostname==='billing.example.invalid'){
   if(u.pathname==='/api/config')return route.fulfill({json:{origin:u.origin,supabaseUrl:'https://auth.example.invalid',supabaseKey:'publishable-fixture'}})
   if(u.pathname==='/api/admin/access')return route.fulfill({status:deny?403:200,json:deny?{error:'This account does not have owner access.'}:{mfaRequired:false}})
   if(u.pathname==='/api/admin/overview'){
    assert.equal(req.headers().authorization,'Bearer '+jwt)
    return route.fulfill({status:deny?403:unavailable?503:200,json:deny||unavailable?{error:'Denied'}:sample})
   }
   const files={'/admin/':['public/admin/index.html','text/html'],'/admin.js':['public/admin.js','text/javascript'],'/admin.css':['public/admin.css','text/css']}
   if(files[u.pathname])return route.fulfill({body:await readFile(files[u.pathname][0]),contentType:files[u.pathname][1]})
  }
  if(u.hostname==='auth.example.invalid'){
   if(u.pathname.endsWith('/otp')){otp=true;assert.equal(req.postDataJSON().create_user,false);return route.fulfill({json:{}})}
   if(u.pathname.endsWith('/verify'))return route.fulfill({json:{access_token:jwt,refresh_token:'fixture',token_type:'bearer',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'owner@example.invalid',email_confirmed_at:new Date().toISOString()}}})
   if(u.pathname.endsWith('/logout'))return route.fulfill({status:204})
  }
  return route.abort()
 })
 await page.goto('https://billing.example.invalid/admin/')
 await expect(page.locator('#dashboard')).toBeHidden()
 const login=async()=>{await page.getByLabel('Email address',{exact:true}).fill('owner@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click();await page.getByLabel('Email verification code').fill('123456');await page.getByRole('button',{name:'Verify and continue'}).click()}
 await login();await expect(page.locator('#accounts tr')).toHaveCount(7);assert.ok(otp)
 assert.equal(await page.locator('#accounts img').count(),0,'Account text cannot inject HTML')
 assert.equal(await page.evaluate(()=>localStorage.length),0,'No persisted owner token')
 unavailable=true;await page.getByRole('button',{name:'Refresh records'}).click();await expect(page.locator('#accounts tr')).toHaveCount(0);await expect(page.getByRole('button',{name:'Retry loading records'})).toBeVisible()
 unavailable=false;await page.getByRole('button',{name:'Retry loading records'}).click();await expect(page.locator('#accounts tr')).toHaveCount(7)
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#accounts tr')).toHaveCount(0);await expect(page.locator('#dashboard')).toBeHidden()
 deny=true;await login();await expect(page.locator('#status')).toContainText('does not have owner access');await expect(page.locator('#dashboard')).toBeHidden()
 assert.deepEqual(errors,[])
 console.log('PASS owner layouts 390/768/1440, filters, empty state, real SDK login with intercepted responses, no HTML injection/token persistence, outage retry, sign-out, non-owner denial.')
}finally{await browser.close()}
