import {chromium,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture-signature'].join('.')
 let approved=false,otpSent=false
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url())
  if(u.hostname==='billing.example.invalid'){
   if(u.pathname==='/api/config')return route.fulfill({json:{origin:u.origin,supabaseUrl:'https://auth.example.invalid',supabaseKey:'publishable-fixture'}})
   if(u.pathname==='/api/device/approve'){const body=route.request().postDataJSON();approved=body.id==='fixture-device'&&body.state==='fixture-state'&&route.request().headers().authorization==='Bearer '+jwt;return route.fulfill({json:{approved}})}
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
 await page.getByLabel('Email verification code').fill('123456')
 await page.getByRole('button',{name:'Verify email'}).click()
 await expect(page.getByRole('button',{name:'Connect this Terminal Buddy session'})).toBeVisible()
 await page.getByRole('button',{name:'Connect this Terminal Buddy session'}).click()
 await expect(page.locator('#status')).toContainText('Device connected')
 if(!approved||!otpSent||errors.length)throw Error('Account browser flow failed: '+errors.join(';'))
 console.log('PASS actual Supabase browser SDK flow with intercepted fictional OTP/session responses; no email sent and no real authentication claimed.')
}finally{await browser.close()}
