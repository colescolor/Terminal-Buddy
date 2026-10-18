// Opt-in external TEST-only workflow. Uses a fresh fictional customer, never the owner.
import Stripe from 'stripe'
import {chromium,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {stripeGateway} from './stripe.mjs'
const env=process.env,run=randomUUID(),report={run,mode:'test',checks:[],complete:false}
let stripe,browser,customer,checkout,page
try{
 if(!process.argv.includes('--run-test')||!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')||env.BILLING_ORIGIN!=='https://terminal-buddy-billing-test.netlify.app')throw Error('Explicit approved sandbox configuration required')
 stripe=new Stripe(env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:1})
 const gateway=stripeGateway(env);await gateway.validatePrice()
 customer=await stripe.customers.create({email:'hosted-'+run+'@example.invalid',name:'Terminal Buddy sandbox QA',metadata:{terminal_buddy_qa:run}})
 checkout=await gateway.checkout({id:run},{customerId:customer.id},env.BILLING_ORIGIN)
 if(checkout.livemode)throw Error('Unexpected live session')
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1280,height:900}})
 report.networkFailures=[]
 page.on('requestfailed',request=>{report.networkFailures.push({host:new URL(request.url()).hostname,error:request.failure()?.errorText})})
 await page.goto(checkout.url,{waitUntil:'domcontentloaded',timeout:45000})
 // Stripe's accordion button has a zero-size box with an expanded pseudo-element
 // over the visible label. Click the visible label's center through that overlay.
 await page.getByText('Card',{exact:true}).click({timeout:20000,force:true})
 await page.getByPlaceholder('1234 1234 1234 1234').fill('4000000000003220',{timeout:20000})
 await page.getByPlaceholder('MM / YY').fill('1234')
 await page.getByPlaceholder('CVC').fill('123')
 await page.getByLabel('Cardholder name').fill('Terminal Buddy sandbox QA')
 const zip=page.getByPlaceholder('ZIP');if(await zip.count())await zip.fill('78701')
 await page.locator('input[name="enableStripePass"]').uncheck()
 await page.getByRole('button',{name:/Subscribe/}).click()
 let authenticated=false
 for(let attempt=0;attempt<40&&!authenticated;attempt++){
  for(const frame of page.frames()){
   const complete=frame.getByRole('button',{name:/^Complete$/i})
   if(await complete.isVisible().catch(()=>false)){
    await new Promise(r=>setTimeout(r,1000));await complete.click();await new Promise(r=>setTimeout(r,1500))
    if(await complete.isVisible().catch(()=>false))await complete.click()
    authenticated=true;break
   }
  }
  if(!authenticated)await new Promise(r=>setTimeout(r,500))
 }
 if(!authenticated)throw Error('Sandbox authentication challenge was not available; inspect the saved test screenshot.')
 await expect.poll(async()=> (await stripe.checkout.sessions.retrieve(checkout.id)).payment_status,{timeout:30000}).toBe('paid')
 report.checks.push('Hosted 3DS test checkout paid after simulated authentication')
 const subscriptions=await stripe.subscriptions.list({customer:customer.id,status:'active'})
 if(subscriptions.data.length!==1)throw Error('Expected one fresh test subscription')
 const subscription=subscriptions.data[0]
 const portal=await gateway.portal(customer.id)
 await page.goto(portal.url,{waitUntil:'domcontentloaded'})
 await page.getByRole('link',{name:'Cancel subscription',exact:true}).click()
 await new Promise(r=>setTimeout(r,1000))
 await page.getByRole('button',{name:/Cancel subscription/i}).click()
 await expect.poll(async()=> {const s=await stripe.subscriptions.retrieve(subscription.id);report.cancellation={status:s.status,cancelAtPeriodEnd:s.cancel_at_period_end,cancelAt:s.cancel_at,periodEnd:s.items.data[0]?.current_period_end};return s.cancel_at_period_end||s.cancel_at===s.items.data[0]?.current_period_end},{timeout:20000}).toBe(true)
 report.checks.push('Hosted customer portal schedules cancellation through paid-through date')
 const snapshot=await gateway.snapshot(customer.id)
 if(!snapshot.cancelAtPeriodEnd||snapshot.paidThrough!==report.cancellation.periodEnd*1000)throw Error('Application adapter did not preserve scheduled cancellation and paid-through access')
 report.checks.push('Application adapter recognizes portal cancellation and preserves paid-through access')
 report.complete=true
}catch(error){
 if(stripe&&customer){const list=await stripe.paymentIntents.list({customer:customer.id,limit:3});report.paymentStates=list.data.map(p=>({status:p.status,action:p.next_action?.type,error:p.last_payment_error?.code}))}
 if(page){await mkdir('../artifacts/hosted-sandbox',{recursive:true});await page.screenshot({path:'../artifacts/hosted-sandbox/'+run+'.png'});report.screenshot='../artifacts/hosted-sandbox/'+run+'.png';await writeFile('.local/hosted-form.json',JSON.stringify(await page.locator('input,button').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,type:n.type,name:n.name,placeholder:n.placeholder,label:n.getAttribute('aria-label'),text:n.tagName==='BUTTON'?n.innerText:undefined}))),null,2))}
 report.error=String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]').slice(0,700)
 process.exitCode=1
}finally{
 if(browser)await browser.close()
 if(stripe&&customer){
  try{for await(const sub of stripe.subscriptions.list({customer:customer.id,status:'all'})){if(!['canceled','incomplete_expired'].includes(sub.status))await stripe.subscriptions.cancel(sub.id)}
   if(checkout&&(await stripe.checkout.sessions.retrieve(checkout.id)).status==='open')await stripe.checkout.sessions.expire(checkout.id)
  }catch{report.cleanup='Review fresh QA customer '+customer.id}
 }
 await mkdir('.local',{recursive:true});await writeFile('.local/hosted-sandbox-'+run+'.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
}
