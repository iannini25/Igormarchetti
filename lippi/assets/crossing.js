(() => {
  for (const studio of document.querySelectorAll('section.studio')) {
    const player = studio.querySelector('video');
    const prompt = studio.querySelector('details');
    const answers = [...studio.querySelectorAll('[data-answer]')];
    const choices = [...studio.querySelectorAll('[data-choice]')];
    player.addEventListener('ended', () => { prompt.open = true; });
    choices.forEach(button => button.addEventListener('click', () => {
      const choice = button.dataset.choice;
      choices.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      answers.forEach(answer => { answer.hidden = answer.dataset.answer !== choice; });
    }));
    function applyMedia() {
      const locale = document.documentElement.lang.startsWith('pt') ? 'pt' : 'en';
      if (player.dataset.locale === locale) return;
      const source = player.dataset[locale];
      if (!source) return;
      player.dataset.locale = locale;
      player.poster = player.dataset[locale + 'Poster'];
      player.src = source;
    }
    applyMedia();
    document.addEventListener('lippi:languagechange',applyMedia);
  }
})();
