import {runtime} from '../runtime.mjs'
let app
// Internal Netlify scheduler. No public reconciliation/authentication bypass.
export const config={schedule:'*/15 * * * *'}
export default async()=>{
 try{app??=runtime();const result=await app.api.reconcile({limit:5});if(result.failed)console.warn('Some account reconciliations deferred.');return new Response(null,{status:result.failed?503:204})}
 catch{console.warn('Account reconciliation deferred.');return new Response(null,{status:503})}
}
