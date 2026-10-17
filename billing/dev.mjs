// Local-only fixtures and preview. This module is never imported by the production function.
import {createServer} from 'node:http'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {fixture} from './tests/fixture.mjs'
import {handler} from './http.mjs'
import {service} from './service.mjs'
import {ownerService} from './admin.mjs'
import {seedOwnerPreview} from './owner-fixtures.mjs'
import {USER} from './tests/fixture.mjs'
if(process.env.NETLIFY||process.env.NODE_ENV==='production')throw Error('Local fixtures are forbidden in deployed environments.')
await mkdir('.local',{recursive:true})
await build({entryPoints:['preview.tsx'],outfile:'.local/preview.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfigRaw:{compilerOptions:{jsx:'react-jsx'}}})
await build({entryPoints:['admin-preview.mjs'],outfile:'.local/admin-preview.js',bundle:true,platform:'browser',format:'esm'})
const f=await fixture('.local/database')
await seedOwnerPreview(f.db)
f.api=service({...f.options,now:Date.now})
const publicKey=f.keys.publicKey.export({type:'spki',format:'pem'})
await writeFile('.local/public-key.pem',publicKey)
const owner=ownerService({db:f.db,verifyUser:f.options.verifyUser,owners:new Set([USER])})
const api=handler(f.api,{origin:'http://127.0.0.1:4318'},owner)
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4318')
  if(req.headers.host!=='127.0.0.1:4318'){res.writeHead(403);return res.end()}
  if(url.pathname.startsWith('/api/')){
   let data='';for await(const chunk of req){data+=chunk;if(data.length>1000000){res.writeHead(413);return res.end()}}
   const r=await api(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:data}:{})}))
   res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text())
  }
  const files={'/':['preview.html','text/html'],'/preview/':['preview.html','text/html'],'/preview.js':['.local/preview.js','text/javascript'],'/preview.css':['.local/preview.css','text/css'],'/preview-shell.css':['preview-shell.css','text/css']}
  files['/admin.css']=['admin.css','text/css'];files['/admin-preview.js']=['.local/admin-preview.js','text/javascript']
  if(url.pathname==='/owner-preview/'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"})
   return res.end((await readFile('admin.html','utf8')).replace('/admin.js','/admin-preview.js'))
  }
  if(url.pathname==='/account/'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'"})
   return res.end('<!doctype html><html><head><link rel="stylesheet" href="/preview-shell.css"><script src="/local-connect.js" defer></script></head><body><main><h1>Local simulated email verification</h1><p>Fictional account alex@example.invalid. No email or provider request is sent.</p><button class="btn" id="connect">Connect test account</button><p id="status"></p></main></body></html>')
  }
  if(url.pathname==='/local-connect.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end("document.querySelector('#connect').onclick=async()=>{const q=new URLSearchParams(location.search);const r=await fetch('/api/device/approve',{method:'POST',headers:{Authorization:'Bearer verified-fixture','Content-Type':'application/json'},body:JSON.stringify({id:q.get('device'),state:q.get('state')})});document.querySelector('#status').textContent=r.ok?'Connected. Return to the app.':'Request expired.'}")}
  if(!files[url.pathname]){res.writeHead(404);return res.end('Not found')}
  const [file,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(await readFile(file))
 }catch{res.writeHead(500);res.end('Local preview error')}
})
server.listen(4318,'127.0.0.1',()=>console.log('Isolated billing preview: http://127.0.0.1:4318/ — fixtures, not Stripe sandbox.'))
