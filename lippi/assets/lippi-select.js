// Lippi designed dropdowns. Each native <select> stays in the page as the source of truth
// (forms, validation, translation and page scripts keep using it); a designed button and
// listbox mirror it. Language pickers use a native select in the navigation.
(function () {
  'use strict';
  var LANGUAGE_PICKERS = ['lippi-language', 'reg-language', 'lang'];
  var counter = 0;

  function nextId(prefix) {
    counter += 1;
    return prefix + '-' + counter;
  }

  function chevron() {
    var span = document.createElement('span');
    span.className = 'lp-ic lp-select-chevron';
    span.setAttribute('data-ic', 'chevron');
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function checkIcon() {
    var span = document.createElement('span');
    span.className = 'lp-ic lp-select-check';
    span.setAttribute('data-ic', 'check');
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function labelFor(select) {
    var label = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
    label = label || select.closest('label');
    if (label && !label.id) label.id = nextId('lp-select-label');
    return label;
  }

  function DesignedSelect(select) {
    this.select = select;
    this.activeIndex = -1;
    this.build();
    this.bindNative();
    this.bindButton();
    this.bindList();
    this.render();
  }

  DesignedSelect.prototype.build = function () {
    var select = this.select;
    var wrapper = document.createElement('div');
    wrapper.className = 'lp-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add('lp-native-select');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'lp-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    var value = document.createElement('span');
    value.className = 'lp-select-value';
    button.append(value, chevron());

    var list = document.createElement('ul');
    list.className = 'lp-select-menu';
    list.setAttribute('role', 'listbox');
    list.id = nextId('lp-select-list');
    list.tabIndex = -1;
    button.setAttribute('aria-controls', list.id);

    var error = document.createElement('p');
    error.className = 'lp-select-error';
    error.id = nextId('lp-select-error');
    error.hidden = true;

    var label = labelFor(select);
    if (label) {
      button.setAttribute('aria-labelledby', label.id + ' ' + nextValueId(value));
      list.setAttribute('aria-labelledby', label.id);
    }
    var described = select.getAttribute('aria-describedby');
    button.setAttribute('aria-describedby', (described ? described + ' ' : '') + error.id);

    wrapper.append(button, list, error);
    this.wrapper = wrapper;
    this.button = button;
    this.value = value;
    this.list = list;
    this.error = error;
  };

  function nextValueId(element) {
    element.id = nextId('lp-select-value');
    return element.id;
  }

  DesignedSelect.prototype.options = function () {
    return Array.prototype.slice.call(this.select.options);
  };

  DesignedSelect.prototype.render = function () {
    var select = this.select;
    var selected = select.options[select.selectedIndex];
    this.value.textContent = selected ? selected.textContent.trim() : '';
    this.wrapper.classList.toggle('is-placeholder', !selected || selected.value === '');
    this.button.disabled = select.disabled;
    this.list.textContent = '';
    var self = this;
    this.options().forEach(function (option, index) {
      var item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.id = self.list.id + '-' + index;
      item.dataset.index = String(index);
      item.setAttribute('aria-selected', String(index === select.selectedIndex));
      if (option.disabled) item.setAttribute('aria-disabled', 'true');
      var text = document.createElement('span');
      text.textContent = option.textContent.trim();
      item.append(text, checkIcon());
      self.list.appendChild(item);
    });
  };

  DesignedSelect.prototype.items = function () {
    return Array.prototype.slice.call(this.list.children);
  };

  DesignedSelect.prototype.highlight = function (index) {
    var items = this.items();
    if (!items.length) return;
    var step = index > this.activeIndex ? 1 : -1;
    var next = (index + items.length) % items.length;
    var guard = items.length;
    while (items[next].getAttribute('aria-disabled') === 'true' && guard--) next = (next + step + items.length) % items.length;
    this.activeIndex = next;
    items.forEach(function (item, i) { item.classList.toggle('is-active', i === next); });
    this.list.setAttribute('aria-activedescendant', items[next].id);
    items[next].scrollIntoView({ block: 'nearest' });
  };

  DesignedSelect.prototype.setOpen = function (open) {
    if (open && this.select.disabled) return;
    if (open) DesignedSelect.closeAll(this);
    this.wrapper.classList.toggle('is-open', open);
    this.button.setAttribute('aria-expanded', String(open));
    if (!open) return;
    this.render();
    this.wrapper.classList.toggle('opens-up', this.shouldOpenUp());
    this.activeIndex = this.select.selectedIndex;
    this.highlight(Math.max(0, this.select.selectedIndex));
    this.list.focus({ preventScroll: true });
  };

  DesignedSelect.prototype.shouldOpenUp = function () {
    var box = this.button.getBoundingClientRect();
    var below = window.innerHeight - box.bottom;
    return below < 260 && box.top > below;
  };

  DesignedSelect.prototype.choose = function (index) {
    var option = this.select.options[index];
    if (!option || option.disabled) return;
    this.setOpen(false);
    this.button.focus({ preventScroll: true });
    if (this.select.selectedIndex === index) return;
    this.select.selectedIndex = index;
    this.select.dispatchEvent(new Event('input', { bubbles: true }));
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
    this.clearError();
    this.render();
  };

  DesignedSelect.prototype.typeahead = function (key) {
    var items = this.options();
    var start = this.activeIndex + 1;
    for (var offset = 0; offset < items.length; offset++) {
      var index = (start + offset) % items.length;
      if (items[index].textContent.trim().toLowerCase().indexOf(key.toLowerCase()) === 0) { this.highlight(index); return; }
    }
  };

  DesignedSelect.prototype.showError = function (message) {
    this.error.textContent = message;
    this.error.hidden = false;
    this.wrapper.classList.add('is-invalid');
    this.button.setAttribute('aria-invalid', 'true');
  };

  DesignedSelect.prototype.clearError = function () {
    this.error.hidden = true;
    this.wrapper.classList.remove('is-invalid');
    this.button.removeAttribute('aria-invalid');
  };

  DesignedSelect.prototype.bindNative = function () {
    var self = this;
    var select = this.select;
    select.addEventListener('change', function () { self.render(); if (select.value) self.clearError(); });
    select.addEventListener('focus', function () { self.button.focus(); });
    select.addEventListener('invalid', function (event) {
      event.preventDefault();
      self.showError(select.validationMessage);
      self.button.focus();
    });
    if (select.form) select.form.addEventListener('reset', function () { setTimeout(function () { self.clearError(); self.render(); }, 0); });
    // Page scripts may rebuild or translate the options; follow them.
    new MutationObserver(function () { self.render(); })
      .observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
    document.addEventListener('lippi:languagechange', function () { self.render(); });
  };

  DesignedSelect.prototype.bindButton = function () {
    var self = this;
    this.button.addEventListener('click', function () {
      self.setOpen(self.button.getAttribute('aria-expanded') !== 'true');
    });
    this.button.addEventListener('keydown', function (event) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(event.key) < 0) return;
      event.preventDefault();
      self.setOpen(true);
    });
  };

  DesignedSelect.prototype.bindList = function () {
    var self = this;
    this.list.addEventListener('click', function (event) {
      var item = event.target.closest('li[role="option"]');
      if (item) self.choose(Number(item.dataset.index));
    });
    this.list.addEventListener('pointermove', function (event) {
      var item = event.target.closest('li[role="option"]');
      if (item && item.getAttribute('aria-disabled') !== 'true') self.highlight(Number(item.dataset.index));
    });
    this.list.addEventListener('keydown', function (event) {
      var last = self.items().length - 1;
      if (event.key === 'ArrowDown') { event.preventDefault(); self.highlight(self.activeIndex + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); self.highlight(self.activeIndex - 1); }
      else if (event.key === 'Home') { event.preventDefault(); self.highlight(0); }
      else if (event.key === 'End') { event.preventDefault(); self.highlight(last); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); self.choose(self.activeIndex); }
      else if (event.key === 'Escape') { event.preventDefault(); self.setOpen(false); self.button.focus(); }
      else if (event.key === 'Tab') self.setOpen(false);
      else if (event.key.length === 1) self.typeahead(event.key);
    });
  };

  DesignedSelect.instances = [];
  DesignedSelect.closeAll = function (except) {
    DesignedSelect.instances.forEach(function (instance) { if (instance !== except) instance.setOpen(false); });
  };

  function enhanceAll() {
    document.querySelectorAll('select').forEach(function (select) {
      if (LANGUAGE_PICKERS.indexOf(select.id) >= 0 || select.multiple || select.closest('.lp-select')) return;
      DesignedSelect.instances.push(new DesignedSelect(select));
    });
  }

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.lp-select')) DesignedSelect.closeAll(null);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceAll);
  else enhanceAll();
})();
