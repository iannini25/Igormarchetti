/** Chromium-based, local-only QA: public pages, language selection and mobile navigation.
 * Run with a static server at 127.0.0.1:8765, installed Playwright JS, and system Google Chrome.
 * This is NOT a production deployment or live-site verification.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LIPPI_TEST_ORIGIN || 'http://127.0.0.1:8765';
const pages = [
  '/', '/training.html', '/regulations.html', '/articles.html',
  '/independence.html', '/ai-governance-fintech-web-summit-2026.html', '/survey.html'
];
const locales = { en:'en', pt:'pt-BR', es:'es', it:'it' };
const publicPaths = new Set(pages);
const englishHeadings = new Map();
const englishMetadata = new Map();
const englishStructuredData = new Map();
const results = [];
const failures = [];
const browser = await chromium.launch({channel:'chrome',headless:true});

async function checkPage(context,route,lang,htmlLang,device) {
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  const url = new URL(route,origin);
  if(lang !== 'en') url.searchParams.set('lang',lang);
  try {
    const response = await page.goto(url.href,{waitUntil:'load',timeout:20000});
    assert.ok(response?.ok(),route+' did not return HTTP success');
    const selector = route === '/independence.html' ? '#lang' :
      route === '/regulations.html' ? '#reg-language' : '#lippi-language';
    await page.waitForFunction(
      ({selector,lang,htmlLang}) =>
        document.documentElement.lang === htmlLang &&
        document.querySelector(selector)?.value === lang,
      {selector,lang,htmlLang},{timeout:15000}
    );
    const heading = (await page.locator('h1').first().textContent())?.trim();
    assert.ok(heading?.length,route+' has no visible heading');
    // Check the real browser DOM, not just source strings. English is the default;
    // localized titles and descriptions should change with the requested locale.
    const metadata = await page.evaluate(() => ({
      title: document.title.trim(),
      description: document.querySelector('meta[name="description"]')?.content?.trim() || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      social: Object.fromEntries(
        ['og:title','og:description','twitter:title','twitter:description','og:image:alt','twitter:image:alt','og:locale']
          .map(key => [key, document.querySelector(
            key.startsWith('og:') ? 'meta[property="'+key+'"]' : 'meta[name="'+key+'"]'
          )?.content || null])
      )
    }));
    // The homepage also exposes Schema.org JSON-LD to search engines.
    // Validate human-readable metadata, language tags and reversible service
    // descriptions in the rendered document (not just the source dictionary).
    if (route === '/') {
      const graph = await page.evaluate(() => JSON.parse(
        document.querySelector('script[type="application/ld+json"]').textContent
      )['@graph']);
      const byType = type => graph.find(item => item['@type'] === type);
      assert.equal(byType('WebSite').inLanguage,htmlLang,
        'WebSite structured-data locale disagrees with page language');
      assert.equal(byType('WebPage').inLanguage,htmlLang,
        'WebPage structured-data locale disagrees with page language');
      assert.equal(byType('WebPage').description,metadata.description,
        'WebPage structured-data description not synchronized');
      assert.equal(byType('Organization').description,metadata.description,
        'Organization structured-data description not synchronized');
      const services = graph.filter(item => item['@type'] === 'Service');
      assert.equal(services.length,3,'Homepage should retain three scoped offerings');
      if (device === 'desktop') {
        if (lang === 'en') englishStructuredData.set(route,services);
        else {
          const original = englishStructuredData.get(route);
          assert.ok(original,'Missing English structured-data baseline');
          for (let i = 0; i < services.length; i++) {
            for (const field of ['name','description','serviceType']) {
              assert.notEqual(services[i][field],original[i][field],
                lang+' homepage service '+i+' '+field+' was left in English');
            }
          }
        }
      }
    }
    assert.ok(metadata.title,route+' has no document title');
    assert.ok(metadata.description,route+' has no meta description');
    assert.equal(new URL(metadata.canonical).pathname,route,
      'Canonical URL should identify the current public page');
    assert.equal(await page.locator('main').count(),1,route+' must have one main landmark');
    assert.equal(await page.locator('img:not([alt])').count(),0,
      route+' has an image without alternative text');
    if (device === 'desktop') {
      if (lang === 'en') englishMetadata.set(route,metadata);
      else {
        const original = englishMetadata.get(route);
        assert.ok(original,'English baseline missing for '+route);
        assert.notEqual(metadata.title,original.title,
          route+' title remains English in '+lang);
        assert.notEqual(metadata.description,original.description,
          route+' description remains English in '+lang);
        for (const key of ['og:title','og:description','twitter:title','twitter:description','og:image:alt','twitter:image:alt']) {
          if (original.social[key] === null) continue; // This page has no such tag.
          assert.ok(metadata.social[key],route+' '+key+' is empty in '+lang);
          assert.notEqual(metadata.social[key],original.social[key],
            route+' '+key+' remains English in '+lang);
          // The Open Graph summary may intentionally differ from the SEO
          // description (or the social title from the browser tab title).
          // Only require equality when the English originals were equal.
          const pageField = key.endsWith('title') ? 'title' : 'description';
          if (original.social[key] === original[pageField]) {
            assert.equal(metadata.social[key],metadata[pageField],
              route+' '+key+' does not follow localized '+pageField+' in '+lang);
          }
        }
        if (original.social['og:locale'] !== null) {
          assert.equal(metadata.social['og:locale'],
            {pt:'pt_BR',es:'es_ES',it:'it_IT'}[lang],
            route+' Open Graph locale not updated for '+lang);
        }
      }
      if (lang === 'en') englishHeadings.set(route,heading);
      else assert.notEqual(heading,englishHeadings.get(route),
        route+' heading still appears in English for '+lang);
    }
    // Public internal links should retain the language without modifying external URLs.
    const hrefs = await page.locator('a[href]').evaluateAll(nodes =>
      nodes.map(node=>node.getAttribute('href')));
    for (const href of hrefs) {
      if (!href?.startsWith('/') || href.startsWith('//')) continue;
      const target = new URL(href,origin);
      if (!publicPaths.has(target.pathname)) continue;
      assert.equal(target.searchParams.get('lang'),lang === 'en' ? null : lang,
        device+' '+route+' lost '+lang+' on internal link '+href);
    }
    if (route === '/independence.html') {
      for (const field of ['intro','screen','approval','scope','security','end']) {
        assert.ok((await page.locator('[data-key="'+field+'"]').textContent())?.trim(),
          'Independence section empty: '+field);
      }
      assert.match(await page.locator('[data-key="scope"]').textContent(),/CRO/i,
        'Fractional CRO exclusion is missing in '+lang);
    }
    if (route === '/') {
      const training = page.locator('[data-site-header] a[href^="/training.html"]');
      assert.equal(await training.count(),1);
      assert.ok(await training.isVisible(),'Training must remain visible on both layouts');
      assert.equal(await page.locator('.steps > li').count(),4);
      assert.equal(await page.locator('.experience-companies > li').count(),10);
      assert.equal(await page.locator('.steps > li[data-reveal]').count(),0,
        'Reduced-motion visitors should see the steps immediately');
      const portrait = await page.locator('.founder-identity img').boundingBox();
      assert.ok(portrait.width <= (device === 'mobile' ? 64 : 84));
      assert.equal(await page.locator('.portrait .lp-seal').count(),1);
      const serviceCards = await page.locator('.hero-offers').boundingBox();
      for (const selector of ['.menu-grid','.steps','.credentials-grid']) {
        const row = await page.locator(selector).boundingBox();
        assert.ok(Math.abs(row.x - serviceCards.x) < 2, selector+' left margin');
        assert.ok(Math.abs(row.width - serviceCards.width) < 2, selector+' width');
      }
      const offers = page.locator('.hero-offers > section');
      assert.equal(await offers.count(),3,'Training, advisory and hours each need their own card');
      assert.equal(await offers.nth(2).locator('.hero-hours').count(),1);
      const hours = await offers.nth(2).boundingBox();
      const first = await offers.nth(0).boundingBox();
      const second = await offers.nth(1).boundingBox();
      assert.ok(device === 'mobile' ? second.y >= first.y + first.height - 1 : Math.abs(first.y - second.y) < 1,
        'Offers should stack on mobile and sit side by side on desktop');
      assert.ok(device === 'mobile' ? hours.y >= second.y + second.height - 1 : Math.abs(hours.y - first.y) < 1,
        'The hours card should align with the service cards');
      await page.locator('#open-enquiry').click();
      assert.equal(await page.locator('.question-grid label').count(),10);
      await page.locator('#q1').selectOption({index:1});
      for (const id of ['q3','q4','q9']) await page.locator('#'+id).fill('Example & test');
      await page.locator('#enquiry-form button[type="submit"]').click();
      const email = new URL(await page.locator('#send-email').getAttribute('href'));
      assert.equal(email.protocol,'mailto:');
      assert.equal(email.pathname,'lippi@igormarchetti.me');
      assert.ok(email.searchParams.get('body').includes('Example & test'));
    }
    if (route === '/training.html') {
      for (const id of ['course-contents', 'sample']) {
        assert.ok(await page.locator('.hero a[href="#'+id+'"]').isVisible());
        assert.equal(await page.locator('#'+id).count(), 1);
      }
      const outline = page.locator('#programme details');
      const sample = page.locator('#sample details');
      assert.equal(await outline.evaluate(el => el.open),false);
      assert.equal(await sample.evaluate(el => el.open),false);
      await page.locator('#course-contents a[href="#module-grc"]').click();
      assert.ok(await outline.evaluate(el => el.open));
      await outline.locator('summary').click();
      await page.locator('.hero a[href="#sample"]').click();
      assert.ok(await sample.evaluate(el => el.open));
      await page.locator('#sample-question input[value="business"]').check();
      await page.locator('#sample-question button').click();
      assert.ok(await page.locator('#sample-answer').isVisible());
      assert.ok(await sample.locator('.participant-materials').isVisible());
      await sample.locator('summary').click();
      assert.equal(await sample.locator('.participant-materials').isVisible(),false);
      assert.ok(await page.locator('#format .schedule').isVisible());
      assert.equal(await page.locator('#consulting-support-heading').count(),0);
      assert.equal(await page.locator('#training-interest-form').count(),1,
        'Training enquiry form is missing');
    }
    if (route === '/regulations.html') {
      assert.equal(await page.locator('[data-reg-id]').count(),7,
        'Expected seven regulatory explainers');
    }
    if (device === 'mobile') {
      const menu = page.locator('.lippi-menu-button');
      if (await menu.count()) {
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'),'true',
          'Mobile navigation did not open on '+route);
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'),'false',
          'Mobile navigation did not close on Escape on '+route);
      }
    }
    assert.deepEqual(runtimeErrors,[],device+' '+route+' '+lang+' browser errors');
    results.push({route,lang,device});
  } finally {
    await page.close();
  }
}

try {
  for (const [device,viewport] of [
    ['desktop',{width:1366,height:900}],
    ['mobile',{width:390,height:844}]
  ]) {
    // A separate homepage footer previously drifted from the public and admin layouts.
    const footerPage = await browser.newPage({viewport,reducedMotion:'reduce'});
    try {
      for (const route of [...pages,'/survey-admin.html','/training-admin.html']) {
        await footerPage.goto(origin+route,{waitUntil:'load'});
        const footer = footerPage.locator('footer.lippi-footer');
        assert.equal(await footer.count(),1,route+' has a missing or duplicate footer');
        const layout = await footer.evaluate(element => ({
          background:getComputedStyle(element).backgroundColor,
          columns:getComputedStyle(element.querySelector('.lippi-footer-links')).gridTemplateColumns,
          mask:getComputedStyle(element.querySelector('.lippi-footer-logo')).maskImage,
          fits:element.scrollWidth <= element.clientWidth
        }));
        assert.equal(layout.background,'rgb(10, 31, 45)',route+' footer colour');
        assert.equal(layout.columns.split(' ').length,2,route+' footer columns on '+device);
        assert.match(layout.mask,/logo\.svg/,route+' footer wordmark');
        assert.ok(layout.fits,route+' footer overflows on '+device);
      }
    } finally { await footerPage.close(); }
    for (const [lang,htmlLang] of Object.entries(locales)) {
      const context = await browser.newContext({viewport,reducedMotion:'reduce'});
      try {
        for (const route of pages) {
          try { await checkPage(context,route,lang,htmlLang,device); }
          catch(error) { failures.push(device+' '+lang+' '+route+': '+error.message); }
        }
      } finally { await context.close(); }
    }
  }
  // Exercise changes through the actual pickers, then traverse pages without
  // query parameters to verify persisted preferences and regulator-page parity.
  const context = await browser.newContext({viewport:{width:1280,height:800}});
  const page = await context.newPage();
  try {
    await page.goto(origin+'/',{waitUntil:'load'});
    const lastStep = page.locator('.steps > li').last();
    assert.equal(await page.locator('.steps > li[data-reveal]').count(),4);
    assert.equal(await page.locator('.menu-group > details[data-reveal]').count(),6);
    assert.equal(await lastStep.evaluate(el => getComputedStyle(el).opacity),'0');
    await lastStep.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.steps > li:last-child')).opacity === '1');
    await page.locator('#lippi-language').selectOption('it');
    await page.waitForFunction(() => document.documentElement.lang==='it');
    assert.equal(new URL(page.url()).searchParams.get('lang'),'it');
    const trainingHref = await page.locator('a[href^="/training.html"]').first().getAttribute('href');
    assert.equal(new URL(trainingHref,origin).searchParams.get('lang'),'it');

    await page.goto(origin+'/training.html',{waitUntil:'load'});
    await page.waitForFunction(() =>
      document.documentElement.lang==='it' && document.querySelector('#lippi-language')?.value==='it');
    await page.goto(origin+'/regulations.html',{waitUntil:'load'});
    await page.waitForFunction(() => document.querySelector('#reg-language')?.value==='it');
    await page.locator('#reg-language').selectOption('es');
    await page.waitForFunction(() =>
      document.documentElement.lang==='es' && document.querySelector('#reg-language')?.value==='es');
    assert.equal(new URL(page.url()).searchParams.get('lang'),'es');

    await page.goto(origin+'/independence.html',{waitUntil:'load'});
    await page.waitForFunction(() =>
      document.documentElement.lang==='es' && document.querySelector('#lang')?.value==='es');
    await page.locator('#lang').selectOption('pt');
    await page.waitForFunction(() => document.documentElement.lang==='pt-BR');
    assert.equal(new URL(page.url()).searchParams.get('lang'),'pt');
    assert.equal(new URL(await page.locator('#lippi-navigation a').first().getAttribute('href'),origin).searchParams.get('lang'),'pt');
    await page.goto(origin+'/',{waitUntil:'load'});
    await page.waitForFunction(() =>
      document.documentElement.lang==='pt-BR' && document.querySelector('#lippi-language')?.value==='pt');
    console.log('Locale switching and persisted preference: passed across home, training, regulations and independence.');
  } finally {
    await context.close();
  }
} finally { await browser.close(); }
console.log('Local Chromium coverage: '+results.length+'/56 page-language-device combinations.');
if(failures.length) {
  for(const message of failures) console.error('FAILED: '+message);
  process.exitCode=1;
} else {
  console.log('Passed localized content, browser metadata, main landmarks, image alt attributes, public links, safeguards and mobile menu smoke checks. NOT live-site verification.');
}
