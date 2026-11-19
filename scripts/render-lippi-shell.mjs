import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('../lippi/', import.meta.url));
// [file, active nav key, loads the shared translation script]
const pages = [
  ['index.html','home',true],['training.html','training',true],['regulations.html','regulations',true],
  ['articles.html','articles',true],['ai-governance-fintech-web-summit-2026.html','articles',true],
  ['independence.html','',false],['survey.html','',true]
];
const navigation = [['home','/','Home'],['training','/training.html','Training'],['regulations','/regulations.html','Regulatory'],['articles','/articles.html','Articles']];
const bookingUrl = 'https://calendly.com/igormarchettilippi/30min';
const linkedInUrl = 'https://www.linkedin.com/in/igormarchetti/';
const email = 'lippifintech@igormarchetti.me';
const linkedInIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>';
const mailIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6"/></svg>';
const header = active => `<header class="lippi-header"><div class="lippi-header-inner"><a class="lippi-brand" href="/" aria-label="Lippi FinTech Advisory home"><img src="/assets/lippi-fintech-advisory-logo.png" alt="Lippi FinTech Advisory" width="2172" height="724"></a><button class="lippi-menu-button" type="button" aria-expanded="false" aria-controls="lippi-navigation"><span class="lippi-menu-icon" aria-hidden="true"></span>Menu</button><nav class="lippi-nav" id="lippi-navigation" aria-label="Main navigation">${navigation.map(([key,url,title])=>`<a href="${url}"${key===active?' aria-current="page"':''}>${title}</a>`).join('')}<a class="lippi-book" href="${bookingUrl}" target="_blank" rel="noopener noreferrer">Free initial call <span class="lp-ic" data-ic="up-right" aria-hidden="true"></span></a></nav></div></header>`;
const footer = `<footer class="lippi-footer"><div class="lippi-footer-inner"><div class="lippi-footer-top"><div><a class="lippi-footer-logo" href="/" aria-label="Lippi FinTech Advisory home"></a><strong class="lippi-visually-hidden">Lippi FinTech Advisory</strong><p>Risk and compliance consulting for fintech teams.<br>Helping fintechs enter and expand in European and Brazilian markets.</p><div class="lippi-footer-social"><a href="${linkedInUrl}" target="_blank" rel="noopener noreferrer" aria-label="Igor Marchetti Lippi on LinkedIn">${linkedInIcon}</a><a href="mailto:${email}" aria-label="Email Lippi FinTech Advisory">${mailIcon}</a></div><a class="lippi-footer-email" href="mailto:${email}">${email}</a></div><div class="lippi-footer-links"><a href="/#services">Advisory services</a><a href="/training.html">Training</a><a href="/regulations.html">Regulatory updates</a><a href="/articles.html">Articles</a><a href="/articles.html#newsletter">Newsletter</a><a href="/#about">About Igor</a><a href="/survey.html">Founder survey</a></div></div><div class="lippi-footer-bottom"><p>© 2026 Igor Marchetti Lippi · Lippi FinTech Advisory</p><a href="/#scope">Advisory scope</a><a href="/independence.html">Independence &amp; conflicts</a></div></div></footer>`;

function insertStylesheet(html, href) {
  if (html.includes(`href="${href}"`)) return html;
  const tag = `<link rel="stylesheet" href="${href}">\n`;
  const designLayer = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">');
  return designLayer > 0 ? html.slice(0, designLayer) + tag + html.slice(designLayer) : html.replace('</head>', tag + '</head>');
}

for (const [file,current,translated] of pages) {
  const path = directory + file;
  let html = readFileSync(path,'utf8');
  // Static navigation stays usable before scripts load and when JavaScript is disabled.
  html = html.replace(/<div data-site-header[^>]*>[\s\S]*?<!-- \/site-header -->/g, '<div data-site-header data-current-page="'+current+'"></div>');
  html = html.replace(/<div data-site-footer[^>]*>[\s\S]*?<!-- \/site-footer -->/g, '<div data-site-footer></div>');
  html = html.replace(/<div data-site-header[^>]*>(?:\s*<nav[^>]*>[\s\S]*?<\/nav>)?\s*<\/div>/, `<div data-site-header data-current-page="${current}">${header(current)}</div><!-- /site-header -->`);
  html = html.replace(/<div data-site-footer[^>]*>(?:\s*<footer[^>]*>[\s\S]*?<\/footer>)?\s*<\/div>/, `<div data-site-footer>${footer}</div><!-- /site-footer -->`);
  html = insertStylesheet(html,'/assets/site-shell.css');
  if (translated && !html.includes('src="/assets/site-shell.js"')) html=html.replace('</body>','<script src="/assets/site-shell.js" defer></script>\n</body>');
  if (!html.includes('name="lippi-release"')) html=html.replace('</head>','<meta name="lippi-release" content="2026-11-19-refresh">\n</head>');
  if (!html.includes('id="lippi-navigation"')) throw new Error('Missing navigation in '+file);
  if (!html.includes('class="lippi-footer"')) throw new Error('Missing footer in '+file);
  writeFileSync(path,html);
  console.log('Rendered shared navigation: '+file);
}
