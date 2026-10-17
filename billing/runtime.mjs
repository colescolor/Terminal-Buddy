import {Pool} from 'pg'
import {createClient} from '@supabase/supabase-js'
import {createPrivateKey} from 'node:crypto'
import {postgres} from './db.mjs'
import {service} from './service.mjs'
import {stripeGateway} from './stripe.mjs'
import {handler} from './http.mjs'
export function runtime(env=process.env) {
 const origin=new URL(env.BILLING_ORIGIN)
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Configure an HTTPS billing origin.')
 if(!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.STRIPE_WEBHOOK_SECRET)throw Error('Billing environment is incomplete.')
 const privateKey=createPrivateKey(env.ENTITLEMENT_PRIVATE_KEY?.replaceAll('\\n','\n')||'')
 if(privateKey.asymmetricKeyType!=='ed25519')throw Error('Use an Ed25519 entitlement key.')
 const auth=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const db=postgres(new Pool({connectionString:env.DATABASE_URL,max:3,connectionTimeoutMillis:8000,statement_timeout:20000}))
 const api=service({db,stripe:stripeGateway(env),privateKey,origin:origin.origin,
  offlineDays:Number(env.OFFLINE_DAYS||7),graceDays:Number(env.PAST_DUE_GRACE_DAYS||3),
  verifyUser:async token=>{const {data,error}=await auth.auth.getUser(token);if(error)throw Object.assign(Error('Verify your email and sign in again.'),{status:401});return data.user}})
 return {api,handler:handler(api,{origin:origin.origin,supabaseUrl:env.SUPABASE_URL,supabaseKey:env.SUPABASE_PUBLISHABLE_KEY})}
}
