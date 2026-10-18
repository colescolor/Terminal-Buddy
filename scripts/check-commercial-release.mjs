import {readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {billingMode} from '../billing/mode.mjs'
import {configurationIssues} from '../billing/setup-check.mjs'
const approvals=JSON.parse(await readFile('release-approvals.json','utf8')),pkg=JSON.parse(await readFile('package.json','utf8')),failures=[]
for(const [key,value] of Object.entries(approvals))if(key.endsWith('Approved')||key.endsWith('Passed')||key==='productionAuthorized')if(value!==true)failures.push(key+' requires explicit owner approval/evidence.')
if(!approvals.approvedCopyrightHolder)failures.push('Approved copyright-holder text is missing; copyright: MIT is deliberately unchanged.')
if(pkg.version!==approvals.futureVersion||pkg.version==='0.1.18')failures.push('Future version mismatch.')
const notice=JSON.parse(await readFile('resources/third-party-manifest.json','utf8'))
if(notice.applicationVersion!==pkg.version||notice.issues.length)failures.push('Notice manifest incomplete or for a different version.')
const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'})
if(dirty.trim())failures.push('Release source must be committed and clean.')
const committed=JSON.parse(execFileSync('git',['show','HEAD:package.json'],{encoding:'utf8'}))
if(committed.version!==pkg.version)failures.push('Source commit and package version differ.')
try {
 const artifacts=JSON.parse(await readFile('release-commercial/release-manifest.json','utf8'))
 if(artifacts.channel!=='commercial-opt-in'||artifacts.enforcement!==true)failures.push('Artifact is not the opt-in commercial edition.')
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 if(artifacts.version!==pkg.version||artifacts.sourceCommit!==head||artifacts.dirty)failures.push('Artifact provenance does not match clean release source.')
 if(!artifacts.assets.every(a=>a.sha256&&a.bytes&&a.signingStatus))failures.push('Artifact hashes, sizes or measured signing status missing.')
}catch{failures.push('Verified artifact manifest is missing.')}
const edition=await readFile('src/shared/edition.ts','utf8')
if(!/["']?commercialApproved["']?:\s*true/.test(edition)||!/["']?kind["']?:\s*['"]commercial['"]/.test(edition)||!/["']?enforcement["']?:\s*true/.test(edition))failures.push('This is still the free/test edition, not an approved commercial build.')
for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_MONTHLY_PRICE_ID','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','DATABASE_URL','BILLING_ORIGIN','ENTITLEMENT_PRIVATE_KEY'])if(!process.env[name])failures.push('Missing server configuration: '+name)
try{if(!billingMode(process.env).live)failures.push('Production requires approved live billing configuration.')}catch{failures.push('Live mode/key/origins do not match an approved production build.')}
failures.push(...configurationIssues(process.env))
try{const builder=await readFile('electron-builder.commercial.yml','utf8');if(!builder.includes('com.terminalbuddy.subscription'))failures.push('Separate subscription installer identity is missing.')}catch{failures.push('Commercial installer configuration is missing.')}
async function scan(dir){for(const f of await readdir(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())await scan(path);else if(/\.(js|html|json|css)$/.test(f.name)){const s=await readFile(path,'utf8');if(/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|BEGIN PRIVATE KEY|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/.test(s))failures.push('Potential secret in '+path)}}}
await scan('out')
console.log(failures.map(x=>'BLOCKED: '+x).join('\n'))
process.exitCode=failures.length?1:0
