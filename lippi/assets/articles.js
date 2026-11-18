(() => {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  const status = document.getElementById('newsletter-status');
  const button = form.querySelector('button[type="submit"]');
  const initialButton = button.textContent;
  const noticeVersion = '2026-11-18';
  let busy = false;
  const update = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  async function ready() {
    try {
      const response = await fetch('/api/newsletter/health', {cache:'no-store', signal:AbortSignal.timeout(12000)});
      const result = await response.json();
      if (!response.ok || result.ready !== true || result.notice_version !== noticeVersion) throw new Error('Unavailable');
      button.disabled = false;
      update('Enter your email and confirm your consent to save a newsletter request.');
    } catch {
      update('Registration is temporarily unavailable. Please use the email link below to contact Igor.', 'error');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || button.disabled || !form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    button.textContent = 'Saving your request…';
    update('Saving your newsletter request…');
    const fields = [...form.querySelectorAll('input,select')];
    const payload = {
      email:form.elements.email.value.trim(),
      language:form.elements.language.value,
      consent:form.elements.consent.checked,
      notice_version:noticeVersion,
      website:form.elements.website.value
    };
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
        throw new Error(result.error || 'We could not save your request. Please try again or email Igor.');
      }
      form.hidden = true;
      update('Thank you — your newsletter request and consent have been saved. No automatic confirmation email is sent. You can unsubscribe at any time by emailing Igor.', 'success');
      status.setAttribute('tabindex', '-1');
      status.focus();
    } catch (error) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'The response took too long. Please try again; repeating the request will not add a duplicate email address.'
        : error.message;
      update(message || 'We could not save your request. Please try again or email Igor.', 'error');
      fields.forEach(field => { field.disabled = false; });
      button.disabled = false;
    } finally {
      busy = false;
      button.textContent = initialButton;
    }
  });
  ready();
})();
