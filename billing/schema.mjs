// Explicit environment separation while sharing Supabase authentication.
export function databaseSchema(env={}) {
 const schema=env.DATABASE_SCHEMA||'public'
 if(!['public','terminal_buddy_live'].includes(schema))throw Error('Unsupported billing database schema.')
 if(env.BILLING_MODE==='live'&&schema!=='terminal_buddy_live')throw Error('Live billing requires its isolated production schema.')
 if(env.BILLING_MODE!=='live'&&schema!=='public')throw Error('Sandbox billing cannot use the production schema.')
 return schema
}
export function schemaIdentifier(schema){
 if(!['public','terminal_buddy_live'].includes(schema))throw Error('Unsupported billing database schema.')
 return '"'+schema+'"'
}
