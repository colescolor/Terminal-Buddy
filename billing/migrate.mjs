import {Pool} from 'pg'
import {databaseConnection} from './connection.mjs'
import {migrate,postgres} from './db.mjs'
import {databaseSchema} from './schema.mjs'
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL for the intended billing database.')
const pool=new Pool(databaseConnection(process.env))
const schema=databaseSchema(process.env)
try{await postgres(pool,{schema}).transaction(client=>migrate(client,{schema}));console.log('Billing schema applied: '+schema)}finally{await pool.end()}
