import {createPublicKey,verify} from 'node:crypto'
import type {AccountRecord,AccessState} from '@shared/account'
const allowed = new Set<AccessState>(['trial','paid','cancelling','past_due'])
export function verifiedAccess(record:AccountRecord|null,key:string,now:number,highestWall:number,issuer='terminal-buddy-test'): {allow:boolean;state:AccessState} {
 if(!record||!key)return {allow:false,state:'unknown'}
 try{
  const publicKey=createPublicKey(key)
  if(publicKey.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(record.entitlement.payload),publicKey,Buffer.from(record.entitlement.signature,'base64url')))throw Error()
  const c=JSON.parse(Buffer.from(record.entitlement.payload,'base64url').toString())
  if(c.issuer!==issuer||c.audience!=='terminal-buddy-desktop'||c.subject!==record.accountId||
   !['verifiedAt','offlineUntil','accessUntil'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0)||
   c.verifiedAt>now+300000||now<highestWall-300000||c.offlineUntil>c.verifiedAt+7*86400000||c.offlineUntil>c.accessUntil)throw Error()
  if(!allowed.has(c.state))return {allow:false,state:c.state==='eligible'?'eligible':c.state==='confirming'?'confirming':'expired'}
  if(Math.max(now,highestWall)>=c.offlineUntil)return {allow:false,state:now>=c.accessUntil?'expired':'unknown'}
  return {allow:true,state:c.state}
 }catch{return {allow:false,state:'unknown'}}
}
export function canCreateWorkspace(enforcement:boolean,record:AccountRecord|null,key:string,now:number,highestWall:number,issuer='terminal-buddy-test'):boolean {
 return !enforcement || verifiedAccess(record,key,now,highestWall,issuer).allow
}
