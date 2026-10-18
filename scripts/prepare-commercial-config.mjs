// Local preparation only. Never deploys, uploads, changes licenses, or reads server secrets.
import {readFile,writeFile} from 'node:fs/promises'
import {createPublicKey} from 'node:crypto'
import {resolve,relative,isAbsolute} from 'node:path'
import {billingMode} from '../billing/mode.mjs'
const approvals=JSON.parse(await readFile('release-approvals.json','utf8'))
const missing=Object.entries(approvals).filter(([k,v])=>(k.endsWith('Approved')||k.endsWith('Passed')||k==='productionAuthorized')&&v!==true).map(([k])=>k)
if(!approvals.approvedCopyrightHolder?.trim())missing.push('approvedCopyrightHolder')
if(missing.length){console.error('BLOCKED: resolve '+missing.join(', ')+'. No files changed.');process.exit(1)}
const inputPath=process.argv.find(v=>v.startsWith('--inputs='))?.slice(9)
if(!inputPath)throw Error('Supply --inputs=path to an approved production-inputs JSON file.')
const input=JSON.parse(await readFile(inputPath,'utf8'))
const release={liveApproved:true,billingOrigin:input.billingOrigin,supabaseOrigin:input.supabaseOrigin,stripeAccountId:input.stripeAccountId}
billingMode({BILLING_MODE:'live',STRIPE_SECRET_KEY:'rk_live_validation_only',BILLING_ORIGIN:input.billingOrigin,SUPABASE_URL:input.supabaseOrigin},release)
const publicKey=createPublicKey(input.entitlementPublicKey)
if(publicKey.asymmetricKeyType!=='ed25519'||!input.entitlementPublicKey.includes('BEGIN PUBLIC KEY')||input.entitlementPublicKey.includes('PRIVATE'))throw Error('Supply only the new production Ed25519 public key.')
const support=new URL(input.supportUrl);if(support.protocol!=='https:'||support.username||support.password||support.search||support.hash)throw Error('Approved HTTPS support route required.')
const policies=[]
for(const path of [input.approvedTermsPath,input.approvedPrivacyPath]){
 if(typeof path!=='string'||!path)throw Error('Approved policy file paths required.')
 const rel=relative(process.cwd(),resolve(path))
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('Policies must be reviewed files in this checkout.')
 const text=await readFile(path,'utf8')
 if(text.length<200||/\bDRAFT\b|\[OWNER|\[LEGAL|NOT FOR PUBLICATION/i.test(text))throw Error('Policy files still contain draft/owner placeholders.')
 policies.push(text)
}
const pkg=JSON.parse(await readFile('package.json','utf8'))
if(pkg.version!==approvals.futureVersion)throw Error('Approved and package versions differ.')
if(!process.argv.includes('--write')){console.log('Inputs and approvals validated. Review before --write; no files changed.');process.exit(0)}
await writeFile('billing/release-config.mjs','// Approved production configuration; contains no server secrets.\nexport const release = Object.freeze('+JSON.stringify(release,null,2)+')\n')
await writeFile('billing/approved-policies.json',JSON.stringify({terms:policies[0],privacy:policies[1],supportUrl:input.supportUrl},null,2)+'\n')
await writeFile('src/shared/edition.ts','// Approved opt-in commercial edition. No secrets.\nexport const EDITION = '+JSON.stringify({kind:'commercial',commercialApproved:true,enforcement:true,billingOrigin:input.billingOrigin,entitlementPublicKey:input.entitlementPublicKey,entitlementIssuer:'terminal-buddy',supportUrl:input.supportUrl},null,2)+'\n')
await writeFile('electron-builder.commercial.yml',[
 'extends: ./electron-builder.yml',
 'appId: com.terminalbuddy.subscription',
 'productName: Terminal Buddy Subscription',
 'copyright: '+JSON.stringify(approvals.approvedCopyrightHolder),
 'directories:', '  output: release-commercial',
 'nsis:', '  shortcutName: Terminal Buddy Subscription',
 'win:', '  artifactName: Terminal-Buddy-Subscription-${version}-${arch}.${ext}',
 'portable:', '  artifactName: Terminal-Buddy-Subscription-${version}-portable.${ext}', ''
].join('\n'))
console.log('Prepared local commercial configuration with a separate app identity/profile. Review and commit; licenses and release approvals were not changed. Nothing deployed.')
