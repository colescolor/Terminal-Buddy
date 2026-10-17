import {dashboardController,message} from './admin-view.mjs'
document.querySelector('#sign-in').hidden=true
document.querySelector('.eyebrow').textContent='TERMINAL BUDDY · LOCAL OWNER PREVIEW · FICTIONAL ACCOUNTS'
document.querySelector('footer').textContent='Local sample records only. No real customers, email, Stripe account, or payment is connected.'
const board=dashboardController(async filters=>{
 const r=await fetch('/api/admin/overview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer verified-fixture'},body:JSON.stringify(filters)})
 if(!r.ok)throw Error('Local owner preview is unavailable.')
 return r.json()
})
void board.refresh()
