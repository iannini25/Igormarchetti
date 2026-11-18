(() => {
  document.documentElement.classList.add('lippi-js');
  const button = document.querySelector('.lippi-menu-button');
  const nav = document.getElementById('lippi-navigation');
  if (!button || !nav) return;
  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-site-header]')) setOpen(false);
  });
  matchMedia('(min-width: 781px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
})();
