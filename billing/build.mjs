import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {browserNotices} from './browser-notices.mjs'
await mkdir('public/account',{recursive:true})
await writeFile('public/account/index.html',(await readFile('account.html','utf8')).replace('</main>','<p><a href="/THIRD_PARTY_LICENSES.txt">Third-party licenses</a></p></main>'))
await copyFile('account.css','public/account.css')
await mkdir('public/admin',{recursive:true})
await copyFile('admin.html','public/admin/index.html')
await copyFile('admin.css','public/admin.css')
const ownerBuild=await build({entryPoints:['admin-browser.mjs'],outfile:'public/admin.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked',metafile:true})
const accountBuild=await build({entryPoints:['account.mjs'],outfile:'public/account.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked',metafile:true})
await mkdir('public/recovery',{recursive:true})
await copyFile('recovery.html','public/recovery/index.html')
const recoveryBuild=await build({entryPoints:['recovery-browser.mjs'],outfile:'public/recovery.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked',metafile:true})
await browserNotices([ownerBuild,accountBuild,recoveryBuild])
// No secret configuration is inserted into the browser bundle.
const js=await readFile('public/account.js','utf8')+await readFile('public/admin.js','utf8')
if(/sk_live_|sk_test_[A-Za-z0-9]{12}|whsec_[A-Za-z0-9]{12}|BEGIN PRIVATE KEY/.test(js))throw Error('Secret in browser bundle')
console.log('Built static test account and owner pages. Environment configuration remains server-side.')
let authOrigin=''
if(process.env.SUPABASE_URL){const u=new URL(process.env.SUPABASE_URL);if(u.protocol!=='https:')throw Error('Supabase origin must be HTTPS');authOrigin=u.origin}
await writeFile('public/_headers', "/*\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' "+authOrigin+"; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n")
