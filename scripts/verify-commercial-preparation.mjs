import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {generateKeyPairSync} from 'node:crypto'
const script=resolve('scripts/prepare-commercial-config.mjs')
test('production preparation refuses missing approvals, validates inputs, and only writes into its isolated checkout',async()=>{
 const original=await readFile('billing/release-config.mjs','utf8')
 const root=await mkdtemp(join(tmpdir(),'buddy-release-fixture-'))
 for(const path of ['billing','src/shared'])await mkdir(join(root,path),{recursive:true})
 const approvals=JSON.parse(await readFile('release-approvals.json','utf8'))
 await writeFile(join(root,'release-approvals.json'),JSON.stringify(approvals))
 const run=()=>spawnSync(process.execPath,[script,'--inputs=inputs.json','--write'],{cwd:root,encoding:'utf8',windowsHide:true})
 assert.notEqual(run().status,0)
 for(const key of Object.keys(approvals))if(typeof approvals[key]==='boolean')approvals[key]=true
 approvals.approvedCopyrightHolder='Fictional fixture only'
 await writeFile(join(root,'release-approvals.json'),JSON.stringify(approvals))
 await writeFile(join(root,'package.json'),JSON.stringify({version:approvals.futureVersion}))
 const input={billingOrigin:'https://billing.example.com',supabaseOrigin:'https://project.supabase.co',stripeAccountId:'acct_fixture',entitlementPublicKey:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}),supportUrl:'https://billing.example.com/recovery/',approvedTermsPath:'terms.txt',approvedPrivacyPath:'privacy.txt'}
 await writeFile(join(root,'inputs.json'),JSON.stringify(input))
 for(const name of ['terms.txt','privacy.txt'])await writeFile(join(root,name),'DRAFT '.repeat(100))
 assert.notEqual(run().status,0)
 for(const name of ['terms.txt','privacy.txt'])await writeFile(join(root,name),'Synthetic test policy text; this file has no customer or legal effect. '.repeat(5))
 const result=run();assert.equal(result.status,0,result.stderr)
 const edition=await readFile(join(root,'src/shared/edition.ts'),'utf8')
 assert.match(edition,/"entitlementIssuer": "terminal-buddy"/)
 assert.match(await readFile(join(root,'electron-builder.commercial.yml'),'utf8'),/com.terminalbuddy.subscription/)
 assert.equal(await readFile('billing/release-config.mjs','utf8'),original,'Fixture test must not approve real build')
})
