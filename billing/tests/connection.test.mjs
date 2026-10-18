import test from 'node:test'
import assert from 'node:assert/strict'
import {rootCertificates} from 'node:tls'
import {databaseConnection} from '../connection.mjs'
test('custom CA preserves hostname verification and cannot be overridden by URL SSL options',()=>{
 const env={DATABASE_URL:'postgres://test:fixture@db.example.com/db?sslmode=verify-full&sslrootcert=/wrong/path&ssl=false&uselibpqcompat=true',DATABASE_CA_CERT:rootCertificates[0]}
 const options=databaseConnection(env)
 assert.equal(options.ssl.rejectUnauthorized,true)
 assert.equal(options.ssl.ca,rootCertificates[0])
 assert.equal(new URL(options.connectionString).search,'')
 assert.equal(options.ssl.checkServerIdentity,undefined)
 for(const mode of ['disable','require','verify-ca'])assert.throws(()=>databaseConnection({...env,DATABASE_URL:env.DATABASE_URL.replace('verify-full',mode)}))
 assert.throws(()=>databaseConnection({...env,DATABASE_CA_CERT:'invalid'}))
})
