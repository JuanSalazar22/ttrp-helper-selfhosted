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
