export function handler(service,publicConfig,owner) {
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}
  try {
   const url=new URL(request.url),path=url.pathname.replace(/^\/.netlify\/functions\/api/,'').replace(/^\/api/,'')
   const origin=request.headers.get('origin')
   if(origin&&origin!==publicConfig.origin)return Response.json({error:'Origin not allowed.'},{status:403,headers})
   if(request.method==='GET'&&path==='/config')return Response.json(publicConfig,{headers})
   if(request.method!=='POST')return Response.json({error:'Not found.'},{status:404,headers})
   const raw=await request.text()
   if(raw.length>(path==='/webhook'?1000000:4096))return Response.json({error:'Request too large.'},{status:413,headers})
   if(path==='/webhook')return Response.json(await service.webhook(raw,request.headers.get('stripe-signature')),{headers})
   const body=JSON.parse(raw||'{}')
   const token=request.headers.get('authorization')?.replace(/^Bearer /,'')
   if(path==='/admin/overview'){
    if(!owner)return Response.json({error:'Owner dashboard is not configured.'},{status:503,headers})
    return Response.json(await owner.overview(token,body),{headers})
   }
   if(path==='/device/start')return Response.json(await service.deviceStart(body),{headers})
   if(path==='/device/check')return Response.json(await service.deviceCheck(body),{headers})
   if(path==='/device/approve')return Response.json(await service.deviceApprove(token,body),{headers})
   if(path==='/device/exchange')return Response.json(await service.deviceExchange(body),{headers})
   const id=await service.authenticate(token)
   const actions={
    '/status':()=>service.status(id),'/trial':()=>service.startTrial(id),
    '/checkout':()=>service.checkout(id,body),'/portal':()=>service.portal(id),
    '/sign-out':()=>service.signOut(token)
   }
   if(!actions[path])return Response.json({error:'Not found.'},{status:404,headers})
   if(path!=='/checkout'&&Object.keys(body).length)throw Object.assign(Error('Unexpected request fields.'),{status:400})
   return Response.json(await actions[path](),{headers})
  }catch(error){
   // Never echo provider responses, tokens, SQL errors or billing payloads.
   const status=error.status|| (error instanceof SyntaxError?400:503)
   return Response.json({error:error.status?error.message:status===400?'Invalid request.':'Account service is temporarily unavailable. Please retry.'},{status,headers})
  }
 }
}
