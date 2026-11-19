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
      const advisory = page.locator('section[aria-labelledby="advisory-offer"] a');
      const workshops = page.locator('section[aria-labelledby="training-offer"] a');
      assert.ok(await advisory.isVisible() && await workshops.isVisible(),
        'Both offers must be visible on the homepage');
      assert.equal(await advisory.getAttribute('href'), 'https://calendly.com/igormarchettilippi/30min');
      assert.equal(new URL(await workshops.getAttribute('href'), origin).pathname, '/training.html');
      const first = await advisory.locator('..').boundingBox();
      const second = await workshops.locator('..').boundingBox();
      assert.ok(device === 'mobile' ? second.y >= first.y + first.height - 1 : Math.abs(first.y - second.y) < 1,
        'Offers should stack on mobile and sit side by side on desktop');
    }
    if (route === '/training.html') {
      for (const id of ['course-contents', 'sample']) {
        assert.ok(await page.locator('.hero a[href="#'+id+'"]').isVisible());
        assert.equal(await page.locator('#'+id).count(), 1);
      }
      const advisoryUrl = new URL(await page.locator('section[aria-labelledby="consulting-support-heading"] a').getAttribute('href'), origin);
      assert.equal(advisoryUrl.pathname + advisoryUrl.hash, '/#services');
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
