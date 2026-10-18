import {runtime} from './runtime.mjs'
const {api}=runtime()
try{const result=await api.reconcile();console.log(result);process.exit(result.failed?1:0)}catch{console.error('Reconciliation failed. No provider payload logged.');process.exit(1)}
