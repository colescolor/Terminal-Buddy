import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {migrate} from '../db.mjs'

test('migration removes Supabase browser default grants, preserves other tables and is repeatable',async()=>{
 const db=new PGlite()
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated; CREATE TABLE unrelated_fixture(id int);')
  await migrate(db)
  await migrate(db)
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query("SELECT has_table_privilege($1,'unrelated_fixture','SELECT') AS allowed",[role])).rows[0].allowed,true)
   for(const table of ['accounts','desktop_sessions','device_flows','processed_events']){
    const grants=await db.query("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed",[role,table])
    assert.equal(grants.rows[0].allowed,false)
   }
   await db.exec('SET ROLE '+role)
   await assert.rejects(db.query('SELECT id FROM accounts'),error=>error.code==='42501')
   await db.exec('RESET ROLE')
  }
 }finally{await db.close()}
})
