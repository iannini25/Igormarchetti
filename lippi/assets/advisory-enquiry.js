(() => {
  const form = document.getElementById('enquiry-form');
  const enquiry = document.getElementById('enquiry');
  const message = document.getElementById('mail');
  const recipient = 'lippi@igormarchetti.me';
  const translate = key => window.LippiI18n?.translate(key) || key;

  function renderEmail() {
    const answers = Array.from(form.querySelectorAll('.question-grid label'), label => {
      const field = form.elements.namedItem(label.htmlFor);
      const value = field.tagName === 'SELECT' && field.value
        ? field.selectedOptions[0].textContent : field.value.trim();
      return label.querySelector('.qtitle').textContent + '\n' + (value || translate('Not provided'));
    });
    const reply = document.getElementById('reply');
    if (reply.value.trim()) answers.push(reply.labels[0].textContent + '\n' + reply.value.trim());
    const body = answers.join('\n\n');
    document.getElementById('mail-body').textContent = body;
    document.getElementById('send-email').href = 'mailto:' + recipient +
      '?subject=' + encodeURIComponent(translate('Advisory enquiry')) +
      '&body=' + encodeURIComponent(body.replaceAll('\n', '\r\n'));
  }

  function openLinkedEnquiry() {
    if (location.hash === '#enquiry' || location.hash === '#founder-survey') {
      enquiry.open = true;
      enquiry.scrollIntoView();
    }
  }
  document.getElementById('open-enquiry').addEventListener('click', () => { enquiry.open = true; });
  window.addEventListener('hashchange', openLinkedEnquiry);
  openLinkedEnquiry();
  form.addEventListener('submit', event => {
    event.preventDefault();
    renderEmail();
    message.hidden = false;
    message.focus();
  });
  form.addEventListener('input', () => { message.hidden = true; });
  document.addEventListener('lippi:languagechange', () => { if (!message.hidden) renderEmail(); });
  form.querySelector('button[type="submit"]').disabled = false;
})();
