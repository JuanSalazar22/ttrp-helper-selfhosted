/* ttrp-helper-selfhosted api — passkey (WebAuthn) auth + per-user character
   sync. No framework, JSON-file storage, signed session cookies.
   Pattern mirrors opengym's api/server.js. */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const PORT = +(process.env.PORT || 3000);
const DATA = process.env.DATA_DIR || '/data';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:8080';
const RP_NAME = process.env.RP_NAME || 'TTRP Helper';
const SESSION_DAYS = Math.max(1, +(process.env.SESSION_DAYS || 90) || 90);
const MAX_BODY = 5 * 1024 * 1024;
// Secure cookies require HTTPS; over plain http://localhost the flag would drop the cookie.
const SECURE = /^https:/i.test(ORIGIN) ? ' Secure;' : '';

fs.mkdirSync(DATA, { recursive: true });

/* ---------- secret + db ---------- */
const secretFile = path.join(DATA, 'secret');
if (!fs.existsSync(secretFile)) {
  fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
}
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();

const dbFile = path.join(DATA, 'db.json');
let db = { users: [], creds: [] };
try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch {}
db.users = db.users || [];
db.creds = db.creds || [];

function atomicWrite(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
function saveDb() { atomicWrite(dbFile, JSON.stringify(db, null, 2)); }

const charsFile = (uid) => path.join(DATA, 'characters-' + uid.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
const PORTRAIT_MAX_BASE64 = 3 * 1024 * 1024; // ~3MB base64 — generous for a 512x512 JPEG (typically tens of KB)
const portraitsDir = (uid) => path.join(DATA, 'portraits', uid.replace(/[^a-zA-Z0-9_-]/g, ''));
const portraitFile = (uid, id) => path.join(portraitsDir(uid), id.replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg');
function deletePortraitFile(uid, id) {
  try { fs.unlinkSync(portraitFile(uid, id)); } catch { /* none to delete */ }
}
function readChars(uid) {
  try { return JSON.parse(fs.readFileSync(charsFile(uid), 'utf8')); } catch { return []; }
}
function saveChars(uid, list) { atomicWrite(charsFile(uid), JSON.stringify(list, null, 2)); }

/* ---------- session cookie (HMAC-signed, no JWT library needed) ---------- */
function sign(payload) {
  const mac = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return Buffer.from(payload).toString('base64url') + '.' + mac;
}
function verifySig(token) {
  const [p, mac] = String(token || '').split('.');
  if (!p || !mac) return null;
  const payload = Buffer.from(p, 'base64url').toString('utf8');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return payload;
}
function makeSession(userId) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return sign(userId + ':' + exp);
}
function sessionCookie(userId) {
  const maxAge = SESSION_DAYS * 86400;
  return `session=${makeSession(userId)}; HttpOnly; Path=/; SameSite=Lax;${SECURE} Max-Age=${maxAge}`;
}
const clearCookie = `session=; HttpOnly; Path=/; SameSite=Lax;${SECURE} Max-Age=0`;

/** Reads the session cookie and returns the current user, or null. A user
 *  deleted (account deletion) simply stops being found here — no separate
 *  session-revocation list needed. */
function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('=');
    return i === -1 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
  const payload = verifySig(cookies.session);
  if (!payload) return null;
  const [userId, expStr] = payload.split(':');
  if (Date.now() > +expStr) return null;
  return db.users.find((u) => u.id === userId) || null;
}

/* ---------- short-lived challenge store (registration/login/link ceremonies) ---------- */
const challenges = new Map(); // cid -> { ...data, expires }
function putChallenge(data) {
  const cid = crypto.randomBytes(16).toString('base64url');
  challenges.set(cid, { ...data, expires: Date.now() + 5 * 60000 });
  return cid;
}
function takeChallenge(cid) {
  const c = challenges.get(cid);
  if (!c) return null;
  challenges.delete(cid);
  if (Date.now() > c.expires) return null;
  return c;
}
setInterval(() => {
  const now = Date.now();
  for (const [cid, c] of challenges) if (now > c.expires) challenges.delete(cid);
}, 60000).unref();

/* ---------- device-link codes (short, human-typeable, single-use) ---------- */
const linkCodes = new Map(); // code -> { userId, cid, expires }
function makeLinkCode(userId, cid) {
  const code = crypto.randomInt(0, 1e6).toString().padStart(6, '0');
  linkCodes.set(code, { userId, cid, expires: Date.now() + 5 * 60000 });
  return code;
}
function takeLinkCode(code) {
  const l = linkCodes.get(code);
  if (!l) return null;
  linkCodes.delete(code);
  if (Date.now() > l.expires) return null;
  return l;
}
setInterval(() => {
  const now = Date.now();
  for (const [code, l] of linkCodes) if (now > l.expires) linkCodes.delete(code);
}, 60000).unref();

// Global rate limit on link-code guessing — a 6-digit code has only 1e6
// possibilities, so without this an attacker could enumerate the active
// code well within its 5-minute TTL. Capped low enough to make brute-forcing
// impractical (reaching even a small fraction of 1e6 guesses is impossible
// at this rate) while comfortably covering legitimate typos/retries.
// Deliberately GLOBAL, not per-IP/per-code: this app targets a single
// self-hosted instance for one small, mutually-trusting tenant (a household
// or friend group), where device-linking is an occasional, cooperative
// action — a shared short lockout is proportionate. Revisit with a per-IP
// or per-code scheme if this ever needs to support many unrelated tenants
// on one instance.
let linkFailCount = 0;
let linkFailWindowStart = Date.now();
const LINK_FAIL_WINDOW_MS = 5 * 60000;
const LINK_FAIL_MAX = 20;
function linkGuessAllowed() {
  const now = Date.now();
  if (now - linkFailWindowStart > LINK_FAIL_WINDOW_MS) {
    linkFailCount = 0;
    linkFailWindowStart = now;
  }
  return linkFailCount < LINK_FAIL_MAX;
}
function recordLinkFail() {
  linkFailCount++;
}

/* ---------- tiny http helpers ---------- */
function json(res, code, obj, extraHeaders) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (d) => {
      size += d.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      data += d;
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function charIdFromPath(pathname, suffix) {
  const m = pathname.match(new RegExp('^/api/characters/([^/]+)' + suffix + '$'));
  return m ? decodeURIComponent(m[1]) : null;
}

/* ---------- routes ---------- */
const routes = {
  'GET /api/health': async (req, res) => json(res, 200, { ok: true, users: db.users.length }),

  'GET /api/me': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { user: { id: user.id, name: user.name } });
  },

  'PATCH /api/me': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 60);
    if (!name) return json(res, 400, { error: 'name required' });
    user.name = name;
    saveDb();
    json(res, 200, { user: { id: user.id, name: user.name } });
  },

  'POST /api/register/options': async (req, res) => {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 60);
    if (!name) return json(res, 400, { error: 'name required' });
    const uid = crypto.randomBytes(12).toString('base64url');
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: Buffer.from(uid), userName: name, userDisplayName: name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: [],
    });
    const cid = putChallenge({ kind: 'register', challenge: options.challenge, name, uid });
    json(res, 200, { cid, options });
  },

  'POST /api/register/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c || c.kind !== 'register') return json(res, 400, { error: 'challenge expired — try again' });
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
    } catch (e) {
      return json(res, 400, { error: 'verification failed: ' + e.message });
    }
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    const { credential } = verification.registrationInfo;
    if (db.creds.find((x) => x.id === credential.id)) {
      return json(res, 409, { error: 'credential already registered' });
    }
    const user = { id: c.uid, name: c.name, created: new Date().toISOString() };
    db.users.push(user);
    db.creds.push({
      id: credential.id, userId: user.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter || 0,
      transports: body.credential?.response?.transports || [],
    });
    saveDb();
    json(res, 200, { user: { id: user.id, name: user.name } }, { 'Set-Cookie': sessionCookie(user.id) });
  },

  'POST /api/login/options': async (req, res) => {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID, userVerification: 'preferred', allowCredentials: [],
    });
    const cid = putChallenge({ kind: 'login', challenge: options.challenge });
    json(res, 200, { cid, options });
  },

  'POST /api/login/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c || c.kind !== 'login') return json(res, 400, { error: 'challenge expired — try again' });
    const credId = body.credential?.id;
    const stored = db.creds.find((x) => x.id === credId);
    if (!stored) return json(res, 401, { error: 'unknown credential' });
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: stored.id,
          publicKey: Buffer.from(stored.publicKey, 'base64url'),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: false,
      });
    } catch (e) {
      return json(res, 401, { error: 'verification failed: ' + e.message });
    }
    if (!verification.verified) return json(res, 401, { error: 'not verified' });
    stored.counter = verification.authenticationInfo.newCounter;
    saveDb();
    const user = db.users.find((u) => u.id === stored.userId);
    if (!user) return json(res, 401, { error: 'account no longer exists' });
    json(res, 200, { user: { id: user.id, name: user.name } }, { 'Set-Cookie': sessionCookie(user.id) });
  },

  'POST /api/logout': async (req, res) => json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie }),

  'POST /api/passkey/link/options': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: Buffer.from(user.id), userName: user.name, userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: db.creds.filter((c) => c.userId === user.id).map((c) => ({ id: c.id })),
    });
    const cid = putChallenge({ kind: 'link', challenge: options.challenge, userId: user.id });
    const code = makeLinkCode(user.id, cid);
    json(res, 200, { code, options });
  },

  'POST /api/passkey/link/verify': async (req, res) => {
    if (!linkGuessAllowed()) return json(res, 429, { error: 'too many attempts — wait a few minutes and get a new code' });
    const body = await readBody(req);
    const link = takeLinkCode(String(body.code || '').trim());
    if (!link) { recordLinkFail(); return json(res, 400, { error: 'code expired or invalid — generate a new one' }); }
    const c = takeChallenge(link.cid);
    if (!c || c.kind !== 'link') { recordLinkFail(); return json(res, 400, { error: 'code expired or invalid — generate a new one' }); }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
    } catch (e) {
      return json(res, 400, { error: 'verification failed: ' + e.message });
    }
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    const { credential } = verification.registrationInfo;
    if (db.creds.find((x) => x.id === credential.id)) {
      return json(res, 409, { error: 'credential already registered' });
    }
    // Attach to the EXISTING account (link.userId / c.userId) instead of minting a new user —
    // this is the one thing opengym's own registration flow doesn't do.
    db.creds.push({
      id: credential.id, userId: c.userId,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter || 0,
      transports: body.credential?.response?.transports || [],
    });
    saveDb();
    const user = db.users.find((u) => u.id === c.userId);
    json(res, 200, { user: { id: user.id, name: user.name } }, { 'Set-Cookie': sessionCookie(user.id) });
  },

  'POST /api/passkey/link/exchange': async (req, res) => {
    if (!linkGuessAllowed()) return json(res, 429, { error: 'too many attempts — wait a few minutes and get a new code' });
    const body = await readBody(req);
    const code = String(body.code || '').trim();
    const link = linkCodes.get(code);
    if (!link || Date.now() > link.expires) { recordLinkFail(); return json(res, 400, { error: 'code expired or invalid' }); }
    const c = challenges.get(link.cid);
    if (!c) { recordLinkFail(); return json(res, 400, { error: 'code expired or invalid' }); }
    const user = db.users.find((u) => u.id === link.userId);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: Buffer.from(user.id), userName: user.name, userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: db.creds.filter((cr) => cr.userId === user.id).map((cr) => ({ id: cr.id })),
      challenge: Buffer.from(c.challenge, 'base64url'),
    });
    json(res, 200, { options });
  },

  'GET /api/characters': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { characters: readChars(user.id) });
  },

  'POST /api/characters/clear': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const now = new Date().toISOString();
    const list = readChars(user.id).map((c) => ({ ...c, deleted_at: now }));
    for (const c of list) deletePortraitFile(user.id, c.id);
    saveChars(user.id, list);
    json(res, 200, { ok: true });
  },

  'POST /api/account/delete': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    db.users = db.users.filter((u) => u.id !== user.id);
    db.creds = db.creds.filter((c) => c.userId !== user.id);
    saveDb();
    try { fs.unlinkSync(charsFile(user.id)); } catch {}
    try { fs.rmSync(portraitsDir(user.id), { recursive: true, force: true }); } catch {}
    json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = req.method + ' ' + url.pathname;

  if (req.method === 'PUT' && charIdFromPath(url.pathname, '') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '');
    const body = await readBody(req);
    const list = readChars(user.id);
    const now = new Date().toISOString();
    const existing = list.find((c) => c.id === id);
    if (existing) {
      existing.system = body.system;
      existing.data = body.data;
      existing.updated_at = now;
      existing.deleted_at = null;
    } else {
      list.push({ id, system: body.system, data: body.data, updated_at: now, deleted_at: null });
    }
    saveChars(user.id, list);
    return json(res, 200, { updated_at: now });
  }

  if (req.method === 'POST' && charIdFromPath(url.pathname, '/delete') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '/delete');
    const list = readChars(user.id);
    const row = list.find((c) => c.id === id);
    if (row) { row.deleted_at = new Date().toISOString(); saveChars(user.id, list); }
    deletePortraitFile(user.id, id);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'PUT' && charIdFromPath(url.pathname, '/portrait') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '/portrait');
    const list = readChars(user.id);
    const row = list.find((c) => c.id === id && !c.deleted_at);
    if (!row) return json(res, 404, { error: 'character not found' });
    const body = await readBody(req);
    const dataUrl = String(body.image || '');
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    if (!base64 || base64.length > PORTRAIT_MAX_BASE64) {
      return json(res, 400, { error: 'image missing or too large' });
    }
    fs.mkdirSync(portraitsDir(user.id), { recursive: true });
    fs.writeFileSync(portraitFile(user.id, id), Buffer.from(base64, 'base64'));
    const now = new Date().toISOString();
    row.portrait_updated_at = now;
    saveChars(user.id, list);
    return json(res, 200, { portrait_updated_at: now });
  }

  if (req.method === 'GET' && charIdFromPath(url.pathname, '/portrait') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '/portrait');
    const file = portraitFile(user.id, id);
    if (!fs.existsSync(file)) return json(res, 404, { error: 'no portrait' });
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (req.method === 'DELETE' && charIdFromPath(url.pathname, '/portrait') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '/portrait');
    const list = readChars(user.id);
    const row = list.find((c) => c.id === id);
    if (row) { row.portrait_updated_at = null; saveChars(user.id, list); }
    deletePortraitFile(user.id, id);
    return json(res, 200, { ok: true });
  }

  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  try {
    await handler(req, res);
  } catch (e) {
    console.error(key, e);
    json(res, 500, { error: 'internal error' });
  }
}).listen(PORT, () => console.log(`ttrp-selfhosted api listening on :${PORT}`));
