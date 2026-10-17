import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {build} from 'esbuild'
await mkdir('public/account',{recursive:true})
await copyFile('account.html','public/account/index.html')
await copyFile('account.css','public/account.css')
await build({entryPoints:['account.mjs'],outfile:'public/account.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'linked'})
// No secret configuration is inserted into the browser bundle.
const js=await readFile('public/account.js','utf8')
if(/sk_live_|sk_test_[A-Za-z0-9]{12}|whsec_[A-Za-z0-9]{12}|BEGIN PRIVATE KEY/.test(js))throw Error('Secret in browser bundle')
console.log('Built static test account page. Environment configuration remains server-side.')
let authOrigin=''
if(process.env.SUPABASE_URL){const u=new URL(process.env.SUPABASE_URL);if(u.protocol!=='https:')throw Error('Supabase origin must be HTTPS');authOrigin=u.origin}
await writeFile('public/_headers', "/*\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' "+authOrigin+"; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n")
