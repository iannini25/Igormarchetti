import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('../lippi/', import.meta.url));
const pages = [['index.html','home'],['training.html','training'],['regulations.html','regulations'],['articles.html','articles']];
const navigation = [['home','/','Home'],['training','/training.html','Training'],['regulations','/regulations.html','Regulatory'],['articles','/articles.html','Articles']];
const header = active => `<header class="lippi-header"><div class="lippi-header-inner"><a class="lippi-brand" href="/" aria-label="Lippi FinTech Advisory home"><img src="/assets/lippi-fintech-advisory-logo.png" alt="Lippi FinTech Advisory" width="2172" height="724"></a><button class="lippi-menu-button" type="button" aria-expanded="false" aria-controls="lippi-navigation"><span class="lippi-menu-icon" aria-hidden="true"></span>Menu</button><nav class="lippi-nav" id="lippi-navigation" aria-label="Main navigation">${navigation.map(([key,url,title])=>`<a href="${url}"${key===active?' aria-current="page"':''}>${title}</a>`).join('')}<a class="lippi-book" href="https://calendly.com/igormarchettilippi/30min" target="_blank" rel="noopener noreferrer">Book a call <span aria-hidden="true">↗</span></a></nav></div></header>`;
const footer = current => `<footer class="lippi-footer"><div class="lippi-footer-inner"><div class="lippi-footer-top"><div><strong>Lippi FinTech Advisory</strong><p>Practical risk, controls and learning for fintech teams.<br>${current==='regulations' ? '<span data-reg-ui="marketExperience">Experience across the European Union, the UK and Brazil.</span>' : 'Experience across the European Union, the UK and Brazil.'}</p><a href="mailto:lippifintech@igormarchetti.me">lippifintech@igormarchetti.me</a></div><div class="lippi-footer-links"><a href="/#services">Advisory services</a><a href="/training.html">Training</a><a href="/regulations.html">Regulatory updates</a><a href="/articles.html">Articles</a><a href="/articles.html#newsletter">Newsletter</a><a href="/#about">About Igor</a><a href="/#founder-survey">Founder survey</a><a href="https://www.linkedin.com/in/igormarchetti/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div></div><div class="lippi-footer-bottom"><p>© 2026 Igor Marchetti${current==='home'?' Lippi':''} · Lippi FinTech Advisory</p><a href="/#scope">Advisory scope</a></div></div></footer>`;
for (const [file,current] of pages) {
  const path = directory + file;
  let html = readFileSync(path,'utf8');
  // Static navigation stays usable before scripts load and when JavaScript is disabled.
  html = html.replace(/<div data-site-header[^>]*>[\s\S]*?<!-- \/site-header -->/g, '<div data-site-header data-current-page="'+current+'"></div>');
  html = html.replace(/<div data-site-footer[^>]*>[\s\S]*?<!-- \/site-footer -->/g, '<div data-site-footer></div>');
  html = html.replace(/<div data-site-header[^>]*>(?:\s*<nav[^>]*>[\s\S]*?<\/nav>)?\s*<\/div>/, `<div data-site-header data-current-page="${current}">${header(current)}</div><!-- /site-header -->`);
  html = html.replace(/<div data-site-footer[^>]*>(?:\s*<footer[^>]*>[\s\S]*?<\/footer>)?\s*<\/div>/, `<div data-site-footer>${footer(current)}</div><!-- /site-footer -->`);
  if (!html.includes('href="/assets/site-shell.css"')) html=html.replace('</head>','<link rel="stylesheet" href="/assets/site-shell.css">\n</head>');
  if (!html.includes('src="/assets/site-shell.js"')) html=html.replace('</body>','<script src="/assets/site-shell.js" defer></script>\n</body>');
  if (!html.includes('name="lippi-release"')) html=html.replace('</head>','<meta name="lippi-release" content="2026-11-18-integrated">\n</head>');
  if (!html.includes('id="lippi-navigation"')) throw new Error('Missing navigation in '+file);
  if (!html.includes('class="lippi-footer"')) throw new Error('Missing footer in '+file);
  writeFileSync(path,html);
  console.log('Rendered shared navigation: '+file);
}
