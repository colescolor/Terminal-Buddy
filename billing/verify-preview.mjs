import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
await mkdir('../artifacts/billing-screenshots',{recursive:true})
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1120,height:980}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 for(const state of ['trial','paid','expired','cancelling','past_due','confirming','unknown','free']){
  await page.goto('http://127.0.0.1:4318/?state='+state)
  await expect(page.locator('.account-card')).toBeVisible()
  await page.screenshot({path:'../artifacts/billing-screenshots/'+state+'.png',fullPage:true})
 }
 await page.goto('http://127.0.0.1:4318/?state=trial')
 const buy=page.getByRole('button',{name:'Subscribe — $6/month, charged today'})
 await expect(buy).toBeDisabled();await page.getByRole('checkbox').check();await expect(buy).toBeEnabled()
 await buy.click();await expect(page.getByRole('heading',{name:'Confirming subscription'})).toBeVisible()
 await page.goto('http://127.0.0.1:4318/?state=paid')
 await page.getByRole('button',{name:'Manage billing',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Manage billing',exact:true})).toBeVisible()
 await page.screenshot({path:'../artifacts/billing-screenshots/manage-billing.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.goto('http://127.0.0.1:4318/?state=trial')
 await expect(page.locator('.account-card')).toBeVisible()
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow')
 await page.screenshot({path:'../artifacts/billing-screenshots/mobile-trial.png',fullPage:true})
 if(errors.length)throw Error(errors.join('\n'))
 console.log('PASS 8 state previews, purchase consent, delayed confirmation, portal handoff preview, 390px layout; screenshots saved.')
}finally{await browser.close()}
