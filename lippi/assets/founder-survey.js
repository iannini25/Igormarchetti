(() => {
  const form = document.getElementById('founder-survey-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('survey-status');
  const success = document.getElementById('survey-success');
  const fields = [...form.querySelectorAll('select')];
  const tr = text => window.LippiI18n?.translate(text) || text;
  let lastMessage = '', lastError = false;
  const followUp = form.elements.follow_up;
  const email = form.elements.contact_email;
  function updateFollowUp() {
    email.disabled = !followUp.checked;
    email.required = followUp.checked;
    document.getElementById('follow-up-field').hidden = !followUp.checked;
    if (email.disabled) email.value = '';
  }
  followUp.addEventListener('change', updateFollowUp);
  updateFollowUp();
  const pilotDetails = document.getElementById('pilot-details');
  const pilotFields = [...pilotDetails.querySelectorAll('select')];
  const otherInputs = new Map();
  for (const field of fields) {
    const combined = [...field.options].find(option => option.value === 'Other or unsure');
    if (combined) {
      combined.value = 'Unsure';
      combined.textContent = 'Unsure';
    }
    if (![...field.options].some(option => /^Other\b/.test(option.value))) {
      field.add(new Option('Other', 'Other'));
    }
    const container = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.id = field.id + '-other';
    input.maxLength = 160;
    input.pattern = '.*\\S.*';
    label.htmlFor = input.id;
    label.textContent = 'Please specify';
    container.append(label, input);
    field.parentElement.append(container);
    function sync() {
      const active = !field.disabled && /^Other\b/.test(field.value);
      container.hidden = !active;
      input.disabled = !active;
      input.required = active;
    }
    otherInputs.set(field, {input, sync});
    field.addEventListener('change', sync);
    sync();
  }
  function updatePilot() {
    const skip = form.elements.pilot.value === 'No';
    pilotDetails.hidden = skip;
    for (const field of pilotFields) {
      field.disabled = skip;
      field.required = !skip;
      otherInputs.get(field).sync();
    }
  }
  form.elements.pilot.addEventListener('change', updatePilot);
  updatePilot();
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
      submit.disabled=false; say('Ready when you are. Submit when you are ready.');
    } catch { say('The survey is temporarily unavailable. Please refresh this page and try again later.',true); }
  }
  form.addEventListener('submit',async event=> {
    event.preventDefault();
    if (busy || submit.disabled) return;
    if (!form.reportValidity()) return;
    busy=true; submit.disabled=true; submit.textContent=tr('Sending…');
    const answers = Object.fromEntries(fields.map(field => {
      const {input} = otherInputs.get(field);
      const value = input.disabled ? field.value : {choice:field.value, detail:input.value.trim()};
      return [field.name, field.disabled ? null : value];
    }));
    fields.forEach(field=>field.disabled=true);
    submissionId ||= uuid();
    const body={submission_id:submissionId,survey_version:'company-v4',notice_version:'2026-11-23-combined',identity:{company:form.elements.company_name.value.trim(),name:form.elements.participant_name.value.trim(),follow_up:followUp.checked,email:followUp.checked?email.value.trim():''},answers,website:form.elements.website.value};
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
      submit.disabled=false; fields.forEach(field=>field.disabled=false); updatePilot();
    } finally { busy=false;submit.textContent=tr('Submit survey'); }
  });
  available();
})();
