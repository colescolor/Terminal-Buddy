// Local manual check of REAL Supabase email delivery and authentication.
// Never imported by the deployed billing function or static build.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
if(process.env.NETLIFY||process.env.NODE_ENV==='production')throw Error('Auth check is local only.')
const config=JSON.parse(await readFile(new URL('./.local/auth-check-config.json',import.meta.url),'utf8'))
const origin=new URL(config.supabaseUrl)
if(origin.protocol!=='https:'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabaseKey))throw Error('Use only an HTTPS Supabase URL and a publishable key.')
const bundle=await build({entryPoints:[fileURLToPath(new URL('./auth-check-client.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',minify:true})
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Terminal Buddy — local email login test</title><link rel="stylesheet" href="/account.css"><script type="module" src="/check.js"></script><main><p class="eyebrow">TERMINAL BUDDY · LOCAL AUTH TEST</p><h1>Test your sign-in email</h1><p>This page sends a real email through Supabase and Resend. No trial, app connection, subscription or payment is created. A first sign-in creates a Supabase test account.</p><form id="email-form"><label>Email address<input id="email" type="email" autocomplete="email" required></label><button id="send">Send sign-in code</button></form><form id="code-form" hidden><label>Email verification code<input id="code" inputmode="numeric" autocomplete="one-time-code" required></label><button id="verify">Verify email</button></form><button id="again" hidden>Sign out and test returning-user login</button><p id="status" role="status">Use an inbox you control. Enter the code here yourself; do not paste it into chat.</p><p>Session tokens stay in this page’s memory. Closing or reloading the page clears them.</p></main></html>'
const css=await readFile(new URL('./account.css',import.meta.url))
const server=createServer((req,res)=>{
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' ${origin.origin}; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}
 if(req.headers.host!=='127.0.0.1:4319'||req.method!=='GET'){res.writeHead(403,headers);return res.end()}
 const routes={'/':['text/html',html],'/check.js':['text/javascript',bundle.outputFiles[0].contents],'/account.css':['text/css',css],'/config':['application/json',JSON.stringify({supabaseUrl:origin.origin,supabaseKey:config.supabaseKey})]}
 const route=routes[req.url];if(!route){res.writeHead(404,headers);return res.end('Not found')}
 res.writeHead(200,{...headers,'Content-Type':route[0]});res.end(route[1])
})
server.listen(4319,'127.0.0.1',()=>console.log('Real email authentication check: http://127.0.0.1:4319/ — manual actions only; no Stripe or trials.'))
