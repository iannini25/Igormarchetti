"""Render the Brazilian Portuguese homepage from the shared homepage and translations."""
import json
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

root = Path(__file__).resolve().parents[1] / 'lippi'
home = root / 'index.html'
route = '/brasil/grc-na-europa.html'
english_url = 'https://lippi.igormarchetti.me/'
brazil_url = english_url.rstrip('/') + route
shell = (root / 'assets/site-shell.js').read_text()
def dictionary(name):
    data = re.search(r'  const ' + name + r' = (\{[^\n]+\});', shell)
    return {key: values[0] for key, values in json.loads(data[1]).items()}
words = dictionary('words')
schema_words = {**words, **dictionary('schemaCopy')}

def localized_url(value):
    if not value.startswith('/') or value.startswith('//'):
        return value
    url = urlsplit(value)
    if url.path in ('/', '/index.html'):
        return route + ('#' + url.fragment if url.fragment else '')
    if url.path.endswith('.html') and url.path != route:
        params = parse_qs(url.query)
        params['lang'] = ['pt']
        return urlunsplit(('', '', url.path, urlencode(params, doseq=True), url.fragment))
    return value

def localize_schema(value):
    if isinstance(value, list):
        return [localize_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, entry in value.items():
        if key == 'inLanguage':
            result[key] = 'pt-BR'
        elif key in ('name', 'description', 'serviceType', 'contactType') and isinstance(entry, str):
            result[key] = schema_words.get(entry, entry)
        else:
            result[key] = localize_schema(entry)
    if result.get('@type') == 'WebPage':
        result.update({'@id':brazil_url + '#webpage', 'url':brazil_url})
    return result

class PortugueseHome(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.raw = None

    def handle_decl(self, decl):
        self.output.append('<!' + decl + '>')

    def handle_comment(self, data):
        self.output.append('<!--' + data + '-->')

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'html':
            values['lang'] = 'pt-BR'
        if tag in ('script', 'style'):
            self.raw = values.get('type') or tag
        if tag == 'link' and values.get('rel') == 'canonical':
            values['href'] = brazil_url
        if tag == 'meta' and 'content' in values:
            prop = values.get('property') or values.get('name')
            if prop == 'og:locale':
                values['content'] = 'pt_BR'
            elif prop == 'og:url':
                values['content'] = brazil_url
            else:
                values['content'] = words.get(values['content'], values['content'])
        if tag == 'a' and 'href' in values:
            if values.get('hreflang') == 'pt-BR':
                values.update({'href':'/?lang=en','lang':'en','hreflang':'en'})
            else:
                values['href'] = localized_url(values['href'])
        for key in ('aria-label', 'alt', 'placeholder', 'title'):
            if key in values:
                values[key] = words.get(values[key], values[key])
        attributes = ''.join(' ' + k if v is None else ' '+k+'="'+escape(v,quote=True)+'"' for k,v in values.items())
        self.output.append('<' + tag + attributes + '>')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.raw = None
        self.output.append('</' + tag + '>')

    def handle_data(self, data):
        if self.raw == 'application/ld+json':
            data = json.dumps(localize_schema(json.loads(data)), indent=2, ensure_ascii=False)
        elif not self.raw:
            key = data.strip()
            translation = 'English' if key == 'Português do Brasil' else words.get(key, key)
            data = escape(data.replace(key, translation) if key else data, quote=False)
        self.output.append(data)

page = PortugueseHome()
page.feed(home.read_text())
page.close()
target = root / route.lstrip('/')
target.parent.mkdir(exist_ok=True)
target.write_text(''.join(page.output))
