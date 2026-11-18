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
  'Thank you — your newsletter request and consent have been saved. No automatic confirmation email is sent. You can unsubscribe at any time by emailing Igor.'
]) assert.equal(sharedCopy[key]?.length,3,'Missing PT/ES/IT dynamic copy: '+key);
assert.ok(shell.includes('window.LippiI18n'), 'Forms need the shared translation interface');
assert.ok(shell.includes('translateMetadata(lang)'), 'Page title and metadata not localized');
for(const file of ['assets/articles.js','assets/founder-survey.js']) {
  assert.ok(read(file).includes('lippi:languagechange'), 'Dynamic messages do not update for '+file);
}
await import('../assets/training.js'); // Module syntax and safe no-DOM import.
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
const regulatoryPage = read('regulations.html');
assert.ok(regulatoryPage.includes('<option value="it">Italiano</option>'),'Regulations picker lacks Italian');
assert.ok(shell.includes('lippi-language-picker'),'Shared picker missing');
for (const file of ['assets/site-shell.js','assets/regulations.js','assets/articles.js','assets/founder-survey.js']) {
  new Script(read(file),{filename:file});
}
const independentScript = independence.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(independentScript,'Independence inline script missing');
new Script(independentScript[1],{filename:'independence-inline'});
console.log('Source-level localization checks passed for 4 languages; 7 regulatory explainers; independence page and '+Object.keys(sharedCopy).length+' curated shared translations. Browser tests still required.');
