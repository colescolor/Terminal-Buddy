import {configurationIssues} from './setup-check.mjs'
import {stripeGateway} from './stripe.mjs'
import {Pool} from 'pg'
import {databaseConnection} from './connection.mjs'
const issues=configurationIssues(process.env)
if(process.argv.includes('--require-owner')&&!process.env.OWNER_USER_IDS?.trim())issues.push('OWNER_USER_IDS: missing; owner dashboard remains disabled')
if(issues.length){for(const issue of issues)console.log('BLOCKED: '+issue);process.exitCode=1}
else{
 console.log('PASS: TEST configuration formats. Values and secrets are not printed. This does not verify email delivery, ownership or provider connectivity.')
 if(!process.env.OWNER_USER_IDS?.trim())console.log('NOTE: Owner access is disabled. Sign in to the account service, then allowlist the verified user UUID in server configuration.')
 if(process.argv.includes('--online')){
  // Explicit opt-in, read-only provider checks. No products, users, email or payments are created.
  let pool
  try{
   await stripeGateway(process.env).validatePrice()
   console.log('PASS: Stripe returned the configured active TEST USD 6/month price.')
   pool=new Pool({...databaseConnection(process.env),max:1,connectionTimeoutMillis:8000,statement_timeout:10000})
   await pool.query('SELECT id,trial_started_at,trial_ends_at,billing FROM accounts LIMIT 0')
   for(const table of ['desktop_sessions','device_flows','processed_events'])await pool.query('SELECT 1 FROM '+table+' LIMIT 0')
   const rls=await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('accounts'::regclass,'desktop_sessions'::regclass,'device_flows'::regclass,'processed_events'::regclass)")
   if(rls.rows.length!==4||rls.rows.some(r=>!r.relrowsecurity))throw Error()
   console.log('PASS: billing schema is readable and RLS is enabled. Verify backend role grants and Supabase public-role denial separately.')
  }catch{console.log('BLOCKED: provider/schema check failed. Check dashboard configuration and migrations; sensitive provider details were not logged.');process.exitCode=1}
  finally{if(pool)await pool.end()}
 }
}
