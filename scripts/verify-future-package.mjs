import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,stat,writeFile,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const require=createRequire(import.meta.url),asar=require('@electron/asar')
const commercial=process.argv.includes('--commercial'),output=commercial?'release-commercial':'release'
const pkg=JSON.parse(await readFile('package.json','utf8')),archive=output+'/win-unpacked/resources/app.asar'
const bundled=JSON.parse(asar.extractFile(archive,'package.json'))
assert.equal(bundled.version,pkg.version)
assert.equal(asar.extractFile(archive,'LICENSE').toString().replaceAll('\r\n','\n'),(await readFile('LICENSE','utf8')).replaceAll('\r\n','\n'))
const manifest=JSON.parse(await readFile(output+'/win-unpacked/resources/resources/third-party-manifest.json','utf8'))
assert.equal(manifest.applicationVersion,pkg.version);assert.equal(manifest.issues.length,0)
const notices=await readFile(output+'/win-unpacked/resources/resources/THIRD_PARTY_LICENSES.txt','utf8')
for(const name of ['react','react-dom','scheduler','zustand','@xterm/xterm','@xterm/headless','@xterm/addon-serialize','@lydell/node-pty','yaml'])assert.ok(manifest.entries.some(e=>e.name===name),name+' notice')
for(const holder of ['Meta Platforms','Paul Henschel','Christopher Jeffrey','Microsoft Corporation','Eemeli Aro'])assert.ok(notices.includes(holder),holder)
assert.ok((await stat(output+'/win-unpacked/LICENSES.chromium.html')).size>1000)
const files=asar.listPackage(archive)
assert.ok(!files.some(f=>/billing[\\/]|\.env$|release-approvals|\.local|tests[\\/]/.test(f)))
for(const f of files.filter(f=>/^\\out\\.*\.(js|json)$/.test(f)))assert.doesNotMatch(asar.extractFile(archive,f.slice(1)).toString(),/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|BEGIN PRIVATE KEY/)
for(const file of [join('out','main','index.js'),join('out','preload','index.js')])assert.equal(asar.extractFile(archive,file).toString(),await readFile(file,'utf8'),'Packaged code matches current build')
if(commercial){const main=asar.extractFile(archive,join('out','main','index.js')).toString();assert.match(main,/commercialApproved:\s*true/);assert.match(main,/enforcement:\s*true/);assert.ok(main.includes('terminal-buddy-subscription'))}
const assets=[]
const inspection=await mkdtemp(join(tmpdir(),'buddy-future-package-'))
const sevenZip=resolve('node_modules/electron-winstaller/vendor/7z.exe')
const asarHash=createHash('sha256').update(await readFile(archive)).digest('hex')
const prefix=commercial?'Terminal-Buddy-Subscription':'Terminal Buddy'
for(const file of [`${prefix}-${pkg.version}-x64.exe`,`${prefix}-${pkg.version}-portable.exe`]){
 const bytes=await readFile(output+'/'+file)
 const payload=execFileSync(sevenZip,['x','-so',output+'/'+file,'$PLUGINSDIR\\app-64.7z'],{maxBuffer:180*1024*1024})
 const payloadPath=join(inspection,file+'.7z');await writeFile(payloadPath,payload)
 const shippedAsar=execFileSync(sevenZip,['x','-so',payloadPath,'resources\\app.asar'],{maxBuffer:10*1024*1024})
 assert.equal(createHash('sha256').update(shippedAsar).digest('hex'),asarHash,'Installer application payload matches inspected version')
 const shippedNotices=execFileSync(sevenZip,['x','-so',payloadPath,'resources\\resources\\THIRD_PARTY_LICENSES.txt'],{maxBuffer:2*1024*1024}).toString()
 assert.equal(shippedNotices,notices,'Installer/portable retain generated notices')
 const encodedPath=Buffer.from(resolve(output+'/'+file)).toString('base64')
 const inspect="$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encodedPath+"')); @{signingStatus=(Get-AuthenticodeSignature -LiteralPath $p).Status.ToString();productVersion=(Get-Item -LiteralPath $p).VersionInfo.ProductVersion}|ConvertTo-Json -Compress"
 const metadata=JSON.parse(execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',inspect],{encoding:'utf8',windowsHide:true}))
 assert.equal(metadata.productVersion,pkg.version,'PE product version agrees with package')
 assets.push({filename:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...metadata})
}
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()
await writeFile(output+(commercial?'/release-manifest.json':'/future-test-manifest.json'),JSON.stringify({version:pkg.version,sourceCommit,dirty,channel:commercial?'commercial-opt-in':'local-test-only',license:pkg.license,enforcement:commercial,assets},null,2)+'\n')
console.log('PASS package version, license preservation, runtime/Chromium notices and secret-pattern scan. Manifest written; this is not publication authorization.')
