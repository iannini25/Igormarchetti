// Lippi motion layer: progress bar, header state, scroll reveals and small interactions.
// It adds classes and attributes only; it never reads or rewrites copy, so the
// four-language translation in site-shell.js keeps working unchanged.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Scroll progress + header state
  var bar = document.createElement('div');
  bar.className = 'lippi-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var ticking = false;
  function onScroll() {
    var max = root.scrollHeight - root.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, root.scrollTop / max) : 0) + ')';
    root.classList.toggle('is-scrolled', root.scrollTop > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (reduce || !('IntersectionObserver' in window)) return;
  root.classList.add('lippi-motion');

  // Reveal groups: each child enters in a short stagger, once.
  var groups = [
    '.hero-grid > div > *', '.portrait',
    'main > section > .wrap > .label', 'main > section > .wrap > h2', 'main > section > .wrap > .intro',
    '.credentials-grid > article', '.audience-grid > article', '.consulting-path .grid > .card',
    '.topic-list > .topic-row', '.contact-grid > *', '#latest-ai-article .wrap',
    '.lippi-resource-card', '.lippi-footer-top > *'
  ];
  var seen = new Set();
  groups.forEach(function (selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      if (seen.has(el)) return;
      seen.add(el);
      var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.setAttribute('data-reveal', '');
      el.style.transitionDelay = Math.min(siblings, 6) * 70 + 'ms';
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      entry.target.addEventListener('transitionend', function clear() {
        entry.target.style.transitionDelay = '';
        entry.target.removeEventListener('transitionend', clear);
      });
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });

  // Content opened in an accordion fades up instead of popping in.
  document.querySelectorAll('details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var body = d.querySelector(':scope > :not(summary)');
      if (!body || !body.animate) return;
      body.animate(
        [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
      // Anything inside the opened panel that was waiting for a reveal shows now.
      d.querySelectorAll('[data-reveal]:not(.is-in)').forEach(function (el) { el.classList.add('is-in'); });
    });
  });

  if (!finePointer) return;

  // Portrait: gentle tilt toward the pointer (desktop only).
  var portrait = document.querySelector('.hero .portrait');
  if (portrait) {
    portrait.addEventListener('pointermove', function (e) {
      var r = portrait.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      portrait.style.transform = 'perspective(900px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
    });
    portrait.addEventListener('pointerleave', function () { portrait.style.transform = ''; });
    portrait.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
  }

  // Cards: soft spotlight that follows the pointer.
  document.querySelectorAll('.card, .audience-grid article, .hero-offers section, .lippi-resource-card').forEach(function (card) {
    card.classList.add('lippi-spot');
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
})();
