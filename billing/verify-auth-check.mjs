import {chromium,expect} from '@playwright/test'
import {get} from 'node:http'
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage()
 let sends=0,verifies=0,lookups=0
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 const user={id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid',email_confirmed_at:'2026-10-17T00:00:00Z',aud:'authenticated'}
 const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture-signature'].join('.')
 await page.route('https://*.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname
  if(path.endsWith('/otp')){sends++;return route.fulfill({json:{}})}
  if(path.endsWith('/verify')){verifies++;return route.fulfill({json:{access_token:jwt,refresh_token:'fictional-local-test',token_type:'bearer',expires_in:3600,user}})}
  if(path.endsWith('/user')){lookups++;return route.fulfill({json:user})}
  if(path.endsWith('/logout'))return route.fulfill({status:204})
  return route.abort()
 })
 await page.goto('http://127.0.0.1:4319/')
 await expect(page.getByRole('heading',{name:'Test your sign-in email'})).toBeVisible()
 if(sends)throw Error('Email was requested without explicit action')
 for(let run=1;run<=2;run++){
  if(run===2){await page.getByRole('button',{name:'Sign out and test returning-user login'}).click();await page.clock.fastForward(61000)}
  else await page.clock.install()
  await page.getByLabel('Email address',{exact:true}).fill('test@example.invalid')
  await page.getByRole('button',{name:'Send sign-in code'}).click()
  await expect(page.getByLabel('Email verification code')).toBeVisible()
  await page.getByLabel('Email verification code').fill('123456')
  await page.getByRole('button',{name:'Verify email'}).click()
  await expect(page.locator('#status')).toContainText(`(${run} successful check`)
 }
 if(sends!==2||verifies!==2||lookups!==2||errors.length)throw Error('Auth check fixture flow failed')
 if(await page.evaluate(()=>localStorage.length||sessionStorage.length))throw Error('Persisted auth state')
 for(const path of ['/.env','/.local/auth-check-config.json','/api/checkout','/api/trial'])if((await page.request.get('http://127.0.0.1:4319'+path)).status()!==404)throw Error('Unexpected route exposed')
 const hostStatus=await new Promise((resolve,reject)=>get('http://127.0.0.1:4319/',{headers:{Host:'untrusted.invalid'}},response=>{response.resume();resolve(response.statusCode)}).on('error',reject))
 if(hostStatus!==403)throw Error('Unexpected Host accepted')
 await page.screenshot({path:'.local/auth-check-verified-fixture.png',fullPage:true})
 console.log('PASS local page: explicit send only, two mocked OTP verifications, returning login, no token storage, no billing routes, Host validation. Real SMTP delivery and user verification still require manual testing.')
}finally{await browser.close()}
