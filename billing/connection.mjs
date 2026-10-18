import {X509Certificate} from 'node:crypto'

// pg connection-string SSL options override its ssl object. Remove them only
// after requiring verify-full so the supplied CA cannot be silently discarded.
export function databaseConnection(env){
 if(!env.DATABASE_CA_CERT)return {connectionString:env.DATABASE_URL}
 const url=new URL(env.DATABASE_URL)
 if(url.searchParams.get('sslmode')!=='verify-full')throw Error('Custom database CA requires verify-full.')
 const ca=env.DATABASE_CA_CERT.replaceAll('\\n','\n')
 if(!new X509Certificate(ca).ca)throw Error('Expected a database CA certificate.')
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey','ssl','uselibpqcompat'])url.searchParams.delete(key)
 return {connectionString:url.href,ssl:{ca,rejectUnauthorized:true}}
}
