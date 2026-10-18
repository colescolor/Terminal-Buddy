import { readFile } from 'node:fs/promises'
export async function migrate(db) {
 const sql=await readFile(new URL('./migrations/001_accounts.sql', import.meta.url), 'utf8')
 for(const statement of sql.split(';').filter(x=>x.trim()))await db.query(statement)
 // Supabase can grant browser roles privileges through default grants.
 // RLS alone does not protect operations such as TRUNCATE; remove those grants.
 const roles=await db.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")
 for(const role of ['anon','authenticated'])if(roles.rows.some(row=>row.rolname===role)){
  await db.query('REVOKE ALL ON public.accounts, public.desktop_sessions, public.device_flows, public.processed_events FROM '+role)
 }
}
export function postgres(pool) {
 return { query: (sql,args) => pool.query(sql,args), transaction: async fn => {
  const client=await pool.connect()
  try { await client.query('BEGIN'); const value=await fn(client); await client.query('COMMIT'); return value }
  catch(error){ await client.query('ROLLBACK'); throw error } finally {client.release()}
 }}
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
