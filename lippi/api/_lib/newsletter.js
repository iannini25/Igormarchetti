import pg from 'pg';
import {createHash, timingSafeEqual} from 'node:crypto';
import {reply, takeRate, csvCell} from './survey.js';

export const NEWSLETTER_NOTICE_VERSION = '2026-11-18';
export const NEWSLETTER_CONSENT = 'I agree to receive Lippi articles and regulatory updates by email. I can withdraw my consent at any time by emailing lippifintech@igormarchetti.me.';
const TABLE = 'public.lippi_newsletter_signups';
const MAX_BODY_BYTES = 4096;
const MAX_EXPORT_ROWS = 5000;
let poolPromise;
let schemaPromise;

async function openPool() {
  const urls = String(process.env.SURVEY_DATABASE_URL || process.env.DATABASE_URL || '').split(/\s+/).filter(Boolean);
  if (!urls.length) throw new Error('Newsletter storage is not configured');
  let failure;
  for (const connectionString of urls) {
    const candidate = new pg.Pool({connectionString, ssl:{rejectUnauthorized:false}, max:2, idleTimeoutMillis:10000, connectionTimeoutMillis:6000});
    try {
      await candidate.query('SELECT 1');
      return candidate;
    } catch (error) {
      failure = error;
      await candidate.end().catch(() => {});
    }
  }
  throw failure;
}

const getPool = () => (poolPromise ??= openPool().catch(error => { poolPromise = undefined; throw error; }));

async function initializeStorage() {
  const pool = await getPool();
  // A dedicated transaction serializes first-run schema creation across instances.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [181126011]);
    await client.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      email text PRIMARY KEY CHECK (char_length(email) <= 254),
      language varchar(2) NOT NULL CHECK (language IN ('en','pt','es')),
      requested_at timestamptz NOT NULL DEFAULT now(),
      consent_recorded_at timestamptz NOT NULL DEFAULT now(),
      notice_version text NOT NULL,
      consent_text text NOT NULL,
      status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','unsubscribed'))
    )`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return pool;
}

const storage = () => (schemaPromise ??= initializeStorage().catch(error => { schemaPromise = undefined; throw error; }));

const newsletterStore = {
  async health() {
    const pool = await storage();
    await pool.query(`SELECT email FROM ${TABLE} LIMIT 0`);
  },
  async save(signup) {
    const pool = await storage();
    await pool.query(`INSERT INTO ${TABLE} (email, language, notice_version, consent_text)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        language = EXCLUDED.language,
        consent_recorded_at = now(),
        notice_version = EXCLUDED.notice_version,
        consent_text = EXCLUDED.consent_text,
        status = 'requested'`,
    [signup.email, signup.language, NEWSLETTER_NOTICE_VERSION, NEWSLETTER_CONSENT]);
  },
  async list() {
    const pool = await storage();
    return (await pool.query(`SELECT email, language, requested_at, consent_recorded_at, notice_version, consent_text, status
      FROM ${TABLE} WHERE status = 'requested' ORDER BY requested_at DESC LIMIT $1`, [MAX_EXPORT_ROWS + 1])).rows;
  }
};

function acceptedOrigins(env) {
  const origins = new Set();
  for (const value of [env.PUBLIC_ORIGIN, env.VERCEL_URL && `https://${env.VERCEL_URL}`]) {
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch { /* Invalid configuration does not permit an origin. */ }
  }
  return origins;
}

export function validEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (email.length > 254 || email.length < 5) return false;
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0].length > 64 || parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email);
}

async function readJson(req) {
  let raw;
  if (req.body !== undefined) {
    raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), {status:413});
      chunks.push(bytes);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw.length > MAX_BODY_BYTES) throw Object.assign(new Error('Payload too large'), {status:413});
  try { return JSON.parse(raw.toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), {status:400}); }
}

const digest = value => createHash('sha256').update(value).digest();
const keyIsValid = (req, env) => {
  const key = env.SURVEY_ADMIN_KEY || '';
  const authorization = req.headers.authorization || '';
  return key.length >= 32 && authorization.startsWith('Bearer ') && timingSafeEqual(digest(authorization.slice(7)), digest(key));
};

export function createNewsletterHandlers({store = newsletterStore, env = process.env, rate = takeRate} = {}) {
  const health = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, {error:'Method not allowed.'}, {Allow:'GET, HEAD'});
    if (!acceptedOrigins(env).size) return reply(res, 503, {ready:false});
    try {
      await store.health();
      return reply(res, 200, req.method === 'HEAD' ? '' : {ready:true, notice_version:NEWSLETTER_NOTICE_VERSION});
    } catch {
      return reply(res, 503, req.method === 'HEAD' ? '' : {ready:false});
    }
  };

  const submit = async (req, res) => {
    if (req.method !== 'POST') return reply(res, 405, {error:'Method not allowed.'}, {Allow:'POST'});
    if (!acceptedOrigins(env).has(req.headers.origin)) return reply(res, 403, {error:'Please use the newsletter form on the Lippi website.'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(res, 415, {error:'JSON content is required.'});
    if (!rate(req, 'newsletter', 20)) return reply(res, 429, {error:'Too many requests. Please try again later.'}, {'Retry-After':'3600'});
    let data;
    try { data = await readJson(req); }
    catch (error) { return reply(res, error.status || 400, {error:error.status === 413 ? 'Your request is too long.' : 'Your request could not be read.'}); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.website) return reply(res, 400, {error:'The request could not be accepted.'});
    if (!validEmail(data.email)) return reply(res, 400, {error:'Please enter a valid email address.'});
    if (data.consent !== true) return reply(res, 400, {error:'Please confirm that you want to receive Lippi updates.'});
    if (data.notice_version !== NEWSLETTER_NOTICE_VERSION) return reply(res, 400, {error:'Please refresh this page and review the newsletter consent.'});
    if (!['en','pt','es'].includes(data.language)) return reply(res, 400, {error:'Please choose a supported newsletter language.'});
    try {
      await store.save({email:data.email.trim().toLowerCase(), language:data.language});
      // Acknowledges durable storage only. No email is sent by this endpoint.
      return reply(res, 201, {saved:true, status:'requested'});
    } catch {
      return reply(res, 503, {saved:false, error:'We could not save your request. Please try again or email lippifintech@igormarchetti.me.'});
    }
  };

  const admin = async (req, res) => {
    if (!rate(req, 'newsletter-admin', 60)) return reply(res, 429, {error:'Too many access attempts. Please try again later.'});
    if (!keyIsValid(req, env)) return reply(res, 401, {error:'A valid private access key is required.'});
    if (req.method !== 'GET') return reply(res, 405, {error:'Method not allowed.'}, {Allow:'GET'});
    const format = new URL(req.url || '/', 'https://lippi.invalid').searchParams.get('format') || 'json';
    if (!['json','csv'].includes(format)) return reply(res, 400, {error:'Use json or csv format.'});
    try {
      const found = await store.list();
      if (found.length > MAX_EXPORT_ROWS) return reply(res, 409, {error:'This list exceeds the export limit. Retrieve it directly from the database.'});
      const rows = found.map(row => ({...row, requested_at:new Date(row.requested_at).toISOString(), consent_recorded_at:new Date(row.consent_recorded_at).toISOString()}));
      if (format === 'csv') {
        const fields = ['email','language','requested_at','consent_recorded_at','notice_version','consent_text','status'];
        const csv = '\uFEFF' + [fields, ...rows.map(row => fields.map(field => row[field]))].map(row => row.map(csvCell).join(',')).join('\r\n');
        return reply(res, 200, csv, {'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="lippi-newsletter-requests.csv"'});
      }
      return reply(res, 200, {count:rows.length, signups:rows}, {'Content-Disposition':'attachment; filename="lippi-newsletter-requests.json"'});
    } catch {
      return reply(res, 503, {error:'Newsletter requests could not be retrieved. Please try again.'});
    }
  };
  return {health, submit, admin};
}

export const newsletter = createNewsletterHandlers();
