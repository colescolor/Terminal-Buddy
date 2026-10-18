import { readFile } from 'node:fs/promises'
import {schemaIdentifier} from './schema.mjs'
export async function migrate(db,{schema='public'}={}) {
 const identifier=schemaIdentifier(schema)
 const current=await db.query('SELECT current_schema() AS schema')
 if(current.rows[0]?.schema!==schema)throw Error('Migration connection does not target the intended billing schema.')
 for(const file of ['001_accounts.sql','002_recovery.sql']){
  const sql=await readFile(new URL('./migrations/'+file, import.meta.url), 'utf8')
  for(const statement of sql.split(';').filter(x=>x.trim()))await db.query(statement)
 }
 // Supabase can grant browser roles privileges through default grants.
 // RLS alone does not protect operations such as TRUNCATE; remove those grants.
 const roles=await db.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")
 for(const role of ['anon','authenticated'])if(roles.rows.some(row=>row.rolname===role)){
  await db.query('REVOKE ALL ON '+['accounts','desktop_sessions','device_flows','processed_events','recovery_requests'].map(table=>identifier+'.'+table).join(', ')+' FROM '+role)
 }
}
export function postgres(pool,{schema='public'}={}) {
 const identifier=schemaIdentifier(schema)
 const transaction=async fn => {
  const client=await pool.connect()
  try {
   await client.query('BEGIN')
   // SET LOCAL and all statements use one transaction/connection. This works
   // with Supabase transaction pooling without leaking state to another user.
   await client.query('SET LOCAL search_path TO '+identifier+', pg_catalog')
   const current=await client.query('SELECT current_schema() AS schema')
   if(current.rows[0]?.schema!==schema)throw Error('Billing schema is unavailable to this database role.')
   const value=await fn(client); await client.query('COMMIT'); return value
  }
  catch(error){ await client.query('ROLLBACK'); throw error } finally {client.release()}
 }
 return {query:(sql,args)=>transaction(client=>client.query(sql,args)),transaction}
}
export async function lockedAccount(db,id,fn) {
 return db.transaction(async tx=>{
  const {rows}=await tx.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE',[id])
  if(!rows[0])throw Object.assign(Error('Sign in again.'),{status:401})
  return fn(rows[0],tx)
 })
}
export async function saveBilling(tx,id,billing) {
 await tx.query('UPDATE accounts SET billing=$2 WHERE id=$1',[id,JSON.stringify(billing)])
}
