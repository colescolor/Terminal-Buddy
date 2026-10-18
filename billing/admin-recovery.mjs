export function recoveryInbox(call){
 const panel=document.getElementById('recovery-inbox'),rows=document.getElementById('recovery-rows'),status=document.getElementById('recovery-status')
 let generation=0
 async function refresh(){
  const current=++generation;status.textContent='Loading recovery requests…'
  try{
   const result=await call('/admin/recovery/list',{closed:document.getElementById('recovery-closed').checked})
   if(current!==generation)return
   rows.replaceChildren();panel.hidden=false
   for(const request of result.requests){
    const card=document.createElement('section');card.className='panel'
    for(const value of ['Request '+request.id,'Claimed original email: '+request.originalEmail,'Verified contact: '+request.contactEmail,'Status: '+request.status,request.reason]){const p=document.createElement('p');p.textContent=value;card.append(p)}
    const label=document.createElement('label');label.textContent='Private reply to requester';const reply=document.createElement('textarea');reply.rows=3;reply.maxLength=1000;reply.value=request.reply;label.append(reply);card.append(label)
    for(const [value,title] of [['review','Send reply / mark under review'],['closed','Send reply / close request']]){
     const button=document.createElement('button');button.textContent=title;button.type='button';card.append(button)
     button.onclick=async()=>{
      if(!reply.value.trim()){status.textContent='Write a private reply before updating the request.';reply.focus();return}
      card.querySelectorAll('button').forEach(b=>b.disabled=true)
      try{await call('/admin/recovery/review',{id:request.id,revision:request.revision,status:value,reply:reply.value});if(current!==generation)return;await refresh()}
      catch(e){if(current===generation){status.textContent=e.message;card.querySelectorAll('button').forEach(b=>b.disabled=false)}}
     }
    }
    rows.append(card)
   }
   status.textContent=result.requests.length+' requests shown (maximum 50). Updates here never change login emails, subscriptions or admin permissions.'
  }catch(e){if(current===generation){rows.replaceChildren();status.textContent=e.message}}
 }
 document.getElementById('recovery-refresh').onclick=()=>void refresh()
 document.getElementById('recovery-closed').onchange=()=>void refresh()
 return {refresh,clear(){generation++;rows.replaceChildren();panel.hidden=true;status.textContent=''}}
}
