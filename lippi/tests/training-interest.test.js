import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFileSync} from 'node:fs';
import {createTrainingService} from '../api/_lib/training-interest.js';
import {createTrainingDatabase} from '../api/_lib/training-database.js';
import {buildTrainingEmail} from '../assets/training.js';

const env = {PUBLIC_ORIGIN: 'https://lippi.igormarchetti.me', SURVEY_DATABASE_URL: 'postgresql://test', SURVEY_ADMIN_KEY: 'test-owner-key-'.repeat(4)};
const valid = () => ({
  submission_id: '98765432-4321-4234-8123-123456789abc', survey_version: 'training-v1', notice_version: '2026-11-17',
  target_markets: ['brazil', 'ireland'], priority: 'all', budget: '200_299', format: 'online', language: 'english', contact_opt_in: false, website: ''
});
function database({exists = true} = {}) {
  const rows = new Map(), calls = [];
  let available = true;
  const db = {
    rows, calls,
    fail: () => { available = false; },
    query: async (sql, params = []) => {
      calls.push({sql, params});
      if (!available) throw new Error('database unavailable with private details');
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) return {rows: [], rowCount: 1};
      if (sql.startsWith('CREATE ')) { if (sql.startsWith('CREATE TABLE')) exists = true; return {rows: [], rowCount: 0}; }
      if (sql.startsWith('DELETE ')) {
        for (const [id, row] of rows) if (new Date(row.created_at) < Date.now() - 90 * 86400000) rows.delete(id);
        return {rows: [], rowCount: 0};
      }
      if (sql.startsWith('INSERT ')) {
        const [id, survey_version, notice_version, payload] = params;
        if (rows.has(id)) return {rows: [], rowCount: 0};
        rows.set(id, {id, created_at: new Date().toISOString(), survey_version, notice_version, payload: JSON.parse(payload)});
        return {rows: [{id}], rowCount: 1};
      }
      if (sql.includes('LIMIT 0')) {
        if (!exists) throw Object.assign(new Error('table not provisioned'), {code: '42P01'});
        return {rows: [], rowCount: 0};
      }
      if (sql.includes('WHERE id=$1')) return {rows: rows.has(params[0]) ? [rows.get(params[0])] : []};
      if (sql.includes('ORDER BY created_at DESC')) return {rows: [...rows.values()]};
      throw new Error('Unexpected query: ' + sql);
    }
  };
  db.transaction = work => work(db.query);
  return db;
}
function request(body, options = {}) {
  const req = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}))]);
  Object.assign(req, {method: 'POST', url: '/api/training-interest', headers: {'content-type': 'application/json', origin: env.PUBLIC_ORIGIN}, ...options});
  return req;
}
async function call(handler, req) {
  const result = {headersSent: false};
  const res = {
    get headersSent() { return result.headersSent; },
    writeHead(status, headers) { Object.assign(result, {status, headers, headersSent: true}); },
    end(body = '') { result.body = body; try { result.json = JSON.parse(body); } catch {} }
  };
  await handler(req, res); return result;
}
function fixture(overrides = {}) { const db = database(); return {db, service: createTrainingService({query: db.query, transaction: db.transaction, env, ...overrides})}; }

test('stores only approved fields, strips email without opt-in, and uses parameterized SQL', async () => {
  const {db, service} = fixture();
  const body = {...valid(), email: 'do-not-store@example.com', comment: "Test '); DROP TABLE responses; --"};
  const response = await call(service.submit, request(body));
  assert.equal(response.status, 201); assert.equal(response.json.saved, true);
  const saved = db.rows.get(body.submission_id);
  assert.equal(saved.payload.email, undefined);
  assert.equal(saved.payload.comment, body.comment);
  const insert = db.calls.find(call => call.sql.startsWith('INSERT '));
  assert.equal(insert.sql.includes(body.comment), false);
  assert.equal(JSON.parse(insert.params[3]).comment, body.comment);
});

test('retries are idempotent, reordered markets are equivalent, changed answers conflict', async () => {
  const {db, service} = fixture(); const body = valid();
  assert.equal((await call(service.submit, request(body))).status, 201);
  assert.equal((await call(service.submit, request({...body, target_markets: [...body.target_markets].reverse()}))).status, 200);
  assert.equal((await call(service.submit, request({...body, budget: 'no_budget'}))).status, 409);
  assert.equal(db.rows.size, 1);
});

test('rejects cross-origin, wrong versions, malformed required choices, invalid consent and email before DB access', async () => {
  const {db, service} = fixture();
  const cases = [
    [{...valid()}, {headers: {'content-type': 'application/json', origin: 'https://other.example'}}, 403],
    [{...valid(), notice_version: 'old'}, {}, 400], [{...valid(), priority: 'unknown'}, {}, 400],
    [{...valid(), target_markets: []}, {}, 400], [{...valid(), contact_opt_in: 'true'}, {}, 400],
    [{...valid(), contact_opt_in: true, email: 'invalid'}, {}, 400], [{...valid(), website: 'spam'}, {}, 400],
    [{...valid(), comment: 'a'.repeat(1001)}, {}, 400], [{...valid(), secret_extra: 'x'}, {}, 400]
  ];
  for (const [body, options, status] of cases) assert.equal((await call(service.submit, request(body, options))).status, status);
  assert.equal(db.calls.length, 0);
});

test('enforces 16 KiB body limit for native streams and parsed Vercel bodies', async () => {
  const {db, service} = fixture(); const body = {...valid(), comment: 'x'.repeat(17000)};
  assert.equal((await call(service.submit, request(body))).status, 413);
  assert.equal((await call(service.submit, request(null, {body}))).status, 413);
  assert.equal(db.calls.length, 0);
});

test('health proves database access on every request and fails closed without leaking errors', async () => {
  const {db, service} = fixture();
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).json.ready, true);
  db.fail();
  const response = await call(service.health, request(null, {method: 'GET'}));
  assert.equal(response.status, 503); assert.equal(response.json.ready, false);
  assert.equal(response.body.includes('private details'), false);
});

test('private admin denies missing/wrong keys before DB queries and expires old responses', async () => {
  const {db, service} = fixture();
  assert.equal((await call(service.admin, request(null, {method: 'GET', headers: {}}))).status, 401);
  assert.equal((await call(service.admin, request(null, {method: 'GET', headers: {authorization: 'Bearer wrong'}}))).status, 401);
  assert.equal(db.calls.length, 0);
  await call(service.submit, request({...valid(), contact_opt_in: true, email: 'reply@example.com'}));
  db.rows.set('old', {id: 'old', created_at: new Date(Date.now() - 91 * 86400000).toISOString(), survey_version: 'training-v1', notice_version: '2026-11-17', payload: {}});
  const response = await call(service.admin, request(null, {method: 'GET', headers: {authorization: 'Bearer ' + env.SURVEY_ADMIN_KEY}}));
  assert.equal(response.status, 200); assert.equal(response.json.count, 1);
  assert.equal(response.json.responses[0].email, 'reply@example.com'); assert.equal(db.rows.has('old'), false);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('CSV protects spreadsheet formulas and exports require private authentication', async () => {
  const {service} = fixture(); await call(service.submit, request({...valid(), comment: '=HYPERLINK("bad")'}));
  const options = {method: 'GET', url: '/api/training-interest/admin?path=export.csv', headers: {authorization: 'Bearer ' + env.SURVEY_ADMIN_KEY}};
  const response = await call(service.admin, request(null, options));
  assert.equal(response.status, 200); assert.match(response.headers['Content-Type'], /^text\/csv/);
  assert.equal(response.body.includes("'=HYPERLINK"), true);
});

test('every workshop choice presented in the public form is accepted by the backend', async () => {
  const html = readFileSync(new URL('../training.html', import.meta.url), 'utf8');
  const choices = html.match(/<select id="training-priority"[\s\S]*?<\/select>/)[0];
  const values = [...choices.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(values, ['licensing', 'grc', 'regulation', 'tools', 'all']);
  for (const priority of values) {
    const {service} = fixture();
    assert.equal((await call(service.submit, request({...valid(), priority}))).status, 201, priority);
  }
});

test('admin exports keep the four-session budget basis and fourth workshop choice', async () => {
  const {service} = fixture();
  await call(service.submit, request({...valid(), priority: 'tools'}));
  const response = await call(service.admin, request(null, {method: 'GET', url: '/api/training-interest/admin?path=export.json', headers: {authorization: 'Bearer ' + env.SURVEY_ADMIN_KEY}}));
  assert.equal(response.json.responses[0].priority, 'tools');
  assert.equal(response.json.budget_basis, 'EUR per attendee for all four two-hour online workshops over four weeks');
});

test('training database reuses existing survey URL candidates and closes failed connections', async () => {
  const opened = [], closed = [];
  class Pool {
    constructor(config) { this.url = config.connectionString; opened.push(this.url); }
    async query(sql, params) {
      if (this.url === 'postgresql://unavailable') throw new Error('private connection details');
      return {rows: [{sql, params}]};
    }
    async end() { closed.push(this.url); }
  }
  const db = createTrainingDatabase({env: {SURVEY_DATABASE_URL: 'postgresql://unavailable postgresql://working', DATABASE_URL: 'postgresql://unused'}, Pool});
  const result = await db.query('SELECT $1', ['example']);
  await db.query('SELECT $1', ['second']);
  assert.deepEqual(opened, ['postgresql://unavailable', 'postgresql://working']);
  assert.deepEqual(closed, ['postgresql://unavailable']);
  assert.deepEqual(result.rows, [{sql: 'SELECT $1', params: ['example']}]);
});

test('DATABASE_URL fallback works without a survey-specific URL and retries failed initialization', async () => {
  let available = false, attempts = 0;
  class Pool {
    constructor(config) { assert.equal(config.connectionString, 'postgresql://fallback'); attempts++; }
    async query() { if (!available) throw new Error('private details'); return {rows: []}; }
    async end() {}
  }
  const db = createTrainingDatabase({env: {DATABASE_URL: 'postgresql://fallback'}, Pool});
  await assert.rejects(db.query('SELECT 1'), /Training database is temporarily unavailable\./);
  available = true;
  await db.query('SELECT 1');
  assert.equal(attempts, 2);
  const fake = database();
  const service = createTrainingService({query: fake.query, transaction: fake.transaction, env: {...env, SURVEY_DATABASE_URL: '', DATABASE_URL: 'postgresql://fallback'}});
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).status, 200);
});

test('all Vercel training entry points load without changing founder-survey exports', async () => {
  const [{default: submit}, {default: health}, {default: admin}] = await Promise.all([
    import('../api/training-interest.js'), import('../api/training-interest/health.js'), import('../api/training-interest/admin.js')
  ]);
  assert.equal(typeof submit, 'function');
  assert.equal(typeof health, 'function');
  assert.equal(typeof admin, 'function');
  assert.equal((await call(admin, request(null, {method: 'GET', headers: {}}))).status, 401);
});

test('accepts the exact HTTPS deployment origin and production origin, rejecting lookalikes before storage', async () => {
  const config = {...env, VERCEL_URL: 'lippi-preview.vercel.app'};
  for (const origin of [env.PUBLIC_ORIGIN, 'https://lippi-preview.vercel.app']) {
    const {service} = fixture({env: config});
    assert.equal((await call(service.submit, request(valid(), {headers: {'content-type': 'application/json', origin}}))).status, 201, origin);
  }
  const {service, db} = fixture({env: config});
  for (const origin of ['http://lippi-preview.vercel.app', 'https://other-preview.vercel.app', 'https://lippi-preview.vercel.app.evil.example', 'https://lippi-preview.vercel.app:444', 'null', undefined]) {
    assert.equal((await call(service.submit, request(valid(), {headers: {'content-type': 'application/json', origin}}))).status, 403, String(origin));
  }
  assert.equal(db.calls.length, 0);
  for (const VERCEL_URL of ['lippi-preview.vercel.app/extra', 'trusted@evil.example', 'https://lippi-preview.vercel.app']) {
    const {service, db} = fixture({env: {...env, VERCEL_URL}});
    assert.equal((await call(service.submit, request(valid(), {headers: {'content-type': 'application/json', origin: 'https://evil.example'}}))).status, 403);
    assert.equal(db.calls.length, 0);
  }
});

test('database transactions use one checked-out connection and release it after commit or rollback', async () => {
  const events = [];
  let clientId = 0;
  class Pool {
    async query(sql) { assert.equal(sql, 'SELECT 1', 'transaction work must not use the pool query shortcut'); return {rows: []}; }
    async connect() {
      const id = ++clientId;
      return {
        query: async sql => { events.push([id, sql]); return {rows: []}; },
        release: () => events.push([id, 'release'])
      };
    }
  }
  const db = createTrainingDatabase({env, Pool});
  await db.transaction(async query => { await query('schema work'); });
  await assert.rejects(db.transaction(async query => { await query('failed schema work'); throw new Error('failure'); }), /failure/);
  assert.deepEqual(events, [
    [1, 'BEGIN'], [1, 'schema work'], [1, 'COMMIT'], [1, 'release'],
    [2, 'BEGIN'], [2, 'failed schema work'], [2, 'ROLLBACK'], [2, 'release']
  ]);
});

test('concurrent cold instances serialize schema creation with a transaction lock; each instance initializes once', async () => {
  let locked = false, exists = false, activeDdl = 0, maxActiveDdl = 0, tableCreates = 0, indexCreates = 0, releasedClients = 0;
  const waiters = [];
  class Pool {
    async query(sql) {
      assert.ok(sql === 'SELECT 1' || sql.startsWith('DELETE ') || sql.includes('LIMIT 0'), 'DDL must use its dedicated transaction connection');
      if (sql.includes('LIMIT 0') && !exists) throw Object.assign(new Error('table not provisioned'), {code: '42P01'});
      return {rows: [], rowCount: 0};
    }
    async connect() {
      let inTransaction = false, holdsLock = false;
      return {
        query: async (sql, params) => {
          if (sql === 'BEGIN') { inTransaction = true; return {rows: []}; }
          if (sql.startsWith('SELECT pg_advisory_xact_lock')) {
            assert.equal(inTransaction, true);
            assert.deepEqual(params, [181126012]);
            if (locked) await new Promise(resolve => waiters.push(resolve));
            else locked = true;
            holdsLock = true;
            return {rows: []};
          }
          if (sql.startsWith('CREATE ')) {
            assert.equal(inTransaction && holdsLock, true, 'schema mutation requires a transaction-scoped advisory lock');
            activeDdl++;
            maxActiveDdl = Math.max(maxActiveDdl, activeDdl);
            if (sql.startsWith('CREATE TABLE')) tableCreates++;
            else if (sql.startsWith('CREATE INDEX')) indexCreates++;
            await new Promise(resolve => setImmediate(resolve));
            activeDdl--;
            return {rows: []};
          }
          if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql === 'COMMIT') exists = true;
            if (holdsLock) { holdsLock = false; if (waiters.length) waiters.shift()(); else locked = false; }
            inTransaction = false;
            return {rows: []};
          }
          throw new Error('Unexpected transaction query');
        },
        release: () => { assert.equal(inTransaction, false); releasedClients++; }
      };
    }
  }
  const firstDb = createTrainingDatabase({env, Pool}), secondDb = createTrainingDatabase({env, Pool});
  const first = createTrainingService({...firstDb, env}), second = createTrainingService({...secondDb, env});
  const results = await Promise.all([first, first, second, second].map(service => call(service.health, request(null, {method: 'GET'}))));
  assert.deepEqual(results.map(result => result.status), [200, 200, 200, 200]);
  assert.equal(maxActiveDdl, 1);
  assert.equal(tableCreates, 2);
  assert.equal(indexCreates, 2);
  assert.equal(releasedClients, 2);
  assert.equal(locked, false);
});

test('schema preparation can retry after a failed transaction', async () => {
  const db = database({exists: false});
  let attempts = 0;
  const service = createTrainingService({query: db.query, env, transaction: async work => {
    attempts++;
    if (attempts === 1) throw new Error('transient schema failure');
    return db.transaction(work);
  }});
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).status, 503);
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).status, 200);
  assert.equal(attempts, 2);
});

test('owner-provisioned tables work for a runtime role without CREATE privileges', async () => {
  const db = database();
  let transactionAttempts = 0;
  const service = createTrainingService({query: db.query, env, transaction: async () => {
    transactionAttempts++;
    throw Object.assign(new Error('CREATE permission denied'), {code: '42501'});
  }});
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).status, 200);
  assert.equal((await call(service.submit, request(valid()))).status, 201);
  assert.equal(transactionAttempts, 0);
  assert.equal(db.calls[0].sql, 'SELECT id,created_at,survey_version,notice_version,payload FROM public.lippi_training_interest LIMIT 0');
  assert.equal(db.calls.some(({sql}) => sql.startsWith('CREATE ')), false);
});

test('schema probing only attempts DDL for undefined_table, never permission, column or connection failures', async () => {
  for (const code of ['42501', '42703', 'ECONNRESET', undefined]) {
    let transactionAttempts = 0;
    const service = createTrainingService({env, query: async () => { throw Object.assign(new Error('private details'), {code}); }, transaction: async () => { transactionAttempts++; }});
    const response = await call(service.health, request(null, {method: 'GET'}));
    assert.equal(response.status, 503);
    assert.equal(transactionAttempts, 0);
    assert.equal(response.body.includes('private details'), false);
  }
  const db = database({exists: false});
  let transactionAttempts = 0;
  const service = createTrainingService({env, query: db.query, transaction: async work => { transactionAttempts++; return db.transaction(work); }});
  assert.equal((await call(service.health, request(null, {method: 'GET'}))).status, 200);
  assert.equal(transactionAttempts, 1);
  assert.equal(db.calls.filter(({sql}) => sql.startsWith('CREATE ')).length, 2);
});

test('email enquiries retain all answers with a fixed destination and encoded body, without implying a saved response', () => {
  const payload = {...valid(), priority: 'tools', home_market: 'Ireland', business_model: 'Payments & e-money', comment: 'Licensing?\nPlease compare Brazil & Ireland.', referral: 'Dublin event', email: 'omit-me@example.com'};
  const draft = buildTrainingEmail(payload);
  const url = new URL(draft.mailto);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'lippi@igormarchetti.me');
  assert.equal(url.searchParams.get('subject'), 'Lippi paid training pilot enquiry');
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  assert.equal(url.searchParams.get('body'), draft.body);
  for (const answer of ['Brazil, Ireland', 'RegTech, cybersecurity and AI tools', 'EUR 200–299', 'Live online', 'English', 'Ireland', 'Payments & e-money', payload.comment, 'Dublin event', 'Contact me about pilot dates, format and pricing: No']) assert.ok(draft.body.includes(answer), answer);
  assert.equal(draft.body.includes('omit-me@example.com'), false);
  assert.equal(/answers have been saved|response received/i.test(draft.body), false);
  const optedIn = buildTrainingEmail({...payload, contact_opt_in: true, email: 'reply@example.com'});
  assert.ok(optedIn.body.includes('Preferred contact email: reply@example.com'));
  assert.ok(optedIn.body.includes('Contact me about pilot dates, format and pricing: Yes'));
});

test('unavailable survey enables a validated email draft without submitting, opening or claiming success', async () => {
  const savedGlobals = {document: globalThis.document, fetch: globalThis.fetch, FormData: globalThis.FormData};
  const events = new Map(), calls = [];
  const element = (properties = {}) => ({hidden: false, disabled: false, value: '', textContent: '', addEventListener() {}, classList: {toggle() {}}, ...properties});
  const button = element({disabled: true}), status = element(), optIn = element({checked: false}), email = element(), contact = element({hidden: true});
  const draftPanel = element({hidden: true}), draftText = element(), success = element({hidden: true});
  let focused = false, clicked = false;
  const draftLink = element({focus() { focused = true; }, click() { clicked = true; }, removeAttribute(name) { delete this[name]; }});
  const market = element({checked: true, setCustomValidity() {}});
  const values = {...valid(), home_market: 'Ireland', business_model: 'Payments', comment: 'Help compare markets', referral: ''};
  let validForm = false;
  const form = element({
    addEventListener(name, handler) { events.set(name, handler); },
    querySelector() { return button; },
    querySelectorAll(selector) { return selector.includes('target_markets') ? [market] : []; },
    reportValidity() { return validForm; }
  });
  const nodes = {'training-interest-form': form, 'training-status': status, 'contact-opt-in': optIn, 'training-email': email, 'contact-details': contact, 'training-email-fallback': draftPanel, 'training-email-link': draftLink, 'training-email-text': draftText, 'training-success': success};
  try {
    globalThis.document = {getElementById(id) { return nodes[id] || null; }};
    globalThis.fetch = async url => { calls.push(url); return {ok: false, status: 503, json: async () => ({ready: false})}; };
    globalThis.FormData = class { get(name) { return values[name] ?? ''; } getAll(name) { return values[name] || []; } };
    await import('../assets/training.js?email-fallback-test');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Prepare email enquiry');
    await events.get('submit')({preventDefault() {}});
    assert.equal(draftPanel.hidden, true, 'invalid form must not prepare a draft');
    validForm = true;
    await events.get('submit')({preventDefault() {}});
    assert.equal(draftPanel.hidden, false);
    assert.equal(new URL(draftLink.href).pathname, 'lippi@igormarchetti.me');
    assert.ok(draftText.value.includes('Help compare markets'));
    assert.equal(success.hidden, true);
    assert.equal(form.hidden, false);
    assert.equal(focused, true);
    assert.equal(clicked, false);
    assert.deepEqual(calls, ['/api/training-interest/health']);
    assert.ok(status.textContent.includes('Nothing has been sent by this page.'));
    events.get('input')();
    assert.equal(draftPanel.hidden, true, 'editing answers invalidates the old email draft');
    assert.equal(draftLink.href, undefined);
  } finally {
    for (const [key, value] of Object.entries(savedGlobals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
  const html = readFileSync(new URL('../training.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="\/assets\/training\.js" type="module"><\/script>/);
  assert.ok(html.includes('press Send yourself'));
});
