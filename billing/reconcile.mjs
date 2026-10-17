import {runtime} from './runtime.mjs'
const {api}=runtime()
try{console.log(await api.reconcile());process.exit(0)}catch{console.error('Reconciliation failed. No provider payload logged.');process.exit(1)}
