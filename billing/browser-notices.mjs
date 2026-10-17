import {readFile,readdir,writeFile} from 'node:fs/promises'
import {dirname,join,resolve,sep} from 'node:path'
export async function browserNotices(builds){
 const packages=new Map(),root=resolve('node_modules')
 for(const result of builds)for(const module of Object.keys(result.metafile.inputs)){
  if(!module.replaceAll('\\','/').includes('node_modules/'))continue
  let dir=dirname(resolve(module))
  while(dir.startsWith(root+sep)){
   let metadata;try{metadata=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))}catch{dir=dirname(dir);continue}
   if(!metadata.name||!metadata.version){dir=dirname(dir);continue}
   packages.set(dir,metadata);break
  }
 }
 const notices=[]
 for(const [dir,pkg] of packages){
  const names=(await readdir(dir)).filter(n=>/^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(n))
  if(!names.length||!pkg.license)throw Error('Browser dependency notice needs review: '+pkg.name+'@'+pkg.version)
  notices.push({label:pkg.name+' '+pkg.version+' ('+pkg.license+')',text:(await Promise.all(names.map(n=>readFile(join(dir,n),'utf8')))).join('\n\n')})
 }
 notices.sort((a,b)=>a.label.localeCompare(b.label))
 await writeFile('public/THIRD_PARTY_LICENSES.txt','Terminal Buddy account/owner pages — bundled browser dependencies\n\n'+notices.map(n=>n.label+'\n'+'='.repeat(60)+'\n'+n.text).join('\n\n'))
 console.log('Preserved full browser notices for '+notices.length+' bundled packages.')
}
