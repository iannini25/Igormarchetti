/** Local-only form QA. API calls are intercepted; no user data is submitted.
 * Run against a static server at http://127.0.0.1:8765 with Playwright and system Chrome.
 * This cannot establish real backend delivery or production readiness.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LIPPI_TEST_ORIGIN || 'http://127.0.0.1:8765';
const locales = ['en','pt','es','it'];
const failures = [];
let checks = 0;
const browser = await chromium.launch({channel:'chrome',headless:true});

const url = (path,locale) => origin+path+(locale==='en'?'':'?lang='+locale);
const response = (route,body,status=200) => route.fulfill({
  status, contentType:'application/json',body:JSON.stringify(body)
});
async function localeReady(page,locale) {
  await page.waitForFunction(expected => document.documentElement.lang===expected,
    locale==='pt'?'pt-BR':locale,{timeout:15000});
}
async function apiOffline(page) {
  // Never contact a backend during this test. More specific mocks override this.
  await page.route('**/api/**',route=>response(route,{ready:false},503));
}

async function newsletter(locale) {
  const page = await browser.newPage();
  let posts = 0;
  try {
    await apiOffline(page);
    page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/'))posts++;});
    await page.goto(url('/articles.html',locale),{waitUntil:'load'});
    await localeReady(page,locale);
    await page.waitForFunction(() => !document.querySelector('#newsletter-form button[type="submit"]').disabled);
    assert.equal(await page.locator('#newsletter-form').evaluate(el=>el.checkValidity()),false,
      'Newsletter should require an email and consent');
    const deliveryLocale=locale==='it'?'en':locale;
    await page.locator('#newsletter-email').fill('testing@example.org');
    await page.locator('#newsletter-language').selectOption(deliveryLocale);
    await page.locator('#newsletter-consent').check();
    await page.locator('#newsletter-form button[type="submit"]').click();
    assert.equal(await page.locator('#newsletter-email-fallback').isVisible(),true);
    const draft=await page.locator('#newsletter-email-draft').getAttribute('href');
    assert.ok(draft?.startsWith('mailto:lippifintech@igormarchetti.me?'));
    const parsed=new URL(draft);
    assert.ok(parsed.searchParams.get('body')?.includes('testing@example.org'));
    assert.ok(parsed.searchParams.get('subject')?.trim());
    assert.equal(posts,0,'Email fallback must not silently POST a newsletter registration');
    if(locale==='it') {
      assert.deepEqual(await page.locator('#newsletter-language option').evaluateAll(nodes=>nodes.map(x=>x.value)),
        ['en','pt','es'],'Italian must not silently become a newsletter delivery choice');
    }
    checks++;
  } finally {await page.close();}
}

async function training(locale) {
  const page = await browser.newPage();
  let posts = 0;
  try {
    await apiOffline(page);
    page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/'))posts++;});
    await page.goto(url('/training.html',locale),{waitUntil:'load'});
    await localeReady(page,locale);
    await page.waitForFunction(() => !document.querySelector('#training-interest-form button[type="submit"]').disabled);
    await page.locator('input[name="target_markets"][value="ireland"]').check();
    await page.locator('#training-priority').selectOption('licensing');
    await page.locator('#training-budget').selectOption('under100');
    await page.locator('#training-format').selectOption('online');
    await page.locator('#training-language').selectOption('english');
    assert.equal(await page.locator('#training-interest-form').evaluate(el=>el.checkValidity()),true);
    await page.locator('#training-interest-form button[type="submit"]').click();
    assert.equal(await page.locator('#training-email-fallback').isVisible(),true);
    const href=await page.locator('#training-email-link').getAttribute('href');
    assert.ok(href?.startsWith('mailto:lippifintech@igormarchetti.me?'));
    const parsed=new URL(href);
    assert.ok(parsed.searchParams.get('body')?.length>80);
    assert.ok(parsed.searchParams.get('subject')?.trim());
    assert.equal(posts,0,'Training email fallback must not silently submit to backend');
    checks++;
  } finally {await page.close();}
}

async function founderSurvey(locale) {
  const page=await browser.newPage();
  let posts=0;
  try {
    await apiOffline(page);
    await page.route('**/api/founder-survey/health',
      route=>response(route,{ready:true,survey_version:'founder-v1'}));
    await page.route('**/api/founder-survey',route=>{
      posts++;
      const body=JSON.parse(route.request().postData() || '{}');
      assert.equal(body.survey_version,'founder-v1');
      assert.ok(body.submission_id);
      assert.ok(body.milestone_risk.length>=5);
      assert.ok(body.control_gap.length>=5);
      assert.ok(body.support_needed.length>=5);
      return response(route,{saved:true,id:body.submission_id});
    });
    await page.goto(url('/',locale),{waitUntil:'load'});
    await localeReady(page,locale);
    await page.locator('#founder-survey-form').evaluate(el=>{
      for(let parent=el.parentElement;parent;parent=parent.parentElement)
        if(parent.tagName==='DETAILS')parent.open=true;
    });
    await page.waitForFunction(() => !document.querySelector('#founder-survey-form button[type="submit"]').disabled);
    assert.equal(await page.locator('#founder-survey-form').evaluate(el=>el.checkValidity()),false,
      'Founder survey must require three meaningful answers');
    await page.locator('#survey-milestone').fill('Preparing our first EU launch');
    await page.locator('#survey-controls').fill('Third-party checks need improvement');
    await page.locator('#survey-support').fill('Review and prioritize practical controls');
    await page.locator('#founder-survey-form button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#survey-success').hidden);
    assert.equal(posts,1,'Survey should make exactly one mocked request');
    assert.ok((await page.locator('#survey-reference').textContent())?.trim(),
      'Missing reference after successful mocked submission');
    checks++;
  } finally {await page.close();}
}

try {
  for (const locale of locales) {
    for (const [name,fn] of [
      ['newsletter email fallback',newsletter],
      ['training enquiry fallback',training],
      ['founder survey mocked save',founderSurvey]
    ]) {
      try {await fn(locale);}
      catch(error){failures.push(locale+' '+name+': '+error.message);}
    }
  }
} finally {await browser.close();}
console.log('Local form-flow QA: '+checks+'/12 locale-form scenarios passed (mock APIs, no real submissions).');
if (failures.length) {
  for (const failure of failures)console.error('FAILED: '+failure);
  process.exitCode=1;
} else {
  console.log('Passed offline newsletter/training drafts and mocked founder survey saves in all four website languages.');
}
