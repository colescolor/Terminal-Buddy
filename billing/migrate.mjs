import {Pool} from 'pg'
import {migrate} from './db.mjs'
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL for the approved test database.')
const pool=new Pool({connectionString:process.env.DATABASE_URL})
try{await migrate(pool);console.log('Billing schema applied.')}finally{await pool.end()}
