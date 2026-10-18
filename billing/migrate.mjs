import {Pool} from 'pg'
import {databaseConnection} from './connection.mjs'
import {migrate} from './db.mjs'
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL for the approved test database.')
const pool=new Pool(databaseConnection(process.env))
try{await migrate(pool);console.log('Billing schema applied.')}finally{await pool.end()}
