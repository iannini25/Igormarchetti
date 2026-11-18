(() => {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  const status = document.getElementById('newsletter-status');
  const button = form.querySelector('button[type="submit"]');
  const emailFallback = document.getElementById('newsletter-email-fallback');
  const emailDraft = document.getElementById('newsletter-email-draft');
  const initialButton = button.textContent;
  const noticeVersion = '2026-11-18';
  let busy = false;
  let registrationMode = 'checking';
  const update = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const useEmailFallback = message => {
    registrationMode = 'email';
    button.disabled = false;
    button.textContent = 'Prepare email request';
    update(message || 'Online registration is unavailable. Enter your details and consent, then prepare an email request to send from your email app.');
  };
  const prepareEmail = payload => {
    const language = {en:'English', pt:'Português', es:'Español'}[payload.language];
    if (!language || payload.consent !== true) {
      update('Please choose a preferred language and confirm your consent.', 'error');
      return;
    }
    const body = [
      'Hello Igor,', '',
      'Please add me to the Lippi newsletter list.', '',
      `Email address: ${payload.email}`,
      `Preferred language: ${language}`, '',
      'I agree to receive Lippi articles and regulatory updates by email. I can withdraw my consent at any time by emailing lippifintech@igormarchetti.me.',
      `Consent notice version: ${noticeVersion}`, '',
      'Thank you.'
    ].join('\n');
    emailDraft.href = `mailto:lippifintech@igormarchetti.me?subject=${encodeURIComponent('Lippi newsletter request')}&body=${encodeURIComponent(body)}`;
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

  form.addEventListener('input', () => { emailFallback.hidden = true; });

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
    button.textContent = 'Saving your request…';
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
        throw Object.assign(new Error(result.error || 'We could not save your request. Please try again or email Igor.'), {httpStatus:response.status});
      }
      form.hidden = true;
      update('Thank you — your newsletter request and consent have been saved. No automatic confirmation email is sent. You can unsubscribe at any time by emailing Igor.', 'success');
      status.setAttribute('tabindex', '-1');
      status.focus();
    } catch (error) {
      fields.forEach(field => { field.disabled = false; });
      if (!error.httpStatus || error.httpStatus >= 500) {
        useEmailFallback('We could not confirm online registration. You can prepare an email request below, then send it yourself from your email app.');
      } else {
        update(error.message || 'We could not save your request. Please try again or email Igor.', 'error');
        button.disabled = false;
      }
    } finally {
      busy = false;
      button.textContent = registrationMode === 'email' ? 'Prepare email request' : initialButton;
    }
  });
  ready();
})();
