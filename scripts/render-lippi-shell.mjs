import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('../lippi/', import.meta.url));
// Pages without a translated body still share the navigation and its language control.
const pages = [
  ['index.html', 'home'], ['training.html', 'training'], ['events.html', 'events'], ['regulations.html', 'regulations'],
  ['articles.html', 'articles'], ['ai-governance-fintech-web-summit-2026.html', 'article'],
  ['independence.html', 'advisory', true], ['survey.html', 'survey'],
  ['privacy.html', 'privacy', true], ['survey-admin.html', 'admin', true], ['training-admin.html', 'admin', true]
];
const links = [
  ['events', '/events.html', 'Events'],
  ['advisory', '/independence.html#scope', 'Advisory'],
  ['regulations', '/regulations.html', 'Regulatory'],
  ['articles', '/articles.html', 'Articles'],
  ['survey', '/survey.html', 'Survey']
];
const bookingUrl = 'https://calendly.com/igormarchettilippi/20min';

function header(active, headerOnly) {
  function current(key) {
    if (active === key) return ' aria-current="page"';
    return key === 'articles' && active === 'article' ? ' aria-current="location"' : '';
  }
  return `<div data-site-header data-current-page="${active}"${headerOnly ? ' data-localise-header-only' : ''}>
<header class="site-masthead"><nav class="site-bar" aria-label="Main navigation">
  <a class="site-brand" href="/" aria-label="Lippi home"${current('home')}><img src="/logo.svg" alt="Lippi" width="1120" height="280"></a>
  <a class="site-link" href="/training.html"${current('training')}>Training</a>
  <button class="lippi-menu-button" type="button" aria-expanded="false" aria-controls="lippi-navigation"><span>Menu</span></button>
  <div class="site-links" id="lippi-navigation">
    ${links.map(([key, url, title]) => `<a class="site-link" href="${url}"${current(key)}>${title}</a>`).join('\n    ')}
  </div>
  <a class="site-book" href="${bookingUrl}" target="_blank" rel="noopener noreferrer">Book a call</a>
</nav></header></div><!-- /site-header -->`;
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

for (const [file, current, headerOnly] of pages) {
  const path = directory + file;
  let html = renderFooter(readFileSync(path, 'utf8'));
  if (!footerOnly) {
    const region = /<div data-site-header[^>]*>[\s\S]*?<!-- \/site-header -->/;
    const markup = header(current, headerOnly);
    html = region.test(html) ? html.replace(region, markup) : html.replace(/<body\b[^>]*>/, '$&' + markup);
    if (!html.includes('class="skip-link"')) {
      html = html.replace(/<main(?![^>]*\bid=)/, '<main id="main"');
      const mainId = html.match(/<main\b[^>]*\bid="([^"]+)"/)[1];
      html = html.replace(markup, '<a class="skip-link" href="#' + mainId + '">Skip to main content</a>' + markup);
    }
    const stylesheet = '<link rel="stylesheet" href="/assets/site-navigation.css">';
    if (!html.includes(stylesheet)) html = html.replace('</head>', stylesheet + '\n</head>');
    if (!html.includes('src="/assets/site-shell.js"')) {
      html = html.replace('</body>', '<script defer src="/assets/site-shell.js"></script>\n</body>');
    }
    if (!html.includes(markup)) throw new Error('Missing shared navigation in ' + file);
  }
  writeFileSync(path, html);
}

execFileSync('python3', [fileURLToPath(new URL('./render-lippi-brazil.py', import.meta.url))]);
