import {runtime} from '../runtime.mjs'
let app
// Netlify schedules are internal; this is not a public email-sending API.
export const config={schedule:'*/5 * * * *'}
export default async()=>{
 try{app??=runtime();await app.alerts.flushPending();return new Response(null,{status:204})}
 catch{console.warn('Subscriber alert retry deferred.');return new Response(null,{status:503})}
}
