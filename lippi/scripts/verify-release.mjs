/** Static safety checks for the Lippi Vercel release. Not an authentication audit.
 * Run: node scripts/verify-release.mjs [path-to-public-site]
 * With no argument the lippi/ directory is checked.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const failures = [];
let passed = 0;
const check = (ok, label) => { if (ok) { passed += 1; } else { failures.push(label); } };
async function text(relative) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`Missing or unreadable: ${relative}`); return null; }
}
async function data(relative) {
  const value = await text(relative);
  if (value === null) return null;
  try { return JSON.parse(value); }
  catch { failures.push(`Invalid JSON: ${relative}`); return null; }
}
async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { failures.push(`Review symlink before release: ${path.relative(root, absolute)}`); continue; }
    if (entry.isDirectory()) paths.push(...await walk(absolute));
    else paths.push(absolute);
  }
  return paths;
}
for (const page of ['index', 'training', 'regulations', 'articles']) {
  const html = await text(`${page}.html`);
  if (html === null) continue;
  check(html.includes(`data-page="${page}"`), `${page}: route identity`);
  check(/<meta\b[^>]*name=["']viewport["']/i.test(html), `${page}: viewport`);
  check(!/<meta\b[^>]*(?:name=["']lippi-review["']|content=["'][^"']*noindex)/i.test(html), `${page}: remove review-only indexing restrictions`);
  check(html.includes('id="main"'), `${page}: accessible main target`);
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+)["']/g)) {
    await text(match[1].slice(1));
  }
}
const content = await data('assets/site-content.json');
if (content) {
  for (const group of ['regulations', 'news', 'articles']) {
    const items = content[group];
    check(Array.isArray(items), `Content array: ${group}`);
    if (Array.isArray(items)) {
      check(items.every(item => item.publicationStatus === 'published'), `Only approved published ${group}`);
      check(new Set(items.map(item => item.id)).size === items.length, `Unique ${group} identifiers`);
    }
  }
  check(!JSON.stringify(content).includes('editorialNote'), 'No private editorial notes in public content');
}
const curriculum = await data('assets/course-public.json');
if (curriculum) {
  check(Array.isArray(curriculum.modules) && curriculum.modules.length === 10, 'Preserve ten public curriculum modules');
  for (const language of ['en', 'pt', 'es']) {
    check((curriculum.modules || []).every(module => ['title', 'goal', 'summary'].every(field => typeof module[field]?.[language] === 'string' && module[field][language].trim())), `Public curriculum translations: ${language}`);
  }
}
await data('assets/ui.json');
const files = await walk(root);
const privateNames = new Set(['seed-content.json', 'course-i18n.json', 'owner.json', 'content-state.json']);
for (const file of files) {
  const name = path.basename(file);
  const relative = path.relative(root, file).split(path.sep).join('/');
  check(!privateNames.has(name), `Private payload must not enter public repository: ${relative}`);
  check(!/(^|\/)(?:lippi_site_private|lippi_training_private|review)(\/|$)/.test(relative), `Private directory must not enter public repository: ${relative}`);
  check(!/\.(?:php|zip|tar|gz)$/i.test(name), `Unsupported runtime or handover archive: ${relative}`);
  check(!/^\.env(?:\.|$)/.test(name) || name === '.env.example', `Local environment file: ${relative}`);
}
const report = { root, passed, failures, result: failures.length ? 'FAIL' : 'PASS', scope: 'Static public release only. Browser, backend, authentication, preview build and live-domain tests are still required.' };
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
