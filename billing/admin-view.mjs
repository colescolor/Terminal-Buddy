const labels={eligible:'Trial available',trial:'Active trial',paid:'Paid',cancelling:'Cancellation scheduled',past_due:'Payment grace',expired:'Expired',confirming:'Confirming payment'}
const date=n=>n?new Date(n).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—'
const byId=id=>document.getElementById(id)
export function message(text,error=false){byId('status').textContent=text;byId('status').dataset.error=String(error)}
export function clearDashboard(){byId('dashboard').hidden=true;byId('retry').hidden=true;byId('accounts').replaceChildren();for(const id of ['total','trial','paid','expired'])byId(id).textContent='0'}
export function renderOverview(data){
 byId('dashboard').hidden=false
 byId('total').textContent=data.total;byId('trial').textContent=data.totals.trial;byId('paid').textContent=data.totals.paid+data.totals.cancelling;byId('expired').textContent=data.totals.expired
 byId('as-of').textContent='Database read '+date(data.asOf)
 byId('result-count').textContent=data.matched+' matching account'+(data.matched===1?'':'s')
 byId('empty').hidden=data.accounts.length!==0
 const rows=data.accounts.map(account=>{
  const row=document.createElement('tr')
  for(const [label,value] of [['Account',account.email],['Access',labels[account.state]||'Unknown'],['Trial ends',date(account.trialEndsAt)],['Paid through',date(account.paidThrough)],['Last Stripe check',date(account.lastSyncedAt)],['Billing','']]){
   const cell=document.createElement('td');cell.dataset.label=label
   if(label==='Access'){const badge=document.createElement('span');badge.className='badge';badge.dataset.state=account.state;badge.textContent=value;cell.append(badge)}
   else if(label==='Billing'){
    if(typeof account.stripeUrl==='string'&&/^https:\/\/dashboard\.stripe\.com\/test\/customers\/cus_[A-Za-z0-9]+$/.test(account.stripeUrl)){
     const link=document.createElement('a');link.href=account.stripeUrl;link.textContent='Open Stripe';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open Stripe for '+account.email);cell.append(link)
    }else cell.textContent='No billing account'
   }else cell.textContent=value
   if(label==='Access'&&account.subscriptionStatus){const sub=document.createElement('span');sub.className='subtle';sub.textContent='Stripe: '+account.subscriptionStatus;cell.append(sub)}
   row.append(cell)
  }
  return row
 })
 byId('accounts').replaceChildren(...rows)
 byId('page-label').textContent='Page '+(data.page+1)+' of '+Math.max(1,Math.ceil(data.matched/data.pageSize))
 byId('previous').disabled=data.page===0;byId('next').disabled=(data.page+1)*data.pageSize>=data.matched
}
export function dashboardController(load){
 let page=0,generation=0,last=null
 const refresh=async(reset=false)=>{
  if(reset)page=0
  const current=++generation
  byId('retry').hidden=true
  for(const id of ['refresh','previous','next'])byId(id).disabled=true
  message('Loading account records…')
  try{
   const data=await load({search:byId('search').value,state:byId('state').value,page})
   if(current!==generation)return
   last=data;renderOverview(data);message('Signed in as '+data.ownerEmail+'. Read-only test environment.')
  }catch(error){if(current===generation){last=null;clearDashboard();byId('retry').hidden=false;message(error.message||'Unable to load records.',true)}}
  finally{if(current===generation){byId('refresh').disabled=false;if(last){byId('previous').disabled=page===0;byId('next').disabled=(page+1)*last.pageSize>=last.matched}}}
 }
 byId('filters').onsubmit=e=>{e.preventDefault();void refresh(true)}
 byId('refresh').onclick=()=>void refresh()
 byId('retry').onclick=()=>void refresh()
 byId('previous').onclick=()=>{page=Math.max(0,page-1);void refresh()}
 byId('next').onclick=()=>{page++;void refresh()}
 return {refresh,clear(){generation++;last=null;page=0;clearDashboard()}}
}
