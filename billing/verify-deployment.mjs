import {build} from 'esbuild'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const result=await build({entryPoints:['functions/api.mjs','functions/subscriber-alerts.mjs'],outdir:'unused-verification-output',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',write:false,metafile:true})
assert.ok(!Object.keys(result.metafile.inputs).some(path=>/tests\/|fixture|preview|dev\.mjs|pglite/i.test(path)),'No local fixtures in deployed function')
const text=result.outputFiles.map(file=>file.text).join('\n')
if(/verified-fixture|local_fixture_only|sk_live_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|BEGIN PRIVATE KEY/.test(text))throw Error('Unexpected fixture or secret pattern in deployed function; values suppressed.')
async function scan(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await scan(path);else{
 assert.ok(/\.(?:html|css|js|txt)$/.test(item.name)||item.name==='_headers','Unexpected public file: '+path)
 const content=await readFile(path,'utf8')
 if(/verified-fixture|local_fixture_only|sb_secret_[A-Za-z0-9_-]{12,}|BEGIN PRIVATE KEY|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|re_[A-Za-z0-9]{24,}|postgres(?:ql)?:\/\//.test(content))throw Error('Potential secret or fixture in '+path+'; values suppressed.')
 for(const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  let claims;try{claims=JSON.parse(Buffer.from(match[1],'base64url').toString())}catch{continue}
  if(claims.role==='service_role')throw Error('Privileged JWT in '+path+'; value suppressed.')
 }
}}}
await scan('public')
for(const page of ['account','admin','recovery'])assert.match(await readFile('public/'+page+'/index.html','utf8'),/noindex,nofollow/)
assert.match(await readFile('public/_headers','utf8'),/frame-ancestors 'none'/)
console.log('PASS server function bundle boundary, no deployed fixtures, browser secret-pattern scan, account/admin noindex and CSP.')
