import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {configurationIssues} from '../setup-check.mjs'
test('setup check rejects live credentials, privileged browser keys and insecure configuration without printing values',()=>{
 const env={STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_MONTHLY_PRICE_ID:'price_fixture',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',DATABASE_URL:'postgres://backend:fixture@db.example.com/postgres?sslmode=require',BILLING_ORIGIN:'https://billing.example.com',ENTITLEMENT_PRIVATE_KEY:generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}),OWNER_USER_IDS:'11111111-1111-4111-8111-111111111111'}
 assert.deepEqual(configurationIssues(env),[])
 for(const [key,value] of [['STRIPE_SECRET_KEY','sk_live_sensitive_fixture'],['SUPABASE_PUBLISHABLE_KEY','sb_secret_sensitive_fixture'],['DATABASE_URL','postgres://user:sensitive@db.example.com/postgres?sslmode=disable'],['BILLING_ORIGIN','http://localhost:4318'],['OWNER_USER_IDS','owner@example.com'],['ENTITLEMENT_PRIVATE_KEY','private-secret-fixture'],['OFFLINE_DAYS','99']]){
  const issues=configurationIssues({...env,[key]:value});assert.ok(issues.some(i=>i.startsWith(key+':')));assert.ok(!issues.join().includes(value))
 }
 assert.equal(configurationIssues({}).length,8)
})
