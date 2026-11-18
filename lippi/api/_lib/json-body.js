const MAX_BYTES = 16 * 1024;

export class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function readBody(req) {
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
