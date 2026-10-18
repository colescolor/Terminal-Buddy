import {chromium,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture-signature'].join('.')
 let approved=false,otpSent=false,available=true,expiredOnApprove=false,approveCalls=0
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url())
  if(u.hostname==='billing.example.invalid'){
   if(u.pathname==='/api/config')return route.fulfill({json:{origin:u.origin,supabaseUrl:'https://auth.example.invalid',supabaseKey:'publishable-fixture'}})
   if(u.pathname==='/api/device/check')return route.fulfill({json:{available}})
   if(u.pathname==='/api/device/approve'){approveCalls++;await new Promise(r=>setTimeout(r,100));const body=route.request().postDataJSON();approved=body.id==='fixture-device'&&body.state==='fixture-state'&&route.request().headers().authorization==='Bearer '+jwt;return route.fulfill({status:expiredOnApprove?409:200,json:expiredOnApprove?{error:'Sign-in request expired or already used.'}:{approved}})}
   const map={'/account/':'public/account/index.html','/account.js':'public/account.js','/account.css':'public/account.css'}
   if(map[u.pathname])return route.fulfill({body:await readFile(map[u.pathname]),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'})
  }
  if(u.hostname==='auth.example.invalid'){
   if(u.pathname.endsWith('/otp')){otpSent=true;return route.fulfill({json:{}})}
   if(u.pathname.endsWith('/verify'))return route.fulfill({json:{access_token:jwt,refresh_token:'local-fixture-refresh-token',token_type:'bearer',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'alex@example.invalid',email_confirmed_at:new Date().toISOString()}}})
   if(u.pathname.endsWith('/logout'))return route.fulfill({status:204})
  }
  return route.abort()
 })
 await page.goto('http://billing.example.invalid/account/?device=fixture-device&state=fixture-state')
 await page.getByLabel('Email address').fill('alex@example.invalid')
 await page.getByRole('button',{name:'Send sign-in code'}).click()
 await expect(page.getByLabel('Email verification code')).toBeVisible()
 const sendBox=await page.locator('#email-form button').first().boundingBox(),codeBox=await page.getByLabel('Email verification code').boundingBox()
 await expect(page.locator('#email-form button').first()).toBeDisabled()
 await expect(page.getByLabel('Email address')).toHaveAttribute('readonly','')
 if(codeBox.y<sendBox.y+sendBox.height+16)throw Error('Verification steps lack spacing')
 await page.getByLabel('Email verification code').fill('123456')
 await page.getByRole('button',{name:'Verify email'}).click()
 await expect(page.getByRole('button',{name:'Connect this Terminal Buddy session'})).toBeVisible()
 await expect(page.locator('#code-form')).toBeHidden()
 await expect(page.locator('#email-form')).toBeHidden()
 await page.getByRole('button',{name:'Connect this Terminal Buddy session'}).click()
 await expect(page.locator('#status')).toContainText('Device connected')
 if(!approved||!otpSent||errors.length)throw Error('Account browser flow failed: '+errors.join(';'))
 available=false;otpSent=false
 await page.goto('http://billing.example.invalid/account/?device=fixture-device&state=fixture-state')
 await expect(page.locator('#status')).toContainText('expired or was already used')
 await expect(page.locator('#email-form')).toBeHidden();if(otpSent)throw Error('Expired link sent email')
 available=true;expiredOnApprove=true;approveCalls=0
 await page.goto('http://billing.example.invalid/account/?device=fixture-device&state=fixture-state')
 await page.getByLabel('Email address').fill('alex@example.invalid')
 await page.getByRole('button',{name:'Send sign-in code'}).click()
 await page.getByLabel('Email verification code').fill('123456')
 await page.getByRole('button',{name:'Verify email'}).click()
 await expect(page.locator('#approve')).toBeVisible()
 await page.locator('#approve').evaluate(button=>{button.click();button.click()})
 await expect(page.locator('#status')).toContainText('expired or was already used')
 await expect(page.locator('#approve')).toBeHidden()
 if(approveCalls!==1)throw Error('Duplicate approval was sent')
 available=true;expiredOnApprove=false
 await page.goto('http://billing.example.invalid/account/')
 await page.getByLabel('Email address').fill('wrong@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click()
 await page.getByRole('button',{name:'Use a different email'}).click()
 await expect(page.locator('#code-form')).toBeHidden();await expect(page.getByLabel('Email address')).not.toHaveAttribute('readonly','')
 await page.getByLabel('Email address').fill('right@example.invalid');await page.getByRole('button',{name:'Send sign-in code'}).click()
 await expect(page.locator('#status')).toContainText('right@example.invalid')
 for(const outcome of ['return','cancel']){
  await page.goto('http://billing.example.invalid/account/?checkout='+outcome)
  await expect(page.getByRole('heading',{name:'Return to Terminal Buddy'})).toBeVisible()
  await expect(page.locator('#email-form')).toBeHidden()
  await expect(page.locator('#status')).toContainText(outcome==='return'?'checks payment automatically':'does not establish payment status')
 }
 console.log('PASS mocked browser OTP, step spacing, expired links, duplicate clicks and truthful Checkout return/cancel pages. No email sent or real authentication claimed.')
}finally{await browser.close()}
