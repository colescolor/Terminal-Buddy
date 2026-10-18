import {Pool} from 'pg'
import {databaseConnection} from './connection.mjs'
import {createClient} from '@supabase/supabase-js'
import {createPrivateKey} from 'node:crypto'
import {postgres} from './db.mjs'
import {service} from './service.mjs'
import {stripeGateway} from './stripe.mjs'
import {handler} from './http.mjs'
import {ownerService,ownerIds} from './admin.mjs'
import {subscriberAlerts,resendAlerts} from './subscriber-alerts.mjs'
import {recoveryService} from './recovery.mjs'
import {verifiedIdentity} from './verified-identity.mjs'
import {billingMode} from './mode.mjs'
export function runtime(env=process.env) {
 const mode=billingMode(env)
 const origin=new URL(env.BILLING_ORIGIN)
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Configure an HTTPS billing origin.')
 if(!env.DATABASE_URL||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.STRIPE_WEBHOOK_SECRET)throw Error('Billing environment is incomplete.')
 const privateKey=createPrivateKey(env.ENTITLEMENT_PRIVATE_KEY?.replaceAll('\\n','\n')||'')
 if(privateKey.asymmetricKeyType!=='ed25519')throw Error('Use an Ed25519 entitlement key.')
 const auth=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const db=postgres(new Pool({...databaseConnection(env),max:1,connectionTimeoutMillis:8000,statement_timeout:20000}))
 const verifyUser=token=>verifiedIdentity(auth.auth,token)
 const alerts=subscriberAlerts({db,delivery:resendAlerts(env,fetch,mode.live)})
 const api=service({db,stripe:stripeGateway(env),privateKey,origin:origin.origin,alerts,
  offlineDays:Number(env.OFFLINE_DAYS||7),graceDays:Number(env.PAST_DUE_GRACE_DAYS||3),
  verifyUser,live:mode.live})
 const owner=ownerService({db,verifyUser,owners:ownerIds(env.OWNER_USER_IDS),graceDays:Number(env.PAST_DUE_GRACE_DAYS||3),live:mode.live})
 const recovery=recoveryService({db,verifyUser,owners:ownerIds(env.OWNER_USER_IDS)})
 return {api,alerts,handler:handler(api,{origin:origin.origin,supabaseUrl:env.SUPABASE_URL,supabaseKey:env.SUPABASE_PUBLISHABLE_KEY},owner,recovery)}
}
