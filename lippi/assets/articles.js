(() => {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  const status = document.getElementById('newsletter-status');
  const button = form.querySelector('button[type="submit"]');
  const emailFallback = document.getElementById('newsletter-email-fallback');
  const emailDraft = document.getElementById('newsletter-email-draft');
  // Keep the English source label; the DOM may already be localized at script start.
  const initialButton = 'Subscribe';
  const tr = text => window.LippiI18n?.translate(text) || text;
  let lastMessage = '', lastState = '';
  const languageSelect = document.getElementById('newsletter-language');
  if (languageSelect && !document.getElementById('newsletter-language-note')) {
    const note = document.createElement('p');
    note.id = 'newsletter-language-note';
    note.className = 'newsletter-privacy';
    note.textContent = tr('Newsletter emails are currently available in English, Portuguese and Spanish. The website can also be viewed in Italian.');
    languageSelect.insertAdjacentElement('afterend',note);
  }
  const noticeVersion = '2026-11-24';
  let busy = false;
  let registrationMode = 'checking';
  let pendingDraftPayload = null;
  const update = (message, state = '') => {
    lastMessage = message; lastState = state;
    status.textContent = tr(message);
    status.dataset.state = state;
  };
  document.addEventListener('lippi:languagechange',()=>{
    if(lastMessage) status.textContent = tr(lastMessage);
    const note = document.getElementById('newsletter-language-note');
    if(note) note.textContent = tr('Newsletter emails are currently available in English, Portuguese and Spanish. The website can also be viewed in Italian.');
    if(registrationMode === 'email') button.textContent = tr('Prepare email request');
    if(pendingDraftPayload && !emailFallback.hidden) renderEmail(pendingDraftPayload);
  });
  const useEmailFallback = message => {
    registrationMode = 'email';
    button.disabled = false;
    button.textContent = tr('Prepare email request');
    update(message || 'Online registration is temporarily unavailable. Try again later or use the form to request a subscription by email.');
  };
  const renderEmail = payload => {
    const language = {en:'English', pt:'Português', es:'Español'}[payload.language];
    if (!language || payload.consent !== true) return false;
    const body = [
      tr('Hello Igor Marchetti Lippi,'), '',
      tr('Please add me to the Lippi newsletter list.'), '',
      tr('Email address:') + ' ' + payload.email,
      tr('Preferred language: ') + language, '',
      tr('I agree to receive Lippi articles and regulatory updates by email. I can withdraw my consent at any time by emailing lippi@igormarchetti.me.'),
      tr('Consent notice version:') + ' ' + noticeVersion, '',
      tr('Thank you.')
    ].join('\n');
    emailDraft.href = `mailto:lippi@igormarchetti.me?subject=${encodeURIComponent(tr('Lippi newsletter request'))}&body=${encodeURIComponent(body)}`;
    return true;
  };
  const prepareEmail = payload => {
    if (!renderEmail(payload)) {
      update('Please choose a preferred language and confirm your consent.', 'error');
      return;
    }
    pendingDraftPayload = payload;
    emailFallback.hidden = false;
    update('Your email draft is ready. Open it below, review it and select Send in your email app. Nothing is sent automatically.');
    emailDraft.focus();
  };

  async function ready() {
    try {
      const response = await fetch('/api/newsletter/health', {cache:'no-store', signal:AbortSignal.timeout(12000)});
      const result = await response.json();
      if (!response.ok || result.ready !== true || result.notice_version !== noticeVersion) throw new Error('Unavailable');
      registrationMode = 'online';
      button.disabled = false;
      update('Enter your email and confirm your consent to save a newsletter request.');
    } catch {
      useEmailFallback();
    }
  }

  form.addEventListener('input', () => { pendingDraftPayload = null; emailFallback.hidden = true; });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || button.disabled || !form.reportValidity()) return;
    const payload = {
      email:form.elements.email.value.trim(),
      language:form.elements.language.value,
      consent:form.elements.consent.checked,
      notice_version:noticeVersion,
      website:form.elements.website.value
    };
    if (payload.website) {
      update('The request could not be accepted.', 'error');
      return;
    }
    if (registrationMode === 'email') {
      prepareEmail(payload);
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = tr('Saving your request…');
    update('Saving your newsletter request…');
    const fields = [...form.querySelectorAll('input,select')];
    fields.forEach(field => { field.disabled = true; });
    try {
      const response = await fetch('/api/newsletter', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.status !== 'requested') {
        throw Object.assign(new Error(result.error || 'We could not save your request. Please try again or email Igor Marchetti Lippi.'), {httpStatus:response.status});
      }
      form.hidden = true;
      update('Thank you. We’ve recorded your newsletter registration.', 'success');
      status.setAttribute('tabindex', '-1');
      status.focus();
    } catch (error) {
      fields.forEach(field => { field.disabled = false; });
      if (!error.httpStatus || error.httpStatus >= 500) {
        useEmailFallback('We could not confirm online registration. You can prepare an email request below, then send it yourself from your email app.');
      } else {
        update(error.message || 'We could not save your request. Please try again or email Igor Marchetti Lippi.', 'error');
        button.disabled = false;
      }
    } finally {
      busy = false;
      button.textContent = tr(registrationMode === 'email' ? 'Prepare email request' : initialButton);
    }
  });
  ready();
})();
