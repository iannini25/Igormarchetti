(() => {
  const form = document.getElementById('founder-survey-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('survey-status');
  const success = document.getElementById('survey-success');
  const fields = [...form.querySelectorAll('textarea')];
  let busy = false;
  let submissionId = null;
  const uuid = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const say = (message, error=false) => { status.textContent=message; status.classList.toggle('survey-error',error); };
  for (const field of fields) {
    const count = document.getElementById(field.id+'-count');
    field.addEventListener('input',()=> { count.textContent=field.value.length+' / 1,000'; field.setCustomValidity(''); });
  }
  async function available() {
    if (!/^https?:$/.test(location.protocol)) {
      say('This preview cannot send answers. The survey will work once the website is published.');
      return;
    }
    try {
      const response=await fetch('/api/founder-survey/health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if (!response.ok || data.ready!==true || data.survey_version!=='founder-v1') throw new Error();
      submit.disabled=false; say('Ready when you are. All three questions are required.');
    } catch { say('The survey is temporarily unavailable. Please refresh this page and try again later.',true); }
  }
  form.addEventListener('submit',async event=> {
    event.preventDefault();
    if (busy || submit.disabled) return;
    for (const field of fields) field.setCustomValidity(field.value.trim().length<5?'Please add a short answer of at least 5 characters.':'');
    if (!form.reportValidity()) return;
    busy=true; submit.disabled=true; submit.textContent='Sending…';
    fields.forEach(field=>field.readOnly=true);
    submissionId ||= uuid();
    const body={submission_id:submissionId,survey_version:'founder-v1',notice_version:'2026-11-06',milestone_risk:fields[0].value.trim(),control_gap:fields[1].value.trim(),support_needed:fields[2].value.trim(),website:form.elements.website.value};
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
      submit.disabled=false; fields.forEach(field=>field.readOnly=false);
    } finally { busy=false;submit.textContent='Submit survey'; }
  });
  available();
})();
