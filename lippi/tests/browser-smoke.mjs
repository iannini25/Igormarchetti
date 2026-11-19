/** Chromium-based, local-only QA: public pages, language selection and mobile navigation.
 * Run with a static server at 127.0.0.1:8765, installed Playwright JS, and system Google Chrome.
 * This is NOT a production deployment or live-site verification.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LIPPI_TEST_ORIGIN || 'http://127.0.0.1:8765';
const pages = [
  '/', '/training.html', '/regulations.html', '/articles.html',
  '/independence.html', '/ai-governance-fintech-web-summit-2026.html'
];
const locales = { en:'en', pt:'pt-BR', es:'es', it:'it' };
const publicPaths = new Set(pages);
const englishHeadings = new Map();
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
    if (device === 'desktop') {
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
    if (route === '/training.html') {
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
} finally { await browser.close(); }
console.log('Local Chromium coverage: '+results.length+'/48 page-language-device combinations.');
if(failures.length) {
  for(const message of failures) console.error('FAILED: '+message);
  process.exitCode=1;
} else {
  console.log('Passed localized content, selection, public links, safeguard copy, and mobile menu smoke checks. NOT live-site verification.');
}
