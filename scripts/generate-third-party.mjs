import {readFile,writeFile,mkdir,readdir,appendFile,copyFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
const pkg=JSON.parse(await readFile('package.json','utf8'))
const renderer=JSON.parse(await readFile('out/renderer/runtime-dependencies.json','utf8'))
const queue=[...Object.keys(pkg.dependencies),...renderer,'electron'],seen=new Set(),entries=[],issues=[]
const fallbacks={'@xterm/headless@6.0.0':'resources/third-party/xterm-6.0.0-LICENSE.txt','@xterm/addon-serialize@0.14.0':'resources/third-party/xterm-6.0.0-LICENSE.txt'}
while(queue.length){
 const name=queue.shift();if(seen.has(name))continue;seen.add(name)
 const directory=join('node_modules',name)
 let metadata
 try{metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'))}catch{issues.push('Missing installed package: '+name);continue}
 if(name!=='electron')for(const dependency of Object.keys(metadata.dependencies||{}))queue.push(dependency)
 for(const dependency of Object.keys(metadata.optionalDependencies||{})){try{await readFile(join('node_modules',dependency,'package.json'));queue.push(dependency)}catch{/* Optional binary for another OS is not shipped. */}}
 let files=(await readdir(directory)).filter(file=>/^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(file))
 let notices=[]
 for(const file of files)notices.push({path:join(directory,file),text:await readFile(join(directory,file),'utf8')})
 const fallback=fallbacks[name+'@'+metadata.version]
 if(!notices.length&&fallback)notices=[{path:fallback,text:await readFile(fallback,'utf8')}]
 if(!metadata.license||!notices.length)issues.push('Review license/notice for '+name+'@'+metadata.version)
 entries.push({name,version:metadata.version,license:metadata.license||'UNRESOLVED',
  notices:notices.map(n=>({path:n.path.replaceAll('\\','/'),sha256:createHash('sha256').update(n.text).digest('hex')})),
  text:notices.map(n=>n.text).join('\n\n')})
}
entries.sort((a,b)=>a.name.localeCompare(b.name))
await mkdir('resources',{recursive:true})
// Electron's macOS distribution keeps this outside the .app. Copy it explicitly
// into our packaged resources so both DMG and ZIP include an accessible notice.
await copyFile('node_modules/electron/dist/LICENSES.chromium.html','resources/LICENSES.chromium.html')
await writeFile('resources/THIRD_PARTY_LICENSES.txt','Terminal Buddy '+pkg.version+' — third-party software\n\nThese notices apply to the named components, not to all application code.\nChromium and its embedded libraries: see LICENSES.chromium.html beside the installed executable, also available from Settings → Account → Chromium notices.\n\n'+entries.map(e=>e.name+' '+e.version+' ('+e.license+')\n'+'='.repeat(60)+'\n'+e.text).join('\n\n'))
await writeFile('resources/third-party-manifest.json',JSON.stringify({applicationVersion:pkg.version,entries:entries.map(({text,...entry})=>entry),issues},null,2)+'\n')
for(const filename of ['INSTALLER-NOTICES.txt','NSIS-3.12-LICENSE.txt','StdUtils-LGPL-2.1.txt','StdUtils-CLARIFICATION.txt','StdUtils-README.txt','UAC-LICENSE.txt','nsProcess-1.6-README.txt','nsis7z-19.00-LICENSE.txt','nsis7z-19.00-README.txt','SpiderBanner-README.txt']){
 await appendFile('resources/THIRD_PARTY_LICENSES.txt','\n\n'+filename+'\n'+'='.repeat(60)+'\n'+await readFile('resources/third-party/'+filename,'utf8'))
}
if(issues.length)throw Error(issues.join('\n'))
console.log('Generated notices for '+entries.length+' actual runtime packages; Chromium notices retained separately.')
