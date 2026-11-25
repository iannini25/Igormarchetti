// Open the buyer’s own mail app with a short, editable brief.
function updateEnquiryLinks() {
  const translate = text => window.LippiI18n?.translate(text) || text;
  const team = document.querySelector('[data-enquiry="team"]');
  const publicDate = document.querySelector('[data-enquiry="public"]');
  const email = 'mailto:lippi@igormarchetti.me?subject=';
  const brief = ['My product or service', 'Target market', 'Team size', 'Preferred Saturday']
    .map(field => translate(field) + ': ').join('\n');
  team.href = email + encodeURIComponent(translate('Lippi team workshop quote')) + '&body=' + encodeURIComponent(brief);
  publicDate.href = email + encodeURIComponent(translate('Next public Lippi workshop'));
}
document.addEventListener('lippi:languagechange', updateEnquiryLinks);
updateEnquiryLinks();
