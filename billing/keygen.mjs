import {generateKeyPairSync} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
await mkdir('.local',{recursive:true})
const keys=generateKeyPairSync('ed25519')
// Exclusive creation prevents silent key rotation. Never print a signing secret.
await writeFile('.local/entitlement-private.pem',keys.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600})
await writeFile('.local/entitlement-public.pem',keys.publicKey.export({type:'spki',format:'pem'}),{flag:'wx',mode:0o600})
console.log('Created .local/entitlement-private.pem and .local/entitlement-public.pem. Private key is server-only. Store it in the approved secret manager; do not commit either local key file.')
