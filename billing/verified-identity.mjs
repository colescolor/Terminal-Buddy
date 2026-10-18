// Never infer MFA from user metadata or merely decode an unsigned JWT.
export async function verifiedIdentity(auth,token){
 const denied=()=>Object.assign(Error('Verify your email and sign in again.'),{status:401})
 if(typeof token!=='string'||token.length>8192)throw denied()
 const {data,error}=await auth.getUser(token)
 if(error||!data?.user)throw denied()
 const claims=await auth.getClaims(token)
 if(claims.error||claims.data?.claims?.sub!==data.user.id)throw denied()
 return {...data.user,aal:claims.data.claims.aal}
}
