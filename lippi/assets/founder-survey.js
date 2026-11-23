(() => {
  const form = document.getElementById('founder-survey-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('survey-status');
  const success = document.getElementById('survey-success');
  const fields = [...form.querySelectorAll('select')];
  const tr = text => window.LippiI18n?.translate(text) || text;
  let lastMessage = '', lastError = false;
  let busy = false;
  let submissionId = null;
  const uuid = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const say = (message, error=false) => { lastMessage=message;lastError=error;status.textContent=tr(message);status.classList.toggle('survey-error',error); };
  document.addEventListener('lippi:languagechange',()=>{if(lastMessage)status.textContent=tr(lastMessage);});
  async function available() {
    if (!/^https?:$/.test(location.protocol)) {
      say('This preview cannot send answers. The survey will work once the website is published.');
      return;
    }
    try {
      const response=await fetch('/api/founder-survey/health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if (!response.ok || data.ready!==true || data.survey_version!=='founder-v1') throw new Error();
      submit.disabled=false; say('Ready when you are. All ten questions are required.');
    } catch { say('The survey is temporarily unavailable. Please refresh this page and try again later.',true); }
  }
  form.addEventListener('submit',async event=> {
    event.preventDefault();
    if (busy || submit.disabled) return;
    if (!form.reportValidity()) return;
    busy=true; submit.disabled=true; submit.textContent=tr('Sending…');
    fields.forEach(field=>field.disabled=true);
    submissionId ||= uuid();
    const body={submission_id:submissionId,survey_version:'company-v2',notice_version:'2026-11-23',answers:Object.fromEntries(fields.map(field=>[field.name,field.value])),website:form.elements.website.value};
    say('Saving your answers…');
    try {
      const response=await fetch('/api/founder-survey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
      let result; try {result=await response.json();} catch {throw new Error('We could not confirm your answers were saved. They are still here. Please try again.');}
      if (!response.ok || result.saved!==true || result.id!==submissionId) throw new Error(result.error || 'We could not save your answers. Please try again.');
      form.hidden=true; success.hidden=false;
      document.getElementById('survey-reference').textContent=result.id;
      say(''); success.focus();
    } catch(error) {
      say(error.name==='TimeoutError'?'The connection timed out. Your answers are still here; please retry.':error.message || 'Your answers were not confirmed. Please try again.',true);
      submit.disabled=false; fields.forEach(field=>field.disabled=false);
    } finally { busy=false;submit.textContent=tr('Submit survey'); }
  });
  available();
})();
