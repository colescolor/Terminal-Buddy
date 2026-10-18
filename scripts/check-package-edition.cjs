const {readFileSync}=require('node:fs')
const {join}=require('node:path')
module.exports=async context=>{
 const code=readFileSync(join(context.packager.projectDir,'out/main/index.js'),'utf8')
 if(/["']?enforcement["']?:\s*true/.test(code)&&context.packager.appInfo.id!=='com.terminalbuddy.subscription'){
  throw Error('Subscription builds require electron-builder.commercial.yml so they cannot replace the historical free app identity.')
 }
}
