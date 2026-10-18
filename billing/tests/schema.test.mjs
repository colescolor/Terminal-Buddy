import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {migrate,postgres} from '../db.mjs'
import {databaseSchema} from '../schema.mjs'

test('production requires isolated schema and sandbox cannot select it',()=>{
 assert.equal(databaseSchema({}),'public')
 assert.equal(databaseSchema({BILLING_MODE:'live',DATABASE_SCHEMA:'terminal_buddy_live'}),'terminal_buddy_live')
 for(const env of [{BILLING_MODE:'live'},{BILLING_MODE:'live',DATABASE_SCHEMA:'public'},{DATABASE_SCHEMA:'terminal_buddy_live'},{DATABASE_SCHEMA:'public; DROP SCHEMA public'},{DATABASE_SCHEMA:'auth'}])assert.throws(()=>databaseSchema(env))
})

test('production migration and queries preserve sandbox data and browser grants remain denied',async()=>{
 const engine=new PGlite()
 const pool={connect:async()=>({query:(...args)=>engine.query(...args),release(){}})}
 try{
  await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA terminal_buddy_live; GRANT USAGE ON SCHEMA terminal_buddy_live TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA terminal_buddy_live GRANT ALL ON TABLES TO anon, authenticated;')
  await migrate(engine)
  const id='00000000-0000-4000-8000-000000000001'
  await engine.query('INSERT INTO public.accounts(id,email) VALUES($1,$2)',[id,'sandbox@example.invalid'])
  const live=postgres(pool,{schema:'terminal_buddy_live'})
  await live.transaction(client=>migrate(client,{schema:'terminal_buddy_live'}))
  await live.transaction(client=>migrate(client,{schema:'terminal_buddy_live'}))
  assert.equal((await live.query('SELECT count(*) AS count FROM accounts')).rows[0].count,0)
  await live.query('INSERT INTO accounts(id,email) VALUES($1,$2)',[id,'production@example.invalid'])
  assert.equal((await live.query('SELECT email FROM accounts WHERE id=$1',[id])).rows[0].email,'production@example.invalid')
  assert.equal((await engine.query('SELECT email FROM public.accounts WHERE id=$1',[id])).rows[0].email,'sandbox@example.invalid')
  assert.equal((await engine.query('SELECT current_schema() AS schema')).rows[0].schema,'public')
  await assert.rejects(live.transaction(async client=>{await client.query('UPDATE accounts SET email=$1 WHERE id=$2',['rollback@example.invalid',id]);throw Error('rollback')}))
  assert.equal((await live.query('SELECT email FROM accounts WHERE id=$1',[id])).rows[0].email,'production@example.invalid')
  for(const role of ['anon','authenticated'])for(const table of ['accounts','desktop_sessions','device_flows','processed_events','recovery_requests']){
   const grants=await engine.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,'terminal_buddy_live.'+table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'])
   assert.equal(grants.rows[0].allowed,false)
  }
  await assert.rejects(migrate(engine,{schema:'terminal_buddy_live'}),/intended billing schema/)
 }finally{await engine.close()}
})
