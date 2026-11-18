import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createNewsletterHandlers, NEWSLETTER_NOTICE_VERSION} from '../api/_lib/newsletter.js';

const origin = 'https://lippi.igormarchetti.me';
const adminKey = 'private-test-key-not-for-production-1234567890';
const validSignup = () => ({email:'reader@example.com', language:'en', consent:true, notice_version:NEWSLETTER_NOTICE_VERSION, website:''});
const fixture = (overrides = {}) => {
  const saved = [];
  const store = {health:async () => {}, save:async signup => {saved.push(signup);}, list:async () => [], ...overrides.store};
  const handlers = createNewsletterHandlers({store, env:{PUBLIC_ORIGIN:origin, SURVEY_ADMIN_KEY:adminKey, VERCEL_URL:'lippi-preview.vercel.app'}, rate:overrides.rate || (() => true)});
  return {handlers, saved};
};
async function call(handler, {method = 'POST', body = validSignup(), headers = {}, parsed = false, raw, url = '/api/newsletter'} = {}) {
  const req = Readable.from(raw === undefined ? [Buffer.from(JSON.stringify(body))] : [Buffer.from(raw)]);
  Object.assign(req, {method, url, headers:{origin, 'content-type':'application/json', ...headers}});
  if (parsed) req.body = body;
  let code, responseHeaders, output;
  const res = {writeHead(status, values) {code = status; responseHeaders = values;}, end(value = '') {output = value;}};
  await handler(req, res);
  return {code, headers:responseHeaders, output, json:responseHeaders['Content-Type'].startsWith('application/json') && output ? JSON.parse(output) : undefined};
}

test('registration succeeds only after a durable save and normalizes the email', async () => {
  let completed = false;
  const {handlers, saved} = fixture({store:{save:async signup => {await Promise.resolve(); saved.push(signup); completed = true;}}});
  const response = await call(handlers.submit, {body:{...validSignup(), email:' Reader@Example.COM '}});
  assert.equal(completed, true);
  assert.equal(response.code, 201);
  assert.deepEqual(response.json, {saved:true, status:'requested'});
  assert.deepEqual(saved, [{email:'reader@example.com', language:'en'}]);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('database failure produces a failure response, never a subscription confirmation', async () => {
  const {handlers} = fixture({store:{save:async () => {throw new Error('database unavailable');}}});
  const response = await call(handlers.submit);
  assert.equal(response.code, 503);
  assert.equal(response.json.saved, false);
  assert.doesNotMatch(response.output, /database unavailable/);
});

test('explicit current consent is required before anything is stored', async () => {
  const {handlers, saved} = fixture();
  for (const fields of [{consent:false}, {consent:'true'}, {consent:undefined}, {notice_version:'2020-01-01'}]) {
    const response = await call(handlers.submit, {body:{...validSignup(), ...fields}});
    assert.equal(response.code, 400);
  }
  assert.equal(saved.length, 0);
});

test('rejects a honeypot, unsupported language, malformed or oversized email', async () => {
  const {handlers, saved} = fixture();
  for (const fields of [{website:'https://spam.example'}, {language:'xx'}, {email:'not-an-email'}, {email:'bad..dots@example.com'}, {email:'a'.repeat(65)+'@example.com'}, {email:'a@'+('b'.repeat(64))+'.com'}, {email:'a\n@example.com'}]) {
    assert.equal((await call(handlers.submit, {body:{...validSignup(), ...fields}})).code, 400);
  }
  assert.equal(saved.length, 0);
});

test('rejects missing or foreign origins; accepts the configured Vercel preview origin', async () => {
  const {handlers, saved} = fixture();
  for (const requestOrigin of [undefined, 'https://attacker.example', origin+'.attacker.example']) {
    assert.equal((await call(handlers.submit, {headers:{origin:requestOrigin}})).code, 403);
  }
  assert.equal(saved.length, 0);
  assert.equal((await call(handlers.submit, {headers:{origin:'https://lippi-preview.vercel.app'}})).code, 201);
});

test('validates method, content type and rate limits before writing', async () => {
  const {handlers, saved} = fixture();
  assert.equal((await call(handlers.submit, {method:'GET'})).code, 405);
  assert.equal((await call(handlers.submit, {headers:{'content-type':'text/plain'}})).code, 415);
  assert.equal((await call(handlers.submit, {headers:{'content-type':'application/json-malformed'}})).code, 415);
  const limited = fixture({rate:() => false});
  const response = await call(limited.handlers.submit);
  assert.equal(response.code, 429);
  assert.equal(response.headers['Retry-After'], '3600');
  assert.equal(saved.length + limited.saved.length, 0);
});

test('enforces body bounds for raw and already parsed Vercel requests', async () => {
  const {handlers, saved} = fixture();
  assert.equal((await call(handlers.submit, {raw:'{bad json'})).code, 400);
  assert.equal((await call(handlers.submit, {raw:' '.repeat(4097)})).code, 413);
  assert.equal((await call(handlers.submit, {parsed:true, body:{...validSignup(), irrelevant:'x'.repeat(4097)}})).code, 413);
  for (const body of [null, [], 'text']) assert.equal((await call(handlers.submit, {body})).code, 400);
  assert.equal(saved.length, 0);
  assert.equal((await call(handlers.submit, {parsed:true})).code, 201);
});

test('health checks actual storage availability and HEAD responses contain no body', async () => {
  let checks = 0;
  const {handlers} = fixture({store:{health:async () => {checks++;}}});
  const response = await call(handlers.health, {method:'GET'});
  assert.equal(response.code, 200);
  assert.equal(response.json.ready, true);
  assert.equal(checks, 1);
  assert.equal((await call(handlers.health, {method:'HEAD'})).output, '');
  const failing = fixture({store:{health:async () => {throw new Error('unavailable');}}});
  assert.deepEqual((await call(failing.handlers.health, {method:'GET'})).json, {ready:false});
});

test('admin exports require the existing private key and never query data for an unauthorized caller', async () => {
  let reads = 0;
  const {handlers} = fixture({store:{list:async () => {reads++; return [];}}});
  for (const authorization of [undefined, 'Bearer wrong', 'Basic '+adminKey]) {
    assert.equal((await call(handlers.admin, {method:'GET', headers:{authorization}})).code, 401);
  }
  assert.equal(reads, 0);
  assert.equal((await call(handlers.admin, {method:'GET', headers:{authorization:'Bearer '+adminKey}})).code, 200);
  assert.equal(reads, 1);
});

test('admin export retains consent evidence and CSV guards spreadsheet formula injection', async () => {
  const row = {email:'=evil@example.com', language:'en', requested_at:'2026-11-18T12:00:00Z', consent_recorded_at:'2026-11-18T12:00:00Z', notice_version:NEWSLETTER_NOTICE_VERSION, consent_text:'Agreed', status:'requested'};
  const {handlers} = fixture({store:{list:async () => [row]}});
  const options = {method:'GET', headers:{authorization:'Bearer '+adminKey}};
  const json = await call(handlers.admin, options);
  assert.equal(json.json.count, 1);
  assert.equal(json.json.signups[0].consent_text, 'Agreed');
  const csv = await call(handlers.admin, {...options, url:'/api/newsletter/admin?format=csv'});
  assert.equal(csv.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.ok(csv.output.includes('"\'=evil@example.com"'));
  assert.equal(csv.headers['Cache-Control'], 'no-store');
  assert.equal((await call(handlers.admin, {...options, url:'/api/newsletter/admin?format=html'})).code, 400);
});
