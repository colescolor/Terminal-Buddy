import {runtime} from '../runtime.mjs'
let app
export default async request=>{
 try {app??=runtime();return await app.handler(request)}
 catch{return Response.json({error:'Billing is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
