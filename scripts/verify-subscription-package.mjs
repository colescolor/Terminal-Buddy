import assert from 'node:assert/strict'
import {readFile,stat,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFileSync,spawnSync} from 'node:child_process'
import {join,resolve,dirname} from 'node:path'
const require=createRequire(import.meta.url),asar=require('@electron/asar')
const pkg=JSON.parse(await readFile('package.json','utf8'))
const arch=process.argv.find(x=>x.startsWith('--arch='))?.slice(7)||process.arch
assert.ok(['x64','arm64'].includes(arch))
const mac=process.platform==='darwin',product='Terminal Buddy Subscription'
const bundle=mac?`release-commercial/mac${arch==='arm64'?'-arm64':''}/${product}.app/Contents`:'release-commercial/win-unpacked'
const resources=join(bundle,mac?'Resources':'resources'),archive=join(resources,'app.asar')
const metadata=JSON.parse(asar.extractFile(archive,'package.json'))
assert.equal(metadata.version,pkg.version);assert.equal(metadata.license,pkg.license)
assert.equal(asar.extractFile(archive,'LICENSE').toString().replaceAll('\r\n','\n'),(await readFile('LICENSE','utf8')).replaceAll('\r\n','\n'))
const main=asar.extractFile(archive,join('out','main','index.js')).toString()
assert.equal(main,await readFile('out/main/index.js','utf8'))
assert.match(main,/["']?enforcement["']?:\s*true/)
assert.ok(main.includes('https://terminal-buddy-billing.netlify.app'))
assert.ok(main.includes('terminal-buddy-subscription'))
for(const file of asar.listPackage(archive)){
 assert.doesNotMatch(file,/(?:^|[\\/])(?:billing|\.local|tests)(?:[\\/])|(?:^|[\\/])\.env$/)
 if(/\.(js|json|html)$/.test(file))assert.doesNotMatch(asar.extractFile(archive,file.slice(1)).toString(),/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|BEGIN PRIVATE KEY|postgres(?:ql)?:\/\//)
}
const notices=JSON.parse(await readFile(join(resources,'resources/third-party-manifest.json'),'utf8'))
assert.equal(notices.applicationVersion,pkg.version);assert.equal(notices.issues.length,0)
for(const name of ['react','react-dom','scheduler','zustand','@xterm/xterm','@lydell/node-pty','electron'])assert.ok(notices.entries.some(e=>e.name===name))
assert.ok((await stat(join(resources,'resources/LICENSES.chromium.html'))).size>1000)
const executable=mac?join(bundle,'MacOS',product):join(bundle,product+'.exe')
let signingStatus,minimumOS,binaryProductVersion
if(mac){
 const signature=spawnSync('/usr/bin/codesign',['-dvv',executable],{encoding:'utf8'})
 assert.equal(signature.status,0)
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',dirname(bundle)],{stdio:'pipe'})
 signingStatus=signature.stderr.includes('Signature=adhoc')?'ad-hoc':signature.stderr.includes('Authority=Developer ID Application:')?'developer-id':'other'
 minimumOS=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :LSMinimumSystemVersion',join(bundle,'Info.plist')],{encoding:'utf8'}).trim()
 const architecture=execFileSync('/usr/bin/lipo',['-archs',executable],{encoding:'utf8'}).trim()
 assert.ok(architecture.includes(arch==='x64'?'x86_64':'arm64'))
}else{
 const encoded=Buffer.from(resolve(executable)).toString('base64')
 const result=JSON.parse(execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"')); @{signingStatus=(Get-AuthenticodeSignature -LiteralPath $p).Status.ToString();productVersion=(Get-Item -LiteralPath $p).VersionInfo.ProductVersion}|ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}))
 signingStatus=result.signingStatus;binaryProductVersion=result.productVersion
 // Windows PE uses a numeric four-part version; package.json retains the full beta version.
 assert.ok([pkg.version,pkg.version.split('-')[0]+'.0'].includes(binaryProductVersion),'Windows numeric product version must match the package version')
}
const installer=process.argv.includes('--installer')
const files=mac?[`Terminal-Buddy-Subscription-${pkg.version}-mac-${arch}.dmg`,`Terminal-Buddy-Subscription-${pkg.version}-mac-${arch}.zip`]:[installer?`Terminal-Buddy-Setup-${pkg.version}-${arch}.exe`:`Terminal-Buddy-Subscription-${pkg.version}-${arch}.zip`]
const assets=[]
for(const filename of files){
 const path=join('release-commercial',filename),bytes=await readFile(path)
 if(mac)execFileSync(filename.endsWith('.dmg')?'/usr/bin/hdiutil':'/usr/bin/unzip',filename.endsWith('.dmg')?['verify',path]:['-tq',path],{stdio:'pipe'})
 else{
  const tool=resolve('node_modules/electron-winstaller/vendor/7z.exe')
  execFileSync(tool,['t',path],{stdio:'pipe',windowsHide:true})
  let container=path
  if(installer){
   assert.equal(bytes.subarray(0,2).toString(),'MZ')
   const destination=resolve('artifacts/installer-payload');await mkdir(destination,{recursive:true})
   execFileSync(tool,['x','-y','-o'+destination,path,'$PLUGINSDIR/app-64.7z'],{stdio:'pipe',windowsHide:true})
   container=join(destination,'$PLUGINSDIR/app-64.7z')
   execFileSync(tool,['t',container],{stdio:'pipe',windowsHide:true})
  }
  const shipped=execFileSync(tool,['x','-so',container,'resources\\app.asar'],{maxBuffer:20*1024*1024,windowsHide:true})
  assert.equal(createHash('sha256').update(shipped).digest('hex'),createHash('sha256').update(await readFile(archive)).digest('hex'))
  const shippedNotices=execFileSync(tool,['x','-so',container,'resources\\resources\\THIRD_PARTY_LICENSES.txt'],{maxBuffer:10*1024*1024,windowsHide:true}).toString()
  assert.equal(shippedNotices,await readFile(join(resources,'resources/THIRD_PARTY_LICENSES.txt'),'utf8'))
  assert.ok(shippedNotices.includes('StdUtils plug-in LGPL Clarification'))
 }
 assets.push({filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),platform:mac?'macos':'windows',architecture:arch,signingStatus,...(mac?{minimumOS,notarization:'not-verified'}:{binaryProductVersion})})
}
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()
const dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim()
await mkdir('release-commercial',{recursive:true})
await writeFile(`release-commercial/manifest-${mac?'macos':'windows'}-${arch}.json`,JSON.stringify({version:pkg.version,channel:'subscription-opt-in',applicationLicense:pkg.license,enforcement:true,sourceCommit,dirty,assets},null,2)+'\n')
console.log('PASS subscription package/version/notices/secrets/container checks. '+(dirty?'Source is dirty; commit before publication.':'Source commit recorded.')+' '+JSON.stringify(assets))
