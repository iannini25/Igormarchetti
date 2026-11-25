// Keep the CV download in the language selected on the Lippi website.
(() => {
  const versions = {
    pt: ['pt-BR', 'Baixar currículo'],
    es: ['es', 'Descargar CV'],
    it: ['it', 'Scarica il CV']
  };
  const lang = new URLSearchParams(location.search).get('lang');
  if (!Object.hasOwn(versions, lang)) return;
  const [tag, label] = versions[lang];
  const link = document.querySelector('.btn-cv');
  const filename = 'Igor_Marchetti_Lippi_CV-' + tag + '.pdf';
  link.href = 'https://lippi.igormarchetti.me/downloads/' + filename;
  link.download = filename;
  link.hreflang = tag;
  link.lang = tag;
  link.querySelector('span').textContent = label;
})();
