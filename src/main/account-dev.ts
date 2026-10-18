// Only an unpackaged process with an explicit isolated profile can opt in.
// This does not enable enforcement or change any packaged free edition.
export function developmentBillingOrigin(packaged:boolean,isolated:boolean,value?:string):string|null {
 if(packaged||!isolated||!value)return null
 const u=new URL(value)
 const loopback=u.protocol==='http:'&&u.hostname==='127.0.0.1'
 const staging=u.origin==='https://terminal-buddy-billing-test.netlify.app'
 if((!loopback&&!staging)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use loopback or the approved HTTPS test billing origin.')
 return u.origin
}
