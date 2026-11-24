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
const bookingUrl = 'https://calendly.com/igormarchettilippi/20min';
const brand = '<a class="lippi-brand" href="/" aria-label="Lippi home"><img src="/logo.svg" alt="Lippi" width="1120" height="280"></a>';
const menuButton = '<button class="lippi-menu-button" type="button" aria-expanded="false" aria-controls="lippi-navigation"><span class="lippi-menu-icon" aria-hidden="true"></span>Menu</button>';
const appointment = `<a class="lippi-appointment" href="${bookingUrl}" target="_blank" rel="noopener noreferrer" data-key="appointment">Book an appointment</a>`;
function header(active) {
  const home = active === 'home';
  const links = home
    ? [['advisory','/independence.html#scope','Advisory'], ...navigation.slice(2)]
    : navigation;
  const items = links.map(([key,url,title]) => `<a href="${url}"${key===active?' aria-current="page"':''}>${title}</a>`).join('');
  const survey = `<a class="lippi-book" href="/survey.html">${home ? 'Complete the survey' : 'Take the company survey'}</a>`;
  const nav = home
    ? `<div class="lippi-nav" id="lippi-navigation">${items}${survey}</div>`
    : `<nav class="lippi-nav" id="lippi-navigation" aria-label="Main navigation">${items}${survey}</nav>`;
  const training = home ? '<a class="training-shortcut" href="/training.html">Training</a>' : '';
  return `<header class="lippi-header"><div class="lippi-header-inner"${home ? ' role="navigation" aria-label="Main navigation"' : ''}>${brand}${training}${appointment}${menuButton}${nav}</div></header>`;
}
const footer = readFileSync(new URL('./lippi-footer.html', import.meta.url), 'utf8').trim();
const footerOnly = process.argv.includes('--footers');

function renderFooter(html) {
  const markup = '<div data-site-footer>\n' + footer + '\n</div><!-- /site-footer -->';
  const region = /<div data-site-footer[^>]*>[\s\S]*?<!-- \/site-footer -->/;
  if (region.test(html)) {
    html = html.replace(region, markup);
  } else if (/<footer\b/.test(html)) {
    html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/, markup);
  } else {
    html = html.replace('</main>', '</main>\n' + markup);
  }
  if ((html.match(/<footer\b/g) || []).length !== 1 || !html.includes(markup)) {
    throw new Error('Expected one shared footer');
  }
  if (!html.includes('href="/assets/lippi-footer.css"')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="/assets/lippi-footer.css">\n</head>');
  }
  return html;
}

function insertStylesheet(html, href) {
  if (html.includes(`href="${href}"`)) return html;
  const tag = `<link rel="stylesheet" href="${href}">\n`;
  const designLayer = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">');
  return designLayer > 0 ? html.slice(0, designLayer) + tag + html.slice(designLayer) : html.replace('</head>', tag + '</head>');
}

for (const [file,current,translated] of [...pages, ['survey-admin.html'], ['training-admin.html'], ['privacy.html']]) {
  const path = directory + file;
  let html = renderFooter(readFileSync(path,'utf8'));
  if (footerOnly || current === undefined) {
    writeFileSync(path,html);
    continue;
  }
  // Static navigation stays usable before scripts load and when JavaScript is disabled.
  html = html.replace(/<div data-site-header[^>]*>[\s\S]*?<!-- \/site-header -->/g, '<div data-site-header data-current-page="'+current+'"></div>');
  html = html.replace(/<div data-site-header[^>]*>(?:\s*<nav[^>]*>[\s\S]*?<\/nav>)?\s*<\/div>/, `<div data-site-header data-current-page="${current}">${header(current)}</div><!-- /site-header -->`);
  html = insertStylesheet(html,'/assets/site-shell.css');
  if (!html.includes('href="/assets/appointment.css"')) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/appointment.css">\n</head>');
  if (translated && !html.includes('src="/assets/site-shell.js"')) html=html.replace('</body>','<script src="/assets/site-shell.js" defer></script>\n</body>');
  if (!html.includes('name="lippi-release"')) html=html.replace('</head>','<meta name="lippi-release" content="2026-11-19-refresh">\n</head>');
  if (!html.includes('id="lippi-navigation"')) throw new Error('Missing navigation in '+file);
  if (!html.includes('class="lippi-footer"')) throw new Error('Missing footer in '+file);
  writeFileSync(path,html);
  console.log('Rendered shared navigation: '+file);
}
