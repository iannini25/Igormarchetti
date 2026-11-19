const enquiryLabels = {
  brazil: 'Brazil', ireland: 'Ireland', portugal: 'Portugal', uk: 'United Kingdom', unsure: 'Still exploring / not sure yet',
  licensing: 'Licensing and market choice', grc: 'GRC in practice', regulation: 'The main regulations', tools: 'RegTech, cybersecurity and AI tools', all: 'All four workshops',
  under100: 'Less than EUR 100', '100_199': 'EUR 100–199', '200_299': 'EUR 200–299', '300_499': 'EUR 300–499', '500plus': 'EUR 500 or more', no_budget: 'No budget currently', not_interested: 'Not interested',
  online: 'Live online', hybrid: 'Hybrid', in_person: 'In person', english: 'English', portuguese: 'Portuguese'
};

export function buildTrainingEmail(payload, translate = text => text) {
  // Keep English as the default for backward compatibility and automated use.
  // The public fallback form passes the active website translator instead.
  const label = value => translate(enquiryLabels[value] || String(value || 'Not specified'));
  const lines = [
    translate('Hello Igor,'), '', translate('Here are my interests in the Lippi paid training pilot:'), '',
    translate('Target markets: ') + payload.target_markets.map(label).join(', '),
    translate('Workshop priority: ') + label(payload.priority),
    translate('Budget per attendee for all four two-hour online workshops: ') + label(payload.budget),
    translate('Preferred format: ') + label(payload.format),
    translate('Preferred language: ') + label(payload.language)
  ];
  for (const [field, title] of [['home_market', 'Current market'], ['business_model', 'Business model'], ['comment', 'What the programme should help me do'], ['referral', 'How I heard about Lippi']]) {
    if (payload[field]) lines.push(translate(title) + ': ' + payload[field]);
  }
  lines.push(translate('Contact me about pilot dates, format and pricing: ') + translate(payload.contact_opt_in ? 'Yes' : 'No'));
  if (payload.contact_opt_in && payload.email) lines.push(translate('Preferred contact email: ') + payload.email);
  lines.push('', translate('This is an enquiry about the paid pilot; it does not confirm a booking or price.'));
  const body = lines.join('\n');
  return {
    body,
    mailto: 'mailto:lippifintech@igormarchetti.me?subject=' +
      encodeURIComponent(translate('Lippi paid training pilot enquiry')) + '&body=' + encodeURIComponent(body)
  };
}

(() => {
  if (typeof document === 'undefined') return;
  const sample = document.getElementById('sample-question');
  const answer = document.getElementById('sample-answer');
  const trSample = text => window.LippiI18n?.translate(text) || text;
  let selectedAnswer = null;
  function renderAnswer() {
    if (!selectedAnswer || !answer) return;
    answer.textContent = trSample(selectedAnswer === 'business' ? 'Yes. ' : 'The business or service owner should lead. ') +
      trSample('Management owns the operational response and corrective actions. Risk and compliance guide, monitor and challenge. Internal audit provides independent assurance. The board oversees the response and holds management accountable.');
    answer.hidden = false;
  }
  sample?.addEventListener('submit', event => {
    event.preventDefault();
    if (!sample.reportValidity()) return;
    selectedAnswer = new FormData(sample).get('owner');
    renderAnswer();
  });
  document.addEventListener('lippi:languagechange', renderAnswer);

  const form = document.getElementById('training-interest-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('training-status');
  const tr = text => window.LippiI18n?.translate(text) || text;
  let lastMessage = '', lastError = false;
  document.addEventListener('lippi:languagechange', () => {
    if (lastMessage) status.textContent = tr(lastMessage);
    if (!busy) button.textContent = tr(emailMode ? 'Prepare email enquiry' : 'Submit interest');
    if (pendingDraftPayload && !draftPanel.hidden) updateDraft(pendingDraftPayload);
  });
  const optIn = document.getElementById('contact-opt-in');
  const email = document.getElementById('training-email');
  const contact = document.getElementById('contact-details');
  const draftPanel = document.getElementById('training-email-fallback');
  const draftLink = document.getElementById('training-email-link');
  const draftText = document.getElementById('training-email-text');
  const marketFields = [...form.querySelectorAll('[name="target_markets"]')];
  let ready = false, emailMode = false, busy = false, submissionId = null, sentBody = null;
  let pendingDraftPayload = null;
  const updateDraft = payload => {
    const draft = buildTrainingEmail(payload, tr);
    draftLink.href = draft.mailto;
    draftText.value = draft.body;
  };
  const say = (message, error = false) => { lastMessage=message;lastError=error;status.textContent = tr(message); status.classList.toggle('error', error); };
  const useEmailFallback = () => {
    ready = false; emailMode = true; button.disabled = false; button.textContent = tr('Prepare email enquiry');
    say('Online registration is temporarily unavailable. You can prepare an email enquiry using your answers.');
  };
  const prepareEmail = payload => {
    pendingDraftPayload = payload;
    updateDraft(payload);
    draftPanel.hidden = false;
    say('Email draft prepared. Open it below, review it in your email app, and send it yourself. Nothing has been sent by this page.');
    draftLink.focus();
  };
  const clearDraft = () => {
    pendingDraftPayload = null;
    draftPanel.hidden = true;
    draftLink.removeAttribute('href');
  };
  form.addEventListener('input', clearDraft);
  form.addEventListener('change', clearDraft);
  optIn.addEventListener('change', () => { contact.hidden = !optIn.checked; email.required = optIn.checked; if (!optIn.checked) email.value = ''; });
  marketFields.forEach(field => field.addEventListener('change', () => marketFields[0].setCustomValidity('')));

  async function checkReady() {
    try {
      const response = await fetch('/api/training-interest/health', {cache: 'no-store', signal: AbortSignal.timeout(12000)});
      const data = await response.json();
      if (!response.ok || data.ready !== true || data.survey_version !== 'training-v1') throw new Error();
      ready = true; button.disabled = false; say('Ready when you are. Contact details are optional.');
    } catch {
      useEmailFallback();
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if ((!ready && !emailMode) || busy) return;
    marketFields[0].setCustomValidity(marketFields.some(f => f.checked) ? '' : tr('Please select at least one market, or Still exploring.'));
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      survey_version: 'training-v1', notice_version: '2026-11-17',
      target_markets: data.getAll('target_markets'), priority: data.get('priority'), budget: data.get('budget'),
      format: data.get('format'), language: data.get('language'), business_model: data.get('business_model').trim(),
      home_market: data.get('home_market').trim(), comment: data.get('comment').trim(), referral: data.get('referral').trim(),
      contact_opt_in: optIn.checked, email: optIn.checked ? email.value.trim() : '', website: data.get('website')
    };
    if (payload.website?.trim()) { say('The enquiry could not be accepted. Please refresh the page and try again.', true); return; }
    if (emailMode) { prepareEmail(payload); return; }
    const serialised = JSON.stringify(payload);
    if (sentBody !== serialised) { submissionId = crypto.randomUUID(); sentBody = serialised; }
    busy = true; button.disabled = true; button.textContent = tr('Submitting…'); say('Saving your response…');
    const controls = [...form.querySelectorAll('input, select, textarea')];
    controls.forEach(el => { el.disabled = true; });
    try {
      const response = await fetch('/api/training-interest', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...payload, submission_id: submissionId}), signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.id !== submissionId) {
        const error = new Error(result.error || 'Your response was not confirmed. Please try again.');
        error.storageUnavailable = response.status >= 500;
        throw error;
      }
      document.getElementById('training-reference').textContent = result.id;
      const success = document.getElementById('training-success');
      form.hidden = true; success.hidden = false; success.focus();
    } catch (error) {
      if (error.storageUnavailable || error.name === 'TimeoutError' || error instanceof TypeError || error instanceof SyntaxError) {
        useEmailFallback();
        prepareEmail(payload);
      } else {
        say(error.message || 'Your response was not confirmed. Please try again.', true);
      }
    } finally {
      busy = false; button.disabled = false; button.textContent = tr(emailMode ? 'Prepare email enquiry' : 'Submit interest');
      controls.forEach(el => { el.disabled = false; });
    }
  });
  checkReady();
})();
