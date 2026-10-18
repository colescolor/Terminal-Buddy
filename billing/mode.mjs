import {release} from './release-config.mjs'
export function billingMode(env,approved=release){
 const mode=env.BILLING_MODE||'test'
 if(!['test','live'].includes(mode))throw Error('BILLING_MODE must be test or live.')
 if(!new RegExp('^(sk|rk)_'+mode+'_[A-Za-z0-9_]+$').test(env.STRIPE_SECRET_KEY||''))throw Error('Stripe key does not match the selected billing mode.')
 if(mode==='live'){
  if(approved.liveApproved!==true)throw Error('Live payments require an approved production build.')
  for(const [field,variable] of [['billingOrigin','BILLING_ORIGIN'],['supabaseOrigin','SUPABASE_URL']]){
   let url;try{url=new URL(approved[field])}catch{throw Error('Approved production origins are missing.')}
   if(url.protocol!=='https:'||url.origin!==approved[field]||url.hostname.includes('test')||url.hostname.endsWith('.invalid')||env[variable]!==approved[field])throw Error('Production origin does not match the approved build.')
  }
  if(!/^acct_[A-Za-z0-9]+$/.test(approved.stripeAccountId))throw Error('Approved Stripe account is missing.')
 }
 return {live:mode==='live',name:mode,issuer:mode==='live'?'terminal-buddy':'terminal-buddy-test',accountId:mode==='live'?approved.stripeAccountId:null}
}
