import {createPrivateKey} from 'node:crypto'
import {ownerIds} from './admin.mjs'
import {databaseConnection} from './connection.mjs'
import {notificationIssues} from './subscriber-alerts.mjs'
import {billingMode} from './mode.mjs'
import {databaseSchema} from './schema.mjs'
export function configurationIssues(env){
 const issues=notificationIssues(env)
 try{databaseSchema(env)}catch(error){issues.push(error.message)}
 for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_MONTHLY_PRICE_ID','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','DATABASE_URL','BILLING_ORIGIN','ENTITLEMENT_PRIVATE_KEY'])if(!env[name]?.trim())issues.push(name+': missing')
 if(env.STRIPE_SECRET_KEY)try{billingMode(env)}catch{issues.push('STRIPE_SECRET_KEY: billing mode mismatch or production build is not approved')}
 if(env.STRIPE_WEBHOOK_SECRET&&!/^whsec_[A-Za-z0-9_]+$/.test(env.STRIPE_WEBHOOK_SECRET))issues.push('STRIPE_WEBHOOK_SECRET: invalid format')
 if(env.STRIPE_MONTHLY_PRICE_ID&&!/^price_[A-Za-z0-9]+$/.test(env.STRIPE_MONTHLY_PRICE_ID))issues.push('STRIPE_MONTHLY_PRICE_ID: invalid format')
 if(env.STRIPE_PORTAL_CONFIGURATION_ID&&!/^bpc_[A-Za-z0-9]+$/.test(env.STRIPE_PORTAL_CONFIGURATION_ID))issues.push('STRIPE_PORTAL_CONFIGURATION_ID: invalid format')
 for(const name of ['BILLING_ORIGIN','SUPABASE_URL'])if(env[name]){try{
  const u=new URL(env[name]);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||['localhost','127.0.0.1'].includes(u.hostname)||u.hostname.endsWith('.invalid'))throw Error()
 }catch{issues.push(name+': use an actual HTTPS origin without path, query or credentials')}}
 if(env.SUPABASE_PUBLISHABLE_KEY){try{
  const key=env.SUPABASE_PUBLISHABLE_KEY
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)&&JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role!=='anon')throw Error()
 }catch{issues.push('SUPABASE_PUBLISHABLE_KEY: use a publishable/anon key, never a secret/service-role key')}}
 if(env.DATABASE_URL){try{const u=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||!u.username||!u.password||!['require','verify-full','verify-ca'].includes(u.searchParams.get('sslmode')))throw Error()}catch{issues.push('DATABASE_URL: use a server Postgres URL with credentials and TLS (sslmode=require or verify-full/verify-ca)')}}
 if(env.ENTITLEMENT_PRIVATE_KEY){try{if(createPrivateKey(env.ENTITLEMENT_PRIVATE_KEY.replaceAll('\\n','\n')).asymmetricKeyType!=='ed25519')throw Error()}catch{issues.push('ENTITLEMENT_PRIVATE_KEY: valid Ed25519 PKCS8 key required')}}
 if(env.DATABASE_CA_CERT){try{databaseConnection(env)}catch{issues.push('DATABASE_CA_CERT: valid CA and verify-full database URL required')}}
 if(env.OWNER_USER_IDS){try{ownerIds(env.OWNER_USER_IDS)}catch{issues.push('OWNER_USER_IDS: use verified Supabase user UUIDs')}}
 for(const [name,fallback] of [['OFFLINE_DAYS',7],['PAST_DUE_GRACE_DAYS',3]]){const value=Number(env[name]??fallback);if(!Number.isInteger(value)||value<0||value>7)issues.push(name+': expected an integer from 0 to 7')}
 return issues
}
