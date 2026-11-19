/** Dependency-free source-level checks; run with npm run test:i18n from lippi/. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');
const locales = ['en','pt','es','it'];
const translatedFields = ['topicLabel','statusLabel','title','summary','action','applicability'];
const independenceFields = ['title','intro','screen','approval','scope','security','end'];
const reg = JSON.parse(read('assets/regulatory-content.json'));
assert.equal(reg.explainers.length,7,'Expected seven regulatory explainers');
for (const locale of locales) {
  assert.ok(reg.ui[locale], 'Missing regulatory UI locale '+locale);
  for (const key of Object.keys(reg.ui.en)) {
    assert.ok(reg.ui[locale][key]?.trim(), 'Missing regulatory UI '+locale+'.'+key);
  }
  for (const item of reg.explainers) {
    for (const field of translatedFields) {
      assert.ok(item[field]?.[locale]?.trim(), 'Missing '+item.id+'.'+field+'.'+locale);
    }
  }
}
const independence = read('independence.html');
const match = independence.match(/const t=(\{[\s\S]*?\});const s=/);
assert.ok(match, 'Missing independence translation dictionary');
const independentCopy = JSON.parse(match[1]);
for(const locale of locales) {
  assert.ok(independence.includes('value="'+locale+'"'),'Independence selector missing '+locale);
  for(const field of independenceFields) {
    assert.ok(independentCopy[locale]?.[field]?.trim(),'Missing independence '+locale+'.'+field);
  }
}
// Regression checks for an English-first, shareable, conflict-safe release.
for (const page of [
  'index.html','training.html','regulations.html','articles.html',
  'independence.html','ai-governance-fintech-web-summit-2026.html'
]) {
  assert.match(read(page),/<html\b[^>]*\blang="en"/i,'English must remain the HTML default on '+page);
}
const independenceGuardrails = {
  en: {approval:/in writing/i,scope:/fractional CRO roles/i},
  pt: {approval:/por escrito/i,scope:/CRO fracionado/i},
  es: {approval:/por escrito/i,scope:/CRO fraccional/i},
  it: {approval:/per iscritto/i,scope:/CRO frazionale/i}
};
for (const [locale,guardrails] of Object.entries(independenceGuardrails)) {
  assert.match(independentCopy[locale].approval,guardrails.approval,
    'Missing written employer-approval requirement: '+locale);
  assert.match(independentCopy[locale].scope,guardrails.scope,
    'Missing exclusion of fractional CRO roles: '+locale);
}
assert.ok(independence.includes("history.replaceState(null,'',shareUrl)"),
  'Independence page must preserve its locale in a shareable URL');
const shell = read('assets/site-shell.js');
const shellMatch = shell.match(/const words = (\{[^\n]+\});\n  const sourceText/);
assert.ok(shellMatch,'Shared language dictionary not found');
const sharedCopy = JSON.parse(shellMatch[1]);
for(const [source,translations] of Object.entries(sharedCopy)) {
  assert.ok(source.trim(),'Empty source text');
  assert.equal(translations.length,3,'Expected pt/es/it entries for '+source);
  for (const entry of translations) assert.ok(entry.trim(),'Blank translation for '+source);
}
// Dynamic form states and metadata must be represented in the shared dictionary.
for(const key of [
  'Articles & Newsletter | Lippi FinTech Advisory',
  'Latest article and upcoming perspectives.',
  'Newsletter emails are currently available in English, Portuguese and Spanish. The website can also be viewed in Italian.',
  'Ready when you are. All three questions are required.',
  'Online registration is temporarily unavailable. You can prepare an email enquiry using your answers.',
  'Please select at least one market, or Still exploring.',
  'Saving your newsletter request…',
  'Thank you. Your newsletter request and consent have been saved. No automatic confirmation email is sent. You can unsubscribe at any time by emailing Igor.'
]) assert.equal(sharedCopy[key]?.length,3,'Missing PT/ES/IT dynamic copy: '+key);
assert.ok(shell.includes('window.LippiI18n'), 'Forms need the shared translation interface');
assert.ok(shell.includes('translateMetadata(lang)'), 'Page title and metadata not localized');
for(const file of ['assets/articles.js','assets/founder-survey.js']) {
  assert.ok(read(file).includes('lippi:languagechange'), 'Dynamic messages do not update for '+file);
}
const trainingModule = await import('../assets/training.js'); // Module syntax and safe no-DOM import.
assert.ok(read('assets/training.js').includes('lippi:languagechange'), 'Training form lacks language refresh');
// Every translatable static text node on Articles must have PT/ES/IT copy.
// Brand names, email, native language names and copyright remain unchanged.
const articleHtml = read('articles.html')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<!--[\s\S]*?-->/g,'');
const articleNames = new Set([
  'English','Português','Español','Lippi FinTech Advisory',
  'lippifintech@igormarchetti.me','LinkedIn ↗',
  '© 2026 Igor Marchetti · Lippi FinTech Advisory'
]);
const articleText = new Set(articleHtml.split(/<[^>]+>/).map(text=>text
  .replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'")
  .replace(/&rsquo;/g,'’').replace(/&ndash;/g,'–').replace(/&hellip;/g,'…').trim())
  .filter(text=>text.length>3&&!/^[\s\d.,↗→↓·]+$/.test(text)));
for(const text of articleText) {
  if (!articleNames.has(text)) assert.ok(sharedCopy[text], 'Unlocalized article text: '+text);
}
// Published long-form article uses the shared picker and must be complete in every locale.
const article = read('ai-governance-fintech-web-summit-2026.html');
const articlesIndex = read('articles.html');
assert.ok(articlesIndex.includes('href="/ai-governance-fintech-web-summit-2026.html"'),'Articles index does not link to published article');
assert.ok(article.includes('data-site-header'),'AI article does not initialise the shared language control');
assert.ok(article.includes('<script defer src="/assets/site-shell.js"></script>'),'AI article is missing shared localization');
assert.ok(article.includes('id="lippi-navigation"'),'AI article lacks picker insertion target');
const articleVisibleText = article
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .split(/<[^>]+>/)
  .map(text=>text.replace(/&amp;/g,'&').replace(/\s+/g,' ').trim())
  .filter(text=>text.length>3);
for (const source of new Set(articleVisibleText)) {
  assert.equal(sharedCopy[source]?.length,3,'Unlocalized AI article text: '+source);
}
for(const key of [
 'AI Governance in Fintech: Five Practical Questions | Lippi FinTech Advisory',
 'Five practical questions fintech founders can ask about AI governance, accountability, data, monitoring and third-party risk, following Web Summit Lisbon 2026.',
 'A practical reflection on AI governance, risk and accountability for fintech teams following Web Summit Lisbon 2026.'
]) assert.equal(sharedCopy[key]?.length,3,'Missing translated article metadata: '+key);
for(const [locale,index] of [['pt',0],['es',1],['it',2]]) {
  const statement=sharedCopy['Lippi shares practical perspectives on fintech risk, controls, governance and regulatory readiness. Advisory or training engagements are considered individually, subject to conflict-of-interest screening and any required employer approval. Fractional CRO services are not currently offered.']?.[index];
  assert.ok(statement?.includes('CRO'), 'Missing fractional CRO exclusion in AI article '+locale);
}
// Training selects keep their underlying values; visible options are localized.
assert.ok(shell.includes("picker && node.parentElement?.closest('option')"),'Regulatory filter options must remain owned by regulations.js');
const trainingOptions = [...read('training.html').matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
  .map(match=>match[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim());
for(const option of new Set(trainingOptions)) {
  if (option !== 'English') assert.equal(sharedCopy[option]?.length,3,'Missing training option translation: '+option);
}
for (const page of ['index.html','training.html']) {
  for (const match of read(page).matchAll(/placeholder="([^"]+)"/g)) {
    assert.equal(sharedCopy[match[1]]?.length,3,'Missing '+page+' placeholder translation: '+match[1]);
  }
}
const regulatoryPage = read('regulations.html');
assert.ok(regulatoryPage.includes('<option value="it">Italiano</option>'),'Regulations picker lacks Italian');
const regulatoryRuntime = read('assets/regulations.js');
assert.ok(regulatoryRuntime.includes("history.replaceState(null,'',shareUrl)"),
  'Regulatory page must preserve its locale in a shareable URL');
assert.ok(regulatoryRuntime.includes('translationLoadError[currentLanguage]'),
  'Regulatory translation failure notice must follow the active language');
for(const locale of locales) {
  assert.ok(regulatoryRuntime.includes('    '+locale+':'),
    'Missing '+locale+' regulatory translation failure notice');
}
// Locale-aware public links must be shareable without rewriting API, downloads,
// external URLs or page anchors. Repeated language switches must be reversible.
const linkStart = shell.indexOf('  const publicPages = new Set(');
const linkEnd = shell.indexOf('  function apply(language)',linkStart);
assert.ok(linkStart > 0 && linkEnd > linkStart,'Shared internal-link localization is missing');
const linkSection = shell.slice(linkStart,linkEnd);
const makeLink = href => ({
  href,
  getAttribute(name) { assert.equal(name,'href'); return this.href; },
  setAttribute(name,value) { assert.equal(name,'href'); this.href = value; }
});
const testLinks = [
  makeLink('/training.html#modules'),
  makeLink('/articles.html?ref=nav'),
  makeLink('/independence.html'),
  makeLink('/api/newsletter/health'),
  makeLink('/downloads/brochure.pdf'),
  makeLink('https://example.com/training.html'),
  makeLink('//example.com/articles.html'),
  makeLink('#top')
];
const linkSnapshots = new Script(
  'const originalLinkHref = new WeakMap();\n'+linkSection+
  "\n['it','en','pt'].map(language => { syncInternalLinks(language); return links.map(link => link.href); });",
  {filename:'lippi-public-link-localization'}
).runInNewContext({
  document:{querySelectorAll:()=>testLinks},
  location:{origin:'https://lippi.igormarchetti.me'},
  links:testLinks,
  URL
});
assert.equal(linkSnapshots[0][0],'/training.html?lang=it#modules');
assert.equal(linkSnapshots[0][1],'/articles.html?ref=nav&lang=it');
assert.equal(linkSnapshots[0][2],'/independence.html?lang=it');
assert.equal(linkSnapshots[1][0],'/training.html#modules','English should restore the original link');
assert.equal(linkSnapshots[1][1],'/articles.html?ref=nav');
assert.equal(linkSnapshots[2][0],'/training.html?lang=pt#modules');
for (const snapshot of linkSnapshots) {
  assert.deepEqual([...snapshot.slice(3)],testLinks.slice(3).map(link=>link.href),
    'Only public page routes should receive a locale parameter');
}
assert.ok(shell.includes('syncInternalLinks(lang);'),'Language updates must refresh public links');
assert.ok(independence.includes("document.querySelector('nav a').setAttribute('href',l==='en'?'/':'/?lang='+l)"),
  'Independence return link must preserve language');
assert.ok(independence.includes("if(!t[init])try{init=localStorage.getItem('lippi-language')}"),
  'Independence page must reject invalid locale parameters and use a saved language');

assert.ok(shell.includes('lippi-language-picker'),'Shared picker missing');
for (const file of ['assets/site-shell.js','assets/regulations.js','assets/articles.js','assets/founder-survey.js']) {
  new Script(read(file),{filename:file});
}
const independentScript = independence.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(independentScript,'Independence inline script missing');
new Script(independentScript[1],{filename:'independence-inline'});

// Public homepage and training copy must never fall back to untranslated English.
// Names, brand marks, email addresses and qualifications intentionally remain unchanged.
const unchangedNames = new Set([
 'Igor Marchetti Lippi','lippifintech@igormarchetti.me',
 'Fiserv / AIB Merchant Services','Elavon / U.S. Bank',
 'J.P. Morgan Merchant Services','Worldpay & Barclaycard',
 'Planet','Tyl by NatWest',
 '© 2026 Igor Marchetti Lippi · Lippi FinTech Advisory',
 'Central Bank of Ireland','Banco de Portugal','Banco Central do Brasil'
]);
const deEntity = value => value
  .replace(/&amp;/g,'&').replace(/&nbsp;/g,' ')
  .replace(/&#39;/g,"'").replace(/&rsquo;/g,'’')
  .replace(/&mdash;/g,'—').replace(/\s+/g,' ').trim();
const contentAudit = {};
for (const file of ['index.html','training.html']) {
  const html = read(file)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<!--[\s\S]*?-->/g,'');
  const visible = [...new Set(html.split(/<[^>]+>/).map(deEntity)
    .filter(value=>value.length>3 && !/^[\d\s\-\.%€@\/]+$/.test(value)))];
  for(const value of visible) {
    if (unchangedNames.has(value)) continue;
    assert.equal(sharedCopy[value]?.length,3,
      file+' text is missing PT/ES/IT copy: '+value);
  }
  contentAudit[file] = {total:visible.length,localized:visible.filter(value=>sharedCopy[value]).length,
    unchanged:visible.filter(value=>unchangedNames.has(value)).length};
}
// Titles, description and open-graph snippets on shared-shell pages must translate.
for(const file of ['index.html','training.html','articles.html','ai-governance-fintech-web-summit-2026.html']) {
  const html = read(file);
  const candidates = [
    ...[...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map(match=>match[1]),
    ...[...html.matchAll(/<meta\s+(?:name="description"|property="og:title"|property="og:description"|name="twitter:title"|name="twitter:description")\s+content="([^"]+)"/gi)].map(match=>match[1])
  ];
  for(const raw of new Set(candidates)) {
    const value = deEntity(raw);
    assert.equal(sharedCopy[value]?.length,3,
       file+' metadata missing PT/ES/IT copy: '+value);
  }
}


const enquirySample = {
  target_markets:['brazil','ireland'], priority:'grc', budget:'100_199',
  format:'online', language:'portuguese', home_market:'São Paulo',
  business_model:'Payments', comment:'Governance', referral:'Website',
  contact_opt_in:true, email:'founder@example.com'
};
for(const [language,i] of [['en',-1],['pt',0],['es',1],['it',2]]) {
  const tr = key => i === -1 ? key : (sharedCopy[key]?.[i] || key);
  const draft = trainingModule.buildTrainingEmail(enquirySample,tr);
  assert.ok(draft.body.startsWith(tr('Hello Igor,')),language+' email greeting did not localize');
  assert.ok(draft.body.includes(tr('Target markets: ')),language+' email market label did not localize');
  assert.ok(draft.body.includes(tr('This is an enquiry about the paid pilot; it does not confirm a booking or price.')),
    language+' email disclaimer did not localize');
  assert.ok(draft.body.includes('founder@example.com'),'Contact email missing from generated draft');
  assert.ok(draft.mailto.startsWith('mailto:lippifintech@igormarchetti.me?subject='),
    language+' email link missing');
}
const newsletter = read('assets/articles.js');
for(const key of [
  'Please add me to the Lippi newsletter list.',
  'I agree to receive Lippi articles and regulatory updates by email. I can withdraw my consent at any time by emailing lippifintech@igormarchetti.me.',
  'Consent notice version:','Lippi newsletter request'
]) {
  assert.equal(sharedCopy[key]?.length,3,'Newsletter draft untranslated: '+key);
  assert.ok(newsletter.includes('tr(\''+key+'\')'),'Newsletter draft not wired to translation: '+key);
}
assert.ok(read('index.html').includes("document.addEventListener('lippi:languagechange', () => filterTopics(currentTopic))"),
  'Homepage filter count not refreshed after a language change');

// Keep every public Lippi content page discoverable without exposing admin routes.
const sitemap = read('sitemap.xml');
for (const path of [
  '/', '/training.html', '/regulations.html', '/articles.html',
  '/independence.html', '/ai-governance-fintech-web-summit-2026.html'
]) {
  assert.ok(sitemap.includes('<loc>https://lippi.igormarchetti.me' + path + '</loc>'),
    'Public page missing from sitemap: '+path);
}
for (const path of ['/survey-admin.html','/training-admin.html']) {
  assert.ok(!sitemap.includes('<loc>https://lippi.igormarchetti.me'+path+'</loc>'),
    'Admin-only path exposed in sitemap: '+path);
}


// Guard accessibility text as well as visible copy: regression-protect image
// alternatives, form placeholders and aria-labels on all six public pages.
// Proper names and example email addresses intentionally stay unchanged.
const unchangedAttributeValues = new Set(['Igor Marchetti Lippi','you@company.com']);
for(const page of [
  'index.html','training.html','regulations.html','articles.html',
  'independence.html','ai-governance-fintech-web-summit-2026.html'
]) {
  for(const match of read(page).matchAll(/\b(?:aria-label|placeholder|alt|title)="([^"]+)"/g)) {
    const value = deEntity(match[1]).trim();
    if(!value || unchangedAttributeValues.has(value)) continue;
    assert.equal(sharedCopy[value]?.length,3,
      page+' missing PT/ES/IT accessible/form attribute copy: '+value);
  }
}

console.log('Source-level localization checks passed for 4 languages; 7 regulatory explainers; independence page and '+Object.keys(sharedCopy).length+' curated shared translations. Home/training copy audited: '+JSON.stringify(contentAudit)+'. Browser tests still required.');
