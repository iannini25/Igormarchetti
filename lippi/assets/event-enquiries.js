// Open the visitor’s mail app with an editable workshop enquiry.
function updateEnquiryLinks() {
  const translate = text => window.LippiI18n?.translate(text) || text;
  const email = 'mailto:lippi@igormarchetti.me?subject=';
  const brief = ['GRC topic or risk', 'Team size', 'Preferred Saturday']
    .map(field => translate(field) + ': ').join('\n');
  const quote = email + encodeURIComponent(translate('Lippi GRC workshop quote')) + '&body=' + encodeURIComponent(brief);
  document.querySelectorAll('[data-enquiry="team"]').forEach(link => { link.href = quote; });
  const publicDate = document.querySelector('[data-enquiry="public"]');
  if (publicDate) publicDate.href = email + encodeURIComponent(translate('Next public Lippi workshop'));
}
document.addEventListener('lippi:languagechange', updateEnquiryLinks);
updateEnquiryLinks();
