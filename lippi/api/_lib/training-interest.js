import {createHash, timingSafeEqual} from 'node:crypto';

export const SURVEY_VERSION = 'training-v1';
export const NOTICE_VERSION = '2026-11-17';
const TABLE = 'public.lippi_training_interest';
const MAX_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKETS = new Set(['brazil', 'ireland', 'portugal', 'uk', 'unsure']);
const OPTIONS = {
  priority: new Set(['licensing', 'grc', 'regulation', 'tools', 'all']),
  budget: new Set(['under100', '100_199', '200_299', '300_499', '500plus', 'no_budget', 'unsure', 'not_interested']),
  format: new Set(['online', 'hybrid', 'in_person', 'unsure']),
  language: new Set(['english', 'portuguese', 'unsure'])
};
const OPTIONAL = {business_model: 100, home_market: 100, comment: 1000, referral: 80};
const ALLOWED = new Set(['submission_id', 'survey_version', 'notice_version', 'target_markets', ...Object.keys(OPTIONS), ...Object.keys(OPTIONAL), 'contact_opt_in', 'email', 'website']);
const COLUMNS = ['id', 'created_at', 'survey_version', 'notice_version', 'target_markets', ...Object.keys(OPTIONS), ...Object.keys(OPTIONAL), 'contact_opt_in', 'email'];
const digest = value => createHash('sha256').update(value).digest();
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const csvCell = value => {
  let cell = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/^\s*[=+@-]/.test(cell)) cell = "'" + cell;
  return '"' + cell.replaceAll('"', '""') + '"';
};
const response = (res, status, data, extra = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extra
  });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
};
class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateSubmission(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new RequestError(400, 'Invalid submission.');
  if (Object.keys(data).some(key => !ALLOWED.has(key))) throw new RequestError(400, 'Unexpected submission field. Please refresh the page.');
  if (data.website !== undefined && (typeof data.website !== 'string' || data.website.trim())) throw new RequestError(400, 'The submission could not be accepted.');
  if (data.survey_version !== SURVEY_VERSION || data.notice_version !== NOTICE_VERSION) throw new RequestError(400, 'Please refresh the page before submitting.');
  if (typeof data.submission_id !== 'string' || !UUID.test(data.submission_id)) throw new RequestError(400, 'Invalid submission reference. Please refresh and try again.');
  if (!Array.isArray(data.target_markets) || data.target_markets.length < 1 || data.target_markets.length > MARKETS.size || data.target_markets.some(market => !MARKETS.has(market))) throw new RequestError(400, 'Choose at least one listed target market.');
  const payload = {target_markets: [...new Set(data.target_markets)].sort()};
  for (const [field, options] of Object.entries(OPTIONS)) {
    if (!options.has(data[field])) throw new RequestError(400, 'Choose a listed option for ' + field.replaceAll('_', ' ') + '.');
    payload[field] = data[field];
  }
  for (const [field, max] of Object.entries(OPTIONAL)) {
    const value = data[field] ?? '';
    if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new RequestError(400, 'Please keep ' + field.replaceAll('_', ' ') + ' within ' + max + ' characters.');
    payload[field] = value.trim();
  }
  if (typeof data.contact_opt_in !== 'boolean') throw new RequestError(400, 'Choose whether you would like a reply.');
  payload.contact_opt_in = data.contact_opt_in;
  if (data.email !== undefined && (typeof data.email !== 'string' || data.email.length > 254)) throw new RequestError(400, 'Please use an email address of at most 254 characters.');
  if (data.contact_opt_in) {
    const email = (data.email || '').trim();
    if (!/^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(email)) throw new RequestError(400, 'Enter a valid email address to request a reply.');
    payload.email = email;
  }
  // Unrequested contact details are never copied to the stored payload.
  return {id: data.submission_id.toLowerCase(), payload};
}

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new RequestError(413, 'Your submission is too long.');
  let raw;
  // Vercel can provide a parsed body. Also support native Node request streams.
  if (req.body !== undefined) {
    raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (raw.byteLength > MAX_BYTES) throw new RequestError(413, 'Your submission is too long.');
  } else {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > MAX_BYTES) throw new RequestError(413, 'Your submission is too long.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks);
  }
  try { return JSON.parse(raw.toString('utf8')); }
  catch { throw new RequestError(400, 'The submission could not be read.'); }
}

export function createTrainingService({query, transaction, env = process.env, takeRate = () => true}) {
  if (typeof query !== 'function') throw new Error('A database query function is required.');
  if (typeof transaction !== 'function') throw new Error('A dedicated database transaction function is required.');
  let schemaPromise;
  const acceptedOrigins = () => {
    const origins = new Set();
    try {
      const url = new URL(env.PUBLIC_ORIGIN);
      if (['https:', 'http:'].includes(url.protocol)) origins.add(url.origin);
    } catch { /* Invalid configuration does not permit an origin. */ }
    if (env.VERCEL_URL) {
      try {
        const url = new URL(`https://${env.VERCEL_URL}`);
        // Only this deployment's exact HTTPS host is trusted; no suffix matching.
        if (url.host === env.VERCEL_URL && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password) origins.add(url.origin);
      } catch { /* Invalid deployment hosts remain blocked. */ }
    }
    return origins;
  };
  const configured = () => Boolean(acceptedOrigins().size && (env.SURVEY_DATABASE_URL || env.DATABASE_URL) && (env.SURVEY_ADMIN_KEY || '').length >= 32);
  const prepare = async () => {
    schemaPromise ??= transaction(async schemaQuery => {
      // The transaction holds one connection and serializes DDL across cold instances.
      await schemaQuery('SELECT pg_advisory_xact_lock($1)', [181126012]);
      await schemaQuery(`CREATE TABLE IF NOT EXISTS ${TABLE} (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        survey_version TEXT NOT NULL DEFAULT 'training-v1',
        notice_version TEXT NOT NULL DEFAULT '2026-11-17',
        payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object')
      )`);
      await schemaQuery(`CREATE INDEX IF NOT EXISTS lippi_training_interest_created_at_idx ON ${TABLE} (created_at)`);
    }).catch(error => { schemaPromise = undefined; throw error; });
    await schemaPromise;
  };
  const purge = () => query(`DELETE FROM ${TABLE} WHERE created_at < now() - interval '90 days'`);
  const ready = async () => {
    if (!configured()) throw new Error('Training configuration unavailable.');
    await prepare();
    await purge();
  };
  const guard = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) {
      // Do not log bodies, emails, database URLs or database error details.
      if (!res.headersSent) response(res, error instanceof RequestError ? error.status : 503, {
        error: error instanceof RequestError ? error.message : 'Training interest is temporarily unavailable. Please try again later.'
      });
      else res.end();
    }
  };

  const submit = guard(async (req, res) => {
    if (req.method !== 'POST') return response(res, 405, {error: 'Method not allowed.'}, {Allow: 'POST'});
    const origins = acceptedOrigins();
    if (!origins.size) throw new Error('Site configuration unavailable.');
    if (!origins.has(req.headers.origin)) return response(res, 403, {error: 'Please submit this form from the Lippi website.'});
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return response(res, 415, {error: 'JSON content is required.'});
    if (!takeRate(req, 'training-interest-submit', 60)) return response(res, 429, {error: 'Too many submissions. Please try again later.'}, {'Retry-After': '3600'});
    const {id, payload} = validateSubmission(await readBody(req));
    await ready();
    const inserted = await query(`INSERT INTO ${TABLE} (id,survey_version,notice_version,payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`, [id, SURVEY_VERSION, NOTICE_VERSION, JSON.stringify(payload)]);
    if (inserted.rowCount) return response(res, 201, {saved: true, id});
    const existing = (await query(`SELECT survey_version,notice_version,payload FROM ${TABLE} WHERE id=$1`, [id])).rows[0];
    if (!existing || existing.survey_version !== SURVEY_VERSION || existing.notice_version !== NOTICE_VERSION || canonical(existing.payload) !== canonical(payload)) return response(res, 409, {error: 'This reference was already used for different answers. Refresh the page to send a new response.'});
    return response(res, 200, {saved: true, id});
  });

  const health = async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return response(res, 405, {error: 'Method not allowed.'}, {Allow: 'GET, HEAD'});
    try {
      await ready();
      // This query executes on every health request, including a warm instance.
      await query(`SELECT id FROM ${TABLE} LIMIT 0`);
      return response(res, 200, req.method === 'HEAD' ? '' : {ready: true, survey_version: SURVEY_VERSION, notice_version: NOTICE_VERSION});
    } catch {
      return response(res, 503, req.method === 'HEAD' ? '' : {ready: false, survey_version: SURVEY_VERSION});
    }
  };

  const admin = guard(async (req, res) => {
    const expected = env.SURVEY_ADMIN_KEY || '';
    const authorization = String(req.headers.authorization || '');
    if (expected.length < 32 || !authorization.startsWith('Bearer ') || !timingSafeEqual(digest(authorization.slice(7)), digest(expected))) {
      if (!takeRate(req, 'training-interest-admin', 30)) return response(res, 429, {error: 'Too many access attempts. Please try again later.'});
      return response(res, 401, {error: 'A valid private access key is required.'});
    }
    if (req.method !== 'GET') return response(res, 405, {error: 'Method not allowed.'}, {Allow: 'GET'});
    const path = new URL(req.url, 'http://localhost').searchParams.get('path') || 'responses';
    if (!['responses', 'export.json', 'export.csv'].includes(path)) return response(res, 404, {error: 'Not found.'});
    await ready();
    const rows = (await query(`SELECT id,created_at,survey_version,notice_version,payload FROM ${TABLE} WHERE created_at >= now() - interval '90 days' ORDER BY created_at DESC`)).rows.map(row => ({
      id: row.id, created_at: new Date(row.created_at).toISOString(), survey_version: row.survey_version, notice_version: row.notice_version, ...row.payload
    }));
    if (path === 'export.csv') return response(res, 200, '\uFEFF' + [COLUMNS, ...rows.map(row => COLUMNS.map(field => row[field]))].map(row => row.map(csvCell).join(',')).join('\r\n'), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lippi-training-interest.csv"'
    });
    const result = {survey_version: SURVEY_VERSION, budget_basis: 'EUR per attendee for all four two-hour online workshops over four weeks', count: rows.length, responses: rows};
    return response(res, 200, result, path === 'export.json' ? {'Content-Disposition': 'attachment; filename="lippi-training-interest.json"'} : {});
  });

  return {submit, health, admin};
}
