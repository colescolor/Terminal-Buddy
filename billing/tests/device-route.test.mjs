import test from 'node:test'
import assert from 'node:assert/strict'
import api from '../functions/api.mjs'
import start,{config} from '../functions/device-start.mjs'
test('device initiation cannot bypass its dedicated platform rate limit through the catch-all or direct function URL',async()=>{
 for(const path of ['/api/device/start','/.netlify/functions/api/device/start','/device/start'])assert.equal((await api(new Request('https://billing.example.invalid'+path,{method:'POST',body:'{}'}))).status,404)
 assert.equal((await start(new Request('https://billing.example.invalid/.netlify/functions/device-start',{method:'POST',body:'{}'}))).status,404)
 assert.equal(config.path,'/api/device/start');assert.equal(config.rateLimit.windowLimit,10);assert.equal(config.rateLimit.windowSize,60);assert.deepEqual(config.rateLimit.aggregateBy,['ip','domain'])
})
