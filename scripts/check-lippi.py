#!/usr/bin/env python3
"""Check the integrated public site's navigation and assets before release."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1] / 'lippi'
PAGES = ['index.html', 'training.html', 'regulations.html', 'articles.html']

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.headings, self.meta = [], [], [], {}
        self.path = path
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get('id'): self.ids.append(values['id'])
        if tag in ('a', 'link', 'script', 'img'):
            value = values.get('href') if tag in ('a', 'link') else values.get('src')
            if value: self.links.append(value)
        if tag == 'h1': self.headings.append(tag)
        if tag == 'meta' and values.get('name'):
            self.meta[values['name']] = values.get('content', '')

parsed = {name: Page(ROOT / name) for name in PAGES}
errors = []
for name, page in parsed.items():
    duplicate_ids = [value for value, count in Counter(page.ids).items() if count > 1]
    if duplicate_ids: errors.append(f'{name}: duplicate IDs {duplicate_ids}')
    if len(page.headings) != 1: errors.append(f'{name}: expected one main heading')
    if page.meta.get('lippi-release') != '2026-11-18-integrated': errors.append(f'{name}: missing release marker')
    if not page.meta.get('viewport'): errors.append(f'{name}: missing mobile viewport')
    for target in ['/', '/training.html', '/regulations.html', '/articles.html']:
        if target not in page.links: errors.append(f'{name}: missing navigation {target}')
    for value in page.links:
        url = urlsplit(value)
        if url.scheme or url.netloc: continue
        path = unquote(url.path)
        target = ROOT / (path.lstrip('/') or 'index.html') if path.startswith('/') else page.path.parent / (path or page.path.name)
        target = target.resolve()
        if target.is_dir(): target /= 'index.html'
        if not target.is_relative_to(ROOT): errors.append(f'{name}: link escapes website {value}'); continue
        if not target.exists(): errors.append(f'{name}: missing local target {value}'); continue
        if url.fragment and target.suffix == '.html':
            other = parsed.get(target.name) or Page(target)
            if unquote(url.fragment) not in other.ids: errors.append(f'{name}: missing anchor {value}')
    print(f'{name}: navigation, viewport, headings, IDs and local links checked')

for path in (ROOT / 'assets').glob('*.js'):
    subprocess.run(['node', '--check', str(path)], check=True, capture_output=True)
for path in (ROOT / 'api').rglob('*.js'):
    subprocess.run(['node', '--check', str(path)], check=True, capture_output=True)
json.loads((ROOT / 'vercel.json').read_text())
json.loads((ROOT / 'assets/regulatory-content.json').read_text())
if list(ROOT.rglob('*.php')): errors.append('PHP cannot be deployed with this Vercel configuration')
if (ROOT / 'lippi_training_private').exists(): errors.append('Private training bundle found in public source')
if errors:
    raise SystemExit('\n'.join(errors))
print('PASS: public-site checks and all JavaScript syntax checks')
