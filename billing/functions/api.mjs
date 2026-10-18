import {runtime} from '../runtime.mjs'
let app
export default async request=>{
 // Prevent bypassing the dedicated rate-limited route through this catch-all.
 const path=new URL(request.url).pathname.replace(/^\/.netlify\/functions\/api/,'').replace(/^\/api/,'')
 if(path==='/device/start')return new Response(null,{status:404})
 try {app??=runtime();return await app.handler(request)}
 catch{return Response.json({error:'Billing is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
