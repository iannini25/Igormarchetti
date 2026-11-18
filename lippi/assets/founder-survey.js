(() => {
  const form = document.getElementById('founder-survey-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('survey-status');
  const success = document.getElementById('survey-success');
  const draft = document.getElementById('survey-mail-draft');
  const answers = [...form.querySelectorAll('textarea')];
  const contacts = [...form.querySelectorAll('.survey-contact input')];
  const fields = [...contacts, ...answers];
  let submissionId;
  let busy = false;
  let emailMode = false;

  function say(message, error = false) {
    status.textContent = message;
    status.classList.toggle('survey-error', error);
  }
  function useEmail() {
    emailMode = true;
    submit.disabled = false;
    submit.textContent = 'Prepare email to Igor';
    say('Online saving is unavailable. You can send these details from your email app instead.');
  }
  function prepareEmail() {
    const lines = fields.map(field => field.labels[0].textContent.trim() + '\n' + field.value.trim());
    draft.href = 'mailto:lippifintech@igormarchetti.me?subject=' + encodeURIComponent('My fintech enquiry') +
      '&body=' + encodeURIComponent(lines.join('\n\n'));
    draft.hidden = false;
    draft.focus();
    say('Open the draft and press Send in your email app to contact Igor.');
  }
  form.addEventListener('input', event => {
    const field = event.target;
    field.setCustomValidity('');
    draft.hidden = true;
    draft.removeAttribute('href');
    if (answers.includes(field)) document.getElementById(field.id + '-count').textContent = field.value.length + ' / 1,000';
  });

  async function available() {
    try {
      const response = await fetch('/api/founder-survey/health', {cache:'no-store', signal:AbortSignal.timeout(12000)});
      const data = await response.json();
      if (!response.ok || !data.ready || data.survey_version !== 'founder-v2') throw new Error();
      submit.disabled = false;
      say('Ready when you are.');
    } catch { useEmail(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || submit.disabled) return;
    for (const field of contacts) field.value = field.value.trim();
    for (const field of answers) field.setCustomValidity(field.value.trim().length < 5 ? 'Please add at least five characters.' : '');
    if (!form.reportValidity()) return;
    if (emailMode) { prepareEmail(); return; }

    busy = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    fields.forEach(field => {field.readOnly = true;});
    submissionId ||= crypto.randomUUID();
    const data = Object.fromEntries(fields.map(field => [field.name, field.value.trim()]));
    Object.assign(data, {submission_id:submissionId, survey_version:'founder-v2', notice_version:'2026-11-18', website:form.elements.website.value});
    say('Saving your enquiry…');
    try {
      const response = await fetch('/api/founder-survey', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data), signal:AbortSignal.timeout(15000)});
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.id !== submissionId) {
        if (response.status === 409) submissionId = undefined;
        throw new Error(result.error || 'Your enquiry could not be confirmed. Please try again.');
      }
      form.hidden = true;
      success.hidden = false;
      document.getElementById('survey-reference').textContent = result.id;
      say('');
      success.focus();
    } catch (error) {
      say(error.name === 'TimeoutError' ? 'Saving timed out. Your answers are still here. Please retry.' : error.message, true);
      submit.disabled = false;
    } finally {
      fields.forEach(field => {field.readOnly = false;});
      busy = false;
      submit.textContent = 'Submit survey';
    }
  });
  available();
})();
