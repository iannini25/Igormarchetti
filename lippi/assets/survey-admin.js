(() => {
 let key='';
 const login=document.getElementById('login'),dashboard=document.getElementById('dashboard'),status=document.getElementById('status'),responses=document.getElementById('responses');
 const say=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
 async function api(path) {
  const r=await fetch('/api/founder-survey/admin/'+path,{headers:{Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok) {let error;try{error=(await r.json()).error;}catch{}throw new Error(error||'Unable to retrieve responses.');}return r;
 }
 function signOut(){key='';responses.replaceChildren();dashboard.hidden=true;login.hidden=false;document.getElementById('admin-key').value='';say('Signed out.');}
 async function refresh(){
  say('Loading responses…');
  const data=await (await api('responses')).json();
  responses.replaceChildren();document.getElementById('count').textContent=data.count+' '+(data.count===1?'response':'responses');
  for(const row of data.responses){
   const article=document.createElement('article');article.className='card';
   const meta=document.createElement('p');meta.className='response-date';meta.textContent=new Date(row.created_at).toLocaleString()+' · Reference '+row.id;article.append(meta);
   for(const [field,label] of [['milestone_risk','1. Milestone and risk'],['control_gap','2. Control gaps and previous efforts'],['support_needed','3. Desired support and constraints']]){
    const h=document.createElement('h2'),p=document.createElement('p');h.textContent=label;p.className='response';p.textContent=row[field];article.append(h,p);
   }responses.append(article);
  }
  if(!data.count){const p=document.createElement('p');p.textContent='No responses yet. New submissions will appear here after they are saved.';responses.append(p);}
  login.hidden=true;dashboard.hidden=false;say('Responses loaded.');
 }
 login.addEventListener('submit',async e=>{e.preventDefault();key=document.getElementById('admin-key').value;document.getElementById('admin-key').value='';try{await refresh();}catch(error){key='';say(error.message,true);}});
 document.getElementById('refresh').addEventListener('click',()=>refresh().catch(e=>say(e.message,true)));
 document.getElementById('logout').addEventListener('click',signOut);
 for(const button of document.querySelectorAll('[data-export]'))button.addEventListener('click',async()=>{
  button.disabled=true;try{
   const response=await api(button.dataset.export),blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=button.dataset.export==='analysis-pack.json'?'lippi-survey-ai-analysis-pack.json':'lippi-survey-responses.'+button.dataset.export.split('.').pop();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);say('Export downloaded. Review free text before sharing it with an AI service.');
  }catch(e){say(e.message,true);}finally{button.disabled=false;}
 });
})();
