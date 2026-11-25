// Lippi interaction layer: navigation, language menu, icons, reveals and mobile reading aids.
// It only adds elements, classes and attributes. It never rewrites copy, so the
// four-language translation in site-shell.js keeps owning every visible sentence.
(function () {
  'use strict';
  var homeEffects = document.currentScript.hasAttribute('data-home-effects');
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var phone = window.matchMedia('(max-width: 780px)');

  var UI = {
    more: { en: 'Show more', pt: 'Mostrar mais', es: 'Mostrar más', it: 'Mostra di più' },
    less: { en: 'Show less', pt: 'Mostrar menos', es: 'Mostrar menos', it: 'Mostra meno' }
  };

  function currentLanguage() {
    var code = (root.lang || 'en').slice(0, 2).toLowerCase();
    return UI.more[code] ? code : 'en';
  }

  function icon(name, extraClass) {
    var span = document.createElement('span');
    span.className = 'lp-ic' + (extraClass ? ' ' + extraClass : '');
    span.setAttribute('data-ic', name);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function tile(name, dark) {
    var wrapper = document.createElement('span');
    wrapper.className = 'lp-tile' + (dark ? ' is-dark' : '');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(icon(name));
    return wrapper;
  }

  /* ---------- scroll progress and header state ---------- */
  function setUpScrollState() {
    var bar = document.createElement('div');
    bar.className = 'lippi-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var max = root.scrollHeight - root.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, root.scrollTop / max) : 0) + ')';
      root.classList.toggle('is-scrolled', root.scrollTop > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- icons ---------- */
  var TILE_MAP = [
    ['.hero-offers > section', ['briefcase', 'users'], true],
    ['.credentials-grid > article', ['building', 'card', 'globe', 'cap']],
    ['.audience-grid > article', ['globe', 'compass']],
    ['.consulting-path .grid.three > .card', ['search', 'file-check', 'box']],
    ['.fee-list > article', ['chat', 'file-check', 'box', 'layers']]
  ];
  var TOPIC_ICONS = ['clipboard', 'globe', 'scale', 'layers', 'tag', 'chat', 'book', 'shield', 'article', 'list', 'user'];

  function addIcons() {
    TILE_MAP.forEach(function (entry) {
      document.querySelectorAll(entry[0]).forEach(function (target, index) {
        if (target.querySelector(':scope > .lp-tile')) return;
        target.insertBefore(tile(entry[1][index % entry[1].length], entry[2]), target.firstChild);
      });
    });
    document.querySelectorAll('.topic-list > .topic-row').forEach(function (row, index) {
      var head = row.matches('details') ? row.querySelector(':scope > summary') : row;
      if (head && !head.querySelector('.lp-tile')) head.insertBefore(tile(TOPIC_ICONS[index % TOPIC_ICONS.length]), head.firstChild);
    });
    document.querySelectorAll('.scope-note').forEach(function (note) {
      if (!note.querySelector(':scope > .lp-ic')) note.insertBefore(icon('info'), note.firstChild);
    });
    document.querySelectorAll('main .btn').forEach(function (button) {
      if (button.querySelector('.lp-ic') || button.tagName === 'BUTTON') return;
      var href = button.getAttribute('href') || '';
      var name = /calendly/.test(href) ? 'calendar' : /^mailto:/.test(href) ? 'mail' : /survey/.test(href) ? 'list' : 'right';
      button.appendChild(icon(name));
    });
  }

  /* ---------- hero details ---------- */
  function addPortraitSeal() {
    var portrait = document.querySelector('.hero .portrait');
    if (!portrait || portrait.querySelector('.lp-seal')) return;
    var seal = document.createElement('div');
    seal.className = 'lp-seal';
    seal.setAttribute('aria-hidden', 'true');
    seal.innerHTML = '<svg viewBox="0 0 100 100"><defs><path id="lp-seal-path" d="M50 50m-38 0a38 38 0 1 1 76 0a38 38 0 1 1-76 0"/></defs>' +
      '<text><textPath href="#lp-seal-path">LIPPI</textPath></text></svg>';
    seal.appendChild(icon('shield'));
    portrait.appendChild(seal);
  }

  var REGULATIONS = ['EU AI Act', 'GDPR', 'DORA', 'PSD2', 'PSD3', 'PSR', 'MiCA', 'AML/CFT', 'KYC', 'CDD', 'LGPD', 'PCI DSS', 'SOC 2'];
  function addRegulationMarquee(host) {
    var hero = host || document.querySelector('main > header.hero');
    if (!hero || document.querySelector('.lp-marquee')) return;
    var band = document.createElement('div');
    band.className = 'lp-marquee';
    band.setAttribute('aria-hidden', 'true');
    var track = document.createElement('div');
    track.className = 'lp-marquee-track';
    REGULATIONS.concat(REGULATIONS).forEach(function (name) {
      var item = document.createElement('span');
      item.textContent = name;
      track.appendChild(item);
    });
    band.appendChild(track);
    hero.appendChild(band);
  }

  function addProcessPath() {
    var grid = document.querySelector('.consulting-path .grid.three');
    if (!grid || grid.querySelector('.lp-path')) return;
    var path = document.createElement('span');
    path.className = 'lp-path';
    path.setAttribute('aria-hidden', 'true');
    grid.insertBefore(path, grid.firstChild);
  }

  /* ---------- reveals ---------- */
  var REVEAL_GROUPS = [
    '.hero-grid > div > *', '.portrait',
    'main > section > .wrap > .label', 'main > section > .wrap > h2', 'main > section > .wrap > .intro',
    '.credentials-grid > article', '.audience-grid > article', '.consulting-path .grid > .card',
    '.topic-list > .topic-row', '.contact-grid > *', '#latest-ai-article .wrap', '.lp-path',
    '.lippi-resource-card', '.lippi-footer-top > *', '.article > h1', '.article > .lead'
  ];
  function setUpReveals() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    root.classList.add('lippi-motion');
    var seen = new Set();
    var groups = homeEffects ? REVEAL_GROUPS.concat([
      '#resources .copy', '.menu-group > h3', '.menu-group > .topic-row',
      '.steps > li', '#enquiry > summary',
      '.pilot-hero > div:first-child > *', '.profile-link-card', '#credentials-heading',
      '#credentials .proof-line', '#credentials .career-detail > summary',
      '.pilot-grid > div:first-child > *', '.pilot-questions > details',
      '.pilot-feedback > div > *', '.pilot-feedback > a'
    ]) : REVEAL_GROUPS;
    groups.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        if (seen.has(el)) return;
        seen.add(el);
        var position = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        if (!el.classList.contains('lp-path')) el.setAttribute('data-reveal', '');
        el.style.transitionDelay = Math.min(position, 6) * 70 + 'ms';
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    document.querySelectorAll('[data-reveal], .lp-path').forEach(function (el) { io.observe(el); });
  }

  function animateAccordions() {
    document.querySelectorAll('details').forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (!details.open) return;
        details.querySelectorAll('[data-reveal]:not(.is-in)').forEach(function (el) { el.classList.add('is-in'); });
        var body = details.querySelector(':scope > :not(summary)');
        if (reduceMotion || !body || !body.animate) return;
        body.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
          { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    });
  }

  /* ---------- phones: shorter passages and swipe indicators ---------- */
  var LONG_TEXT = '.intro, .scope-note, .illustration-note, .survey-privacy, .contact-grid p, .service-faq p, .fee-list p, .case-study p, .pricing-tax';
  var CLAMP_MIN_CHARS = 230;

  function setMoreLabel(button) {
    var expanded = button.getAttribute('aria-expanded') === 'true';
    button.firstChild.textContent = (expanded ? UI.less : UI.more)[currentLanguage()];
  }

  function addReadMore(paragraph) {
    if (paragraph.dataset.lpClamp || paragraph.textContent.trim().length < CLAMP_MIN_CHARS) return;
    if (paragraph.closest('#latest-ai-article, .hero')) return;
    paragraph.dataset.lpClamp = 'on';
    paragraph.classList.add('lp-clamp');
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'lp-more';
    button.setAttribute('aria-expanded', 'false');
    button.append(document.createElement('span'), icon('chevron'));
    setMoreLabel(button);
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      paragraph.classList.toggle('lp-clamp', !open);
      setMoreLabel(button);
    });
    paragraph.insertAdjacentElement('afterend', button);
  }

  function removeReadMore() {
    document.querySelectorAll('[data-lp-clamp]').forEach(function (paragraph) {
      paragraph.classList.remove('lp-clamp');
      delete paragraph.dataset.lpClamp;
      var next = paragraph.nextElementSibling;
      if (next && next.classList.contains('lp-more')) next.remove();
    });
  }

  function applyPhoneReading() {
    if (phone.matches) document.querySelectorAll(LONG_TEXT).forEach(addReadMore);
    else removeReadMore();
  }

  var SWIPE_ROWS = '.audience-grid, .consulting-path .grid.three, #experience .grid, .case-studies, .fee-list, .service-faq';
  function addSwipeDots() {
    document.querySelectorAll(SWIPE_ROWS).forEach(function (row) {
      if (row.nextElementSibling && row.nextElementSibling.classList.contains('lp-dots')) return;
      var cards = Array.prototype.filter.call(row.children, function (child) { return !child.classList.contains('lp-path'); });
      if (cards.length < 2) return;
      var dots = document.createElement('div');
      dots.className = 'lp-dots';
      dots.setAttribute('aria-hidden', 'true');
      cards.forEach(function () { dots.appendChild(document.createElement('i')); });
      row.insertAdjacentElement('afterend', dots);
      function update() {
        var step = cards[0].getBoundingClientRect().width + 14;
        var index = Math.round(row.scrollLeft / step);
        Array.prototype.forEach.call(dots.children, function (dot, i) { dot.classList.toggle('is-active', i === index); });
      }
      row.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
      update();
    });
  }

  /* ---------- desktop pointer details ---------- */
  function setUpPointerEffects() {
    if (!finePointer || reduceMotion) return;
    var portrait = document.querySelector('.hero .portrait');
    if (portrait) {
      portrait.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
      portrait.addEventListener('pointermove', function (event) {
        var box = portrait.getBoundingClientRect();
        var x = (event.clientX - box.left) / box.width - 0.5;
        var y = (event.clientY - box.top) / box.height - 0.5;
        portrait.style.transform = 'perspective(900px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
      });
      portrait.addEventListener('pointerleave', function () { portrait.style.transform = ''; });
    }
    document.querySelectorAll('.card, .audience-grid article, .credentials-grid article, .hero-offers section, .lippi-resource-card').forEach(function (card) {
      card.classList.add('lippi-spot');
      card.addEventListener('pointermove', function (event) {
        var box = card.getBoundingClientRect();
        card.style.setProperty('--mx', (event.clientX - box.left) + 'px');
        card.style.setProperty('--my', (event.clientY - box.top) + 'px');
      });
    });
  }

  // The survey moved to its own page; keep old shared links working.
  function redirectOldSurveyLink() {
    if (location.hash !== '#founder-survey' || document.getElementById('founder-survey')) return false;
    location.replace('/survey.html' + location.search);
    return true;
  }

  function init() {
    if (homeEffects) {
      var carousel = document.querySelector('[data-home-carousel]');
      if (carousel) {
        addRegulationMarquee(carousel.querySelector('.carousel-strip'));
        carousel.hidden = false;
      }
      addPortraitSeal();
      setUpReveals();
      animateAccordions();
      return;
    }
    if (redirectOldSurveyLink()) return;
    setUpScrollState();
    addIcons();
    addPortraitSeal();
    addRegulationMarquee();
    addProcessPath();
    setUpReveals();
    animateAccordions();
    addSwipeDots();
    applyPhoneReading();
    phone.addEventListener('change', applyPhoneReading);
    document.addEventListener('lippi:languagechange', function () {
      document.querySelectorAll('.lp-more').forEach(setMoreLabel);
    });
    setUpPointerEffects();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
