(() => {
  const listings = JSON.parse(document.getElementById('public-workshop-listings').textContent);
  const list = document.querySelector('[data-event-tickets]');
  const announcement = document.querySelector('[data-event-announcement]');
  const enquiry = document.querySelector('[data-enquiry="public"]');

  function renderTickets() {
    const language = window.LippiI18n?.language || 'en';
    const locale = document.documentElement.lang;
    list.replaceChildren();
    for (const session of listings) {
      const start = new Date(session.startsAt);
      if (!Number.isFinite(start.getTime()) || start <= new Date()) continue;
      if (!session.titles?.en || !session.timeZone || !Number.isFinite(session.price) || session.price <= 0) continue;
      try {
        const checkout = new URL(session.paymentUrl);
        if (checkout.origin !== 'https://buy.stripe.com' || checkout.pathname === '/' || checkout.pathname.startsWith('/test_')) continue;
        const when = new Intl.DateTimeFormat(locale, {
          dateStyle: 'full', timeStyle: 'short', timeZone: session.timeZone
        }).format(start);
        const price = new Intl.NumberFormat(locale, {style: 'currency', currency: session.currency}).format(session.price);
        const item = document.createElement('li');
        const title = document.createElement('h3');
        title.textContent = session.titles[language] || session.titles.en;
        const time = document.createElement('time');
        time.dateTime = start.toISOString();
        time.textContent = when + ' (' + session.timeZone + ')';
        const fee = document.createElement('span');
        fee.textContent = price;
        const link = document.createElement('a');
        link.className = 'quote-button';
        link.href = checkout.href;
        link.textContent = window.LippiI18n?.translate('Book a place') || 'Book a place';
        item.append(title, time, fee, link);
        list.append(item);
      } catch {
        // A listing needs a valid checkout, currency and time zone before it can go on sale.
      }
    }
    const onSale = list.childElementCount > 0;
    list.hidden = !onSale;
    announcement.hidden = onSale;
    enquiry.hidden = onSale;
  }
  document.addEventListener('lippi:languagechange', renderTickets);
  renderTickets();
})();
