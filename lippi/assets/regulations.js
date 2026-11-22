(() => {
  'use strict';
  const form = document.getElementById('reg-filters');
  const search = document.getElementById('reg-search');
  const topic = document.getElementById('reg-topic');
  const territory = document.getElementById('reg-territory');
  const language = document.getElementById('reg-language');
  const count = document.getElementById('reg-result-count');
  const cards = [...document.querySelectorAll('[data-reg-id]')];
  if (!form || !language) return;
  let currentLanguage = 'en';
  let dataPromise;
  const readData = () => dataPromise ||= fetch('/assets/regulatory-content.json').then(response => {
    if (!response.ok) throw new Error('Regulatory content is unavailable.');
    return response.json();
  }).catch(error => { dataPromise = undefined; throw error; });
  const countLabels = {en:'explainers shown',pt:'temas exibidos',es:'temas mostrados',it:'schede visualizzate'};
  const translationLoadError = {
    en:'The translation could not be loaded. Please try again. The explainers remain available below.',
    pt:'Não foi possível carregar a tradução. Tente novamente. Os conteúdos continuam disponíveis abaixo.',
    es:'No se pudo cargar la traducción. Vuelve a intentarlo. Las fichas siguen disponibles a continuación.',
    it:'Impossibile caricare la traduzione. Riprova. Le schede rimangono disponibili qui sotto.'
  };
  function filter() {
    const needle = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const match = (!topic.value || topic.value === card.dataset.topic) &&
        (!territory.value || territory.value === card.dataset.territory) &&
        (!needle || card.textContent.toLocaleLowerCase().includes(needle));
      card.hidden = !match;
      if (match) visible++;
    });
    count.textContent = `${visible} / ${cards.length} ${countLabels[currentLanguage]}`;
    document.getElementById('reg-empty').hidden = visible !== 0;
  }
  form.hidden = false;
  count.hidden = false;
  form.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', filter);
  topic.addEventListener('change', filter);
  territory.addEventListener('change', filter);
  form.addEventListener('reset', () => { search.value = ''; topic.value = ''; territory.value = ''; filter(); });
  document.querySelectorAll('.reg-focus a').forEach(link => link.addEventListener('click', () => {
    search.value = ''; topic.value = ''; territory.value = ''; filter();
  }));
  async function translate(lang) {
    if (!['en','pt','es','it'].includes(lang)) return;
    const data = await readData();
    const labels = data.ui[lang];
    document.querySelectorAll('[data-reg-ui]').forEach(element => {
      if (labels[element.dataset.regUi]) element.textContent = labels[element.dataset.regUi];
    });
    cards.forEach(card => {
      const item = data.explainers.find(entry => entry.id === card.dataset.regId);
      card.querySelectorAll('[data-reg-field]').forEach(element => {
        element.textContent = item[element.dataset.regField][lang] || item[element.dataset.regField].en;
      });
    });
    const locale = {en:'en-IE',pt:'pt-BR',es:'es-ES',it:'it-IT'}[lang];
    document.querySelectorAll('main time').forEach(element => {
      element.textContent = new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${element.dateTime}T12:00:00Z`));
    });
    [...topic.options].forEach(option => {
      option.textContent = option.value ? data.explainers.find(item => item.topic === option.value).topicLabel[lang] : labels.all;
    });
    territory.options[0].textContent = labels.all;
    search.placeholder = labels.placeholder;
    currentLanguage = lang;
    language.value = lang;
    document.documentElement.lang = {en:'en',pt:'pt-BR',es:'es',it:'it'}[lang];
    document.title = labels.title + ' | Lippi';
    document.querySelector('meta[name="description"]')?.setAttribute('content',labels.intro);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content',labels.intro);
    try { localStorage.setItem('lippi-language',lang); } catch {}
    // Keep the selected language in the shareable URL, as on other public pages.
    const shareUrl = new URL(location.href);
    if (lang === 'en') shareUrl.searchParams.delete('lang');
    else shareUrl.searchParams.set('lang',lang);
    history.replaceState(null,'',shareUrl);
    filter();
  }
  language.addEventListener('change', () => {
    const requestedLanguage = language.value;
    translate(requestedLanguage).catch(() => {
      language.value = currentLanguage;
      count.textContent = translationLoadError[currentLanguage];
    });
  });
  document.querySelector('.reg-language').hidden = false;
  let requestedLanguage = new URLSearchParams(location.search).get('lang');
  if (!requestedLanguage) { try { requestedLanguage = localStorage.getItem('lippi-language'); } catch {} }
  if (requestedLanguage && requestedLanguage !== 'en') translate(requestedLanguage).catch(() => {});
  filter();
})();
