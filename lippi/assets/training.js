(() => {
  const sample = document.getElementById('sample-question');
  sample?.addEventListener('submit', event => {
    event.preventDefault();
    if (!sample.reportValidity()) return;
    const selected = new FormData(sample).get('owner');
    const answer = document.getElementById('sample-answer');
    answer.textContent = (selected === 'business' ? 'Yes. ' : 'The business or service owner should lead. ') + 'Management owns the operational response and corrective actions. Risk and compliance guide, monitor and challenge. Internal audit provides independent assurance. The board oversees the response and holds management accountable.';
    answer.hidden = false;
  });

  const form = document.getElementById('training-interest-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('training-status');
  const optIn = document.getElementById('contact-opt-in');
  const email = document.getElementById('training-email');
  const contact = document.getElementById('contact-details');
  const marketFields = [...form.querySelectorAll('[name="target_markets"]')];
  let ready = false, busy = false, submissionId = null, sentBody = null;
  const say = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
  optIn.addEventListener('change', () => { contact.hidden = !optIn.checked; email.required = optIn.checked; if (!optIn.checked) email.value = ''; });
  marketFields.forEach(field => field.addEventListener('change', () => marketFields[0].setCustomValidity('')));

  async function checkReady() {
    try {
      const response = await fetch('/api/training-interest/health', {cache: 'no-store', signal: AbortSignal.timeout(12000)});
      const data = await response.json();
      if (!response.ok || data.ready !== true || data.survey_version !== 'training-v1') throw new Error();
      ready = true; button.disabled = false; say('Ready when you are. Contact details are optional.');
    } catch {
      say('The survey is temporarily unavailable. You can email lippifintech@igormarchetti.me about the paid pilot, or refresh to try again.', true);
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy) return;
    marketFields[0].setCustomValidity(marketFields.some(f => f.checked) ? '' : 'Please select at least one market, or Still exploring.');
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      survey_version: 'training-v1', notice_version: '2026-11-17',
      target_markets: data.getAll('target_markets'), priority: data.get('priority'), budget: data.get('budget'),
      format: data.get('format'), language: data.get('language'), business_model: data.get('business_model').trim(),
      home_market: data.get('home_market').trim(), comment: data.get('comment').trim(), referral: data.get('referral').trim(),
      contact_opt_in: optIn.checked, email: optIn.checked ? email.value.trim() : '', website: data.get('website')
    };
    const serialised = JSON.stringify(payload);
    if (sentBody !== serialised) { submissionId = crypto.randomUUID(); sentBody = serialised; }
    busy = true; button.disabled = true; button.textContent = 'Submitting…'; say('Saving your response…');
    const controls = [...form.querySelectorAll('input, select, textarea')];
    controls.forEach(el => { el.disabled = true; });
    try {
      const response = await fetch('/api/training-interest', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...payload, submission_id: submissionId}), signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.id !== submissionId) throw new Error(result.error || 'Your response was not confirmed. Please try again.');
      document.getElementById('training-reference').textContent = result.id;
      const success = document.getElementById('training-success');
      form.hidden = true; success.hidden = false; success.focus();
    } catch (error) {
      say(error.name === 'TimeoutError' ? 'The connection timed out. Your answers are still here; please retry.' : error.message || 'Your response was not confirmed. Please try again.', true);
    } finally {
      busy = false; button.disabled = false; button.textContent = 'Submit interest';
      controls.forEach(el => { el.disabled = false; });
    }
  });
  checkReady();
})();
