import {runtime} from '../runtime.mjs'
let app
// The only public sign-in initiation route. Netlify applies this before invocation.
export const config={path:'/api/device/start',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}}
export default async request=>{
 if(new URL(request.url).pathname!=='/api/device/start')return new Response(null,{status:404})
 try{app??=runtime();return await app.handler(request)}
 catch{return Response.json({error:'Sign-in is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
