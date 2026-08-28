# Self-Hosted Passkey Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork TTRP Helper into `~/Repos/ttrp-helper-selfhosted`, replace Supabase entirely with a custom opengym-pattern backend (Node + `@simplewebauthn/server` + JSON-file storage), switch auth to passkeys with a cross-ecosystem device-linking flow, and ship it as a two-container (`api` + `web`) docker-compose stack.

**Architecture:** `api/` is a single-file Node `http` server (no framework) storing users/credentials in `db.json` and each user's characters in `characters-<uid>.json`, mirroring opengym's `api/server.js`. `web/` is an nginx container serving the Expo web export and reverse-proxying `/api/*` to `api` so both share one origin (required for WebAuthn's RP-ID/cookie model). The React Native app itself keeps its existing offline-first local-SQLite architecture untouched; only the cloud transport (`src/lib/supabase.ts` → `src/lib/api.ts`) and auth UI change.

**Tech Stack:** Node 22 (`node:http`, `@simplewebauthn/server`), `@simplewebauthn/browser` (client), Expo/React Native (existing), nginx (web), Docker Compose.

**Reference doc:** [2026-08-28-self-hosted-passkey-fork-design.md](../specs/2026-08-28-self-hosted-passkey-fork-design.md)

**Source repo:** `/Users/juan.salazar/Repos/TTRP-helper` (read-only reference; do not modify)
**Target repo:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted` (already `git init`-ed, one commit with the spec doc)

---

## Task 1: Fork the app code

**Files:**
- Creates: entire tracked TTRP-helper tree under `/Users/juan.salazar/Repos/ttrp-helper-selfhosted/`

- [ ] **Step 1: Export TTRP-helper's tracked snapshot into the new repo**

```bash
cd /Users/juan.salazar/Repos/TTRP-helper
git archive HEAD | tar -x -C /Users/juan.salazar/Repos/ttrp-helper-selfhosted/
```

This exports exactly what's committed — no `node_modules`, no `.env*` (gitignored, so it never picks up the real Supabase keys), no `dist/`, no stray untracked files.

- [ ] **Step 2: Verify the fork landed and the pre-existing spec doc survived**

```bash
cd /Users/juan.salazar/Repos/ttrp-helper-selfhosted
ls package.json app.json src/lib/supabase.ts supabase/config.toml
ls docs/superpowers/specs/2026-08-28-self-hosted-passkey-fork-design.md
```

Expected: all five paths exist.

- [ ] **Step 3: Commit the fork**

```bash
git add -A
git commit -m "chore: fork app code from TTRP-helper

Snapshot of TTRP-helper HEAD (git archive), before removing Supabase
and switching to passkey auth."
```

---

## Task 2: Remove Supabase

**Files:**
- Delete: `supabase/` (entire directory)
- Delete: `src/lib/supabase.ts`
- Delete: `src/lib/secureStorage.ts`
- Delete: `src/lib/__tests__/secureStorage.test.ts`
- Delete: `app/auth/callback.tsx`, `app/auth/reset-password.tsx` (magic-link/password-reset screens — import `@/lib/supabase` directly, so they'd be left as broken imports for many tasks if deleted later; removed here instead)
- Delete: `src/sync/bugReports.ts`, `src/sync/__tests__/bugReports.test.ts` — the beta bug-report feature `INSERT`s straight into the maintainer's own Supabase `bug_reports` table (see the file's own doc comment). Not part of this fork's scope (not sync, not login) and actively wrong to keep: it would either dangle on a deleted import, or if "fixed," silently phone every self-hoster's bug reports home to the original maintainer's cloud project.
- Delete: `app/(tabs)/report.tsx` — its only consumer, `bugReports.ts`, is gone above; leaving this screen in place even one commit longer means a dangling import to a deleted module.
- Modify: `app/(tabs)/_layout.tsx` — remove the `report` tab entirely: the `Tabs.Screen` block, the `Bug` icon import, and the now-unused `supabaseConfig` import (this file's *only* use of `supabaseConfig` is gating this tab's visibility — verified by reading the file, not guessed).
- Modify: `package.json` — remove the Supabase dependency/scripts (below), and three now-orphaned dependencies whose only consumer was code just deleted: `expo-secure-store` (only used by the deleted `secureStorage.ts`), `buffer` and `react-native-url-polyfill` (Supabase-js's RN polyfills, not used anywhere else in this codebase — confirmed via `grep -rn "from 'buffer'\|react-native-url-polyfill" src app`).
- Modify: `src/sync/reconcile.ts` — one stale doc-comment reference to "the Supabase `characters` table"; reword to stay accurate now that the backend is no longer Supabase (see Step 1's last bullet below for the exact wording).

- [ ] **Step 1: Delete Supabase-only files, the auth screens that directly import the client, and the bug-report feature (screen + backend + tab wiring, all in the same commit — no dangling imports left for later tasks to trip over)**

```bash
rm -rf supabase
rm src/lib/supabase.ts
rm src/lib/secureStorage.ts src/lib/__tests__/secureStorage.test.ts
rm app/auth/callback.tsx app/auth/reset-password.tsx
rmdir app/auth
rm src/sync/bugReports.ts src/sync/__tests__/bugReports.test.ts
rm "app/(tabs)/report.tsx"
```

In `app/(tabs)/_layout.tsx`: change the icon import from
```typescript
import { Users, Dices, Settings, Bug } from 'lucide-react-native';
```
to
```typescript
import { Users, Dices, Settings } from 'lucide-react-native';
```
delete the line `import { supabaseConfig } from '@/lib/config';`, and delete the entire `report` `Tabs.Screen` block:
```typescript
      <Tabs.Screen
        name="report"
        options={{
          title: tr('tabs.report'),
          tabBarIcon: ({ color, size }) => <Bug size={size} color={color} />,
          // Hidden when Supabase is unconfigured — a report form with nowhere to send
          // is worse than no tab. Matches how AccountSheet hides account UI.
          href: supabaseConfig.enabled ? undefined : null,
        }}
      />
```
The file should end up with exactly three tabs: `index`, `dice`, `settings`.

In `src/sync/reconcile.ts`, find the doc comment mentioning "the Supabase `characters` table" (near the top of the file, describing the `CloudCharacter` type) and reword it to describe the shape generically — e.g. "a character row as returned from the cloud backend's characters endpoint" — without naming Supabase, since it no longer is one. Read the existing comment first and make the minimal wording change; don't rewrite the whole comment block.

- [ ] **Step 2: Remove the Supabase dependency, its now-orphaned polyfills, and the Supabase CLI scripts from `package.json`**

Remove these four lines from `dependencies`:
```json
    "@supabase/supabase-js": "^2.108.2",
    "buffer": "^6.0.3",
    "expo-secure-store": "~56.0.4",
    "react-native-url-polyfill": "^3.0.0",
```
(Before removing, confirm each is genuinely unused elsewhere: `grep -rn "from 'buffer'\|expo-secure-store\|react-native-url-polyfill" src app` should return nothing once Step 1's deletions are in place. `react-native-get-random-values` is a *different* package — still used for `uuid` elsewhere — do not remove it.)

Remove these three lines from `scripts`:
```json
    "db:start": "npx supabase start",
    "db:stop": "npx supabase stop",
    "test:db": "npx supabase test db"
```

Also remove `"expo-secure-store"` from the `plugins` array in `app.json` (it's an Expo config plugin, not just an npm dependency — leaving it listed there while the package is uninstalled breaks `expo prebuild`/native builds).

- [ ] **Step 3: Reinstall to update the lockfile**

```bash
npm install
```

Expected: exits 0, `package-lock.json` no longer references `@supabase/supabase-js`.

- [ ] **Step 4: Confirm the ONLY remaining references to the deleted client are in files Tasks 9–10 will rewrite, not anywhere new**

```bash
grep -rln "@supabase/supabase-js\|lib/supabase\b\|lib/secureStorage" src app 2>/dev/null
```

Expected: exactly these three files, and nothing else —
```
src/auth/AuthProvider.tsx
src/sync/cloudCharacters.ts
src/sync/__tests__/cloudCharacters.test.ts
```
`app/(tabs)/report.tsx` must NOT appear (it's deleted, per Step 1) and neither must anything else. These three ARE expected to still import the now-deleted `@/lib/supabase`/`@supabase/supabase-js` — **that specific breakage is by design**, not something to fix in this task: `npm run typecheck`/`npm test` will fail because of exactly these three files until Task 9 rewrites `AuthProvider.tsx` and Task 10 rewrites `cloudCharacters.ts`/its test. A reviewer or later reader seeing a red typecheck at this commit is seeing expected, planned, sequential-task breakage — not a defect in this task's work. If the grep shows any file OTHER than these three, THAT is a real dangling reference this task needs to resolve.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase and the Supabase-only bug-report feature

Deletes the Supabase client/config/migrations/RLS, the secure-store
auth adapter, the magic-link auth screens, and the bug-report feature
(which posted straight to the maintainer's own Supabase project — out
of scope for a self-hosted fork). AuthProvider.tsx and
cloudCharacters.ts still reference the deleted client and will not
compile until Tasks 9-10 rewrite them against the new backend; that
breakage is expected and sequential, not a defect in this commit."
```

---

## Task 3: Backend — storage, sessions, and challenge store

**Files:**
- Create: `api/package.json`
- Create: `api/server.js`

- [ ] **Step 1: `api/package.json`**

```json
{
  "name": "ttrp-selfhosted-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@simplewebauthn/server": "^13.1.1"
  }
}
```

- [ ] **Step 2: `api/server.js` — storage, HMAC session, and challenge-store primitives**

```javascript
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
```

- [ ] **Step 3: Sanity-check the file parses**

```bash
cd api && node --check server.js && cd ..
```

Expected: no output (syntax OK). Routes aren't defined yet — that's fine for `--check`.

- [ ] **Step 4: Commit**

```bash
git add api/
git commit -m "feat(api): storage, HMAC session cookie, and challenge-store primitives"
```

---

## Task 4: Backend — passkey register/login routes

**Files:**
- Modify: `api/server.js` (append routes + server bootstrap)

- [ ] **Step 1: Append the auth routes and the HTTP server to `api/server.js`**

```javascript
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
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = req.method + ' ' + url.pathname;
  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  try {
    await handler(req, res);
  } catch (e) {
    console.error(key, e);
    json(res, 500, { error: 'internal error' });
  }
}).listen(PORT, () => console.log(`ttrp-selfhosted api listening on :${PORT}`));
```

- [ ] **Step 2: Install and smoke-test locally**

```bash
cd api && npm install && DATA_DIR=/tmp/ttrp-api-data node server.js &
sleep 1
curl -s http://localhost:3000/api/health
kill %1
cd ..
```

Expected: `{"ok":true,"users":0}`.

- [ ] **Step 3: Commit**

```bash
git add api/
git commit -m "feat(api): passkey register/login routes + HTTP server bootstrap"
```

---

## Task 5: Backend — device-linking routes

**Files:**
- Modify: `api/server.js` (add two routes to the `routes` object, before the `http.createServer(...)` block)

- [ ] **Step 1: Add the link routes**

Insert into the `routes` object (right before the closing `};` that precedes `http.createServer`):

```javascript
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
    const body = await readBody(req);
    const link = takeLinkCode(String(body.code || '').trim());
    if (!link) return json(res, 400, { error: 'code expired or invalid — generate a new one' });
    const c = takeChallenge(link.cid);
    if (!c || c.kind !== 'link') return json(res, 400, { error: 'code expired or invalid — generate a new one' });
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
```

- [ ] **Step 2: Add the code-exchange route (lets the *receiving* device fetch registration options using only the code, with no session of its own)**

Insert into the `routes` object, alongside the two routes above:

```javascript
  'POST /api/passkey/link/exchange': async (req, res) => {
    const body = await readBody(req);
    const code = String(body.code || '').trim();
    const link = linkCodes.get(code);
    if (!link || Date.now() > link.expires) return json(res, 400, { error: 'code expired or invalid' });
    const c = challenges.get(link.cid);
    if (!c) return json(res, 400, { error: 'code expired or invalid' });
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
```

Note this reads `linkCodes`/`challenges` directly rather than through `takeLinkCode`/`takeChallenge` — it must **not** consume them, since the actual registration ceremony (and the real `takeLinkCode`/`takeChallenge` calls) happens afterward in `/api/passkey/link/verify`. Passing the *same* `challenge` bytes here as were generated in `/api/passkey/link/options` is required — `verifyRegistrationResponse` in `/verify` checks the credential's response against that exact challenge.

- [ ] **Step 3: Manual verification — link a second credential to one account**

```bash
cd api && DATA_DIR=/tmp/ttrp-api-data2 node server.js &
sleep 1
# Full WebAuthn ceremonies need a browser; here we just confirm the routes exist and reject garbage.
curl -s -X POST http://localhost:3000/api/passkey/link/options
curl -s -X POST http://localhost:3000/api/passkey/link/verify -H 'Content-Type: application/json' -d '{"code":"000000","credential":{}}'
kill %1
cd ..
```

Expected: first call → `{"error":"not signed in"}` (401); second → `{"error":"code expired or invalid — generate a new one"}` (400). Full ceremony verification happens end-to-end in Task 14 via the browser.

- [ ] **Step 4: Commit**

```bash
git add api/
git commit -m "feat(api): device-linking routes so a second device joins the same account"
```

---

## Task 6: Backend — character sync + account deletion routes

**Files:**
- Modify: `api/server.js` (add routes; requires a small path-parsing tweak for `/api/characters/:id/...`)

- [ ] **Step 1: Add a path-param helper above the `routes` object**

```javascript
function charIdFromPath(pathname, suffix) {
  const m = pathname.match(new RegExp('^/api/characters/([^/]+)' + suffix + '$'));
  return m ? decodeURIComponent(m[1]) : null;
}
```

- [ ] **Step 2: Add the character + account routes**

Insert into the `routes` object:

```javascript
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
    json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
  },
```

Routes whose path has a variable segment (`/api/characters/:id`, `/api/characters/:id/delete`) don't fit the flat `routes` lookup table, so handle them in the dispatcher instead — replace the `http.createServer(...)` block from Task 4 with:

```javascript
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
```

- [ ] **Step 3: Manual verification**

```bash
cd api && DATA_DIR=/tmp/ttrp-api-data3 node server.js &
sleep 1
curl -s http://localhost:3000/api/characters   # expect 401, not signed in
curl -s -X PUT http://localhost:3000/api/characters/abc -d '{}'  # expect 401
kill %1
cd ..
```

Expected: both calls return `{"error":"not signed in"}`.

- [ ] **Step 4: Commit**

```bash
git add api/
git commit -m "feat(api): per-character upsert/tombstone sync routes + account deletion"
```

---

## Task 7: Backend Dockerfile

**Files:**
- Create: `api/Dockerfile`
- Create: `api/.dockerignore`

- [ ] **Step 1: `api/.dockerignore`**

```
node_modules
```

- [ ] **Step 2: `api/Dockerfile`**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
            CMD wget --spider -q "http://127.0.0.1:${PORT}/api/health" || exit 1
```

- [ ] **Step 3: Build it standalone to confirm it works**

```bash
docker build -t ttrp-api-test ./api
docker run --rm -d -p 3001:3000 -e DATA_DIR=/data -v /tmp/ttrp-docker-data:/data --name ttrp-api-test ttrp-api-test
sleep 1
curl -s http://localhost:3001/api/health
docker stop ttrp-api-test
```

Expected: `{"ok":true,"users":0}`.

- [ ] **Step 4: Commit**

```bash
git add api/Dockerfile api/.dockerignore
git commit -m "chore(api): Dockerfile"
```

---

## Task 8: Frontend — API client + config

**Files:**
- Create: `src/lib/api.ts`
- Modify: `src/lib/config.ts`
- Test: `src/lib/__tests__/api.test.ts`

- [ ] **Step 1: Rewrite `src/lib/config.ts`**

```typescript
// The web build's nginx proxies /api/* to the api container (same origin,
// required for WebAuthn), so a relative path works for any self-hoster's
// domain with zero build-time configuration. Override for local dev when
// running `expo start --web` against an api container on a different port.
export const apiConfig = {
  url: process.env.EXPO_PUBLIC_API_URL || '/api',
};
```

- [ ] **Step 2: Write the failing test for `src/lib/api.ts`**

```typescript
// src/lib/__tests__/api.test.ts
import { getMe } from '../api';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.resetAllMocks(); });

describe('getMe', () => {
  it('returns the user when signed in', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ user: { id: 'u1', name: 'Alice' } }),
    }) as any;
    const result = await getMe();
    expect(result).toEqual({ id: 'u1', name: 'Alice' });
    expect(global.fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('returns null when signed out (401)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as any;
    const result = await getMe();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npx jest src/lib/__tests__/api.test.ts
```

Expected: FAIL — `Cannot find module '../api'`.

- [ ] **Step 4: Write `src/lib/api.ts`**

```typescript
import { apiConfig } from '@/lib/config';

export type ApiUser = { id: string; name: string };
export type CloudCharacter = { id: string; system: string; data: any; updated_at: string; deleted_at: string | null };

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiConfig.url}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export async function getMe(): Promise<ApiUser | null> {
  const res = await apiFetch('/me');
  if (!res.ok) return null;
  const { user } = await res.json();
  return user;
}

export async function updateMe(name: string): Promise<{ error: string | null }> {
  const res = await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ name }) });
  if (!res.ok) return { error: (await res.json().catch(() => ({})))?.error ?? 'request failed' };
  return { error: null };
}

export async function registerOptions(name: string) {
  const res = await apiFetch('/register/options', { method: 'POST', body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ cid: string; options: any }>;
}

export async function registerVerify(cid: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

export async function loginOptions() {
  const res = await apiFetch('/login/options', { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ cid: string; options: any }>;
}

export async function loginVerify(cid: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

export async function logout(): Promise<void> {
  await apiFetch('/logout', { method: 'POST' });
}

export async function startDeviceLinkOptions() {
  const res = await apiFetch('/passkey/link/options', { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ code: string; options: any }>;
}

export async function verifyDeviceLink(code: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/passkey/link/verify', { method: 'POST', body: JSON.stringify({ code, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

/** Called by the *receiving* device, which has only the 6-digit code and no
 *  session of its own, to fetch the registration options tied to that code. */
export async function exchangeLinkCode(code: string): Promise<{ options: any }> {
  const res = await apiFetch('/passkey/link/exchange', { method: 'POST', body: JSON.stringify({ code }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json();
}

export async function deleteAccountRequest(): Promise<{ error: string | null }> {
  const res = await apiFetch('/account/delete', { method: 'POST' });
  if (!res.ok) return { error: (await res.json().catch(() => ({})))?.error ?? 'request failed' };
  return { error: null };
}

export async function getCharacters(): Promise<CloudCharacter[]> {
  const res = await apiFetch('/characters');
  if (!res.ok) return [];
  return (await res.json()).characters;
}

export async function putCharacter(id: string, system: string, data: any): Promise<{ updated_at: string } | null> {
  const res = await apiFetch(`/characters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ system, data }) });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteCharacterRequest(id: string): Promise<void> {
  await apiFetch(`/characters/${encodeURIComponent(id)}/delete`, { method: 'POST' });
}

export async function clearCharactersRequest(): Promise<{ ok: boolean }> {
  const res = await apiFetch('/characters/clear', { method: 'POST' });
  return { ok: res.ok };
}
```

- [ ] **Step 5: Run the test again and confirm it passes**

```bash
npx jest src/lib/__tests__/api.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/lib/config.ts src/lib/__tests__/api.test.ts
git commit -m "feat(api-client): fetch-based client for the self-hosted backend"
```

---

## Task 9: Frontend — WebAuthn wrapper + AuthProvider rewrite

**Files:**
- Create: `src/auth/webauthn.ts`
- Modify: `src/auth/AuthProvider.tsx` (full rewrite)
- Delete: `src/auth/email.ts`, `src/auth/password.ts`
- Delete: `src/auth/__tests__/email.test.ts`, `src/auth/__tests__/password.test.ts`
- Modify: `package.json` (add `@simplewebauthn/browser`)

- [ ] **Step 1: Delete the email/password helpers (no longer used — passkeys only)**

```bash
rm src/auth/email.ts src/auth/password.ts
rm src/auth/__tests__/email.test.ts src/auth/__tests__/password.test.ts
```

- [ ] **Step 2: Add the WebAuthn browser library**

```bash
npm install @simplewebauthn/browser@^13
```

- [ ] **Step 3: `src/auth/webauthn.ts`**

```typescript
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

/** Thin wrapper so AuthProvider doesn't import @simplewebauthn/browser directly —
 *  keeps the WebAuthn-specific shapes in one place. Web only: the browser's
 *  navigator.credentials API is what backs this; native has no equivalent yet. */
export async function createPasskey(options: any) {
  return startRegistration({ optionsJSON: options });
}

export async function getPasskey(options: any) {
  return startAuthentication({ optionsJSON: options });
}
```

- [ ] **Step 4: Rewrite `src/auth/AuthProvider.tsx`**

```typescript
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '@/lib/api';
import { createPasskey, getPasskey } from '@/auth/webauthn';

type Session = { user: api.ApiUser };

type AuthState = {
  session: Session | null;
  loading: boolean;
  displayName: string | null;
  registerPasskey: (name: string) => Promise<{ error: string | null }>;
  loginWithPasskey: () => Promise<{ error: string | null }>;
  startDeviceLink: () => Promise<{ code: string | null; error: string | null }>;
  linkDevice: (code: string, options: any) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | null>(null);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — the browser sends the HttpOnly cookie automatically;
  // we just ask the server who (if anyone) it belongs to.
  useEffect(() => {
    api.getMe().then((user) => { setSession(user ? { user } : null); setLoading(false); });
  }, []);

  const registerPasskey = useCallback(async (name: string) => {
    try {
      const { cid, options } = await api.registerOptions(name);
      const credential = await createPasskey(options);
      const user = await api.registerVerify(cid, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const loginWithPasskey = useCallback(async () => {
    try {
      const { cid, options } = await api.loginOptions();
      const credential = await getPasskey(options);
      const user = await api.loginVerify(cid, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const startDeviceLink = useCallback(async () => {
    try {
      const { code } = await api.startDeviceLinkOptions();
      return { code, error: null };
    } catch (e) {
      return { code: null, error: errorMessage(e) };
    }
  }, []);

  // The receiving device only has a 6-digit code, no session — it fetches its
  // registration options via api.exchangeLinkCode(code) *before* calling this
  // (see AccountSheet.tsx), then completes the ceremony and verifies here.
  const linkDevice = useCallback(async (code: string, options: any) => {
    try {
      const credential = await createPasskey(options);
      const user = await api.verifyDeviceLink(code, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => { await api.logout(); setSession(null); }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const { error } = await api.updateMe(name.trim());
    if (!error) setSession((s) => (s ? { user: { ...s.user, name: name.trim() } } : s));
    return { error };
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!session) return { error: 'Not signed in' };
    const { error } = await api.deleteAccountRequest();
    if (!error) setSession(null);
    return { error };
  }, [session]);

  return (
    <AuthContext.Provider value={{
      session, loading,
      displayName: session?.user.name ?? null,
      registerPasskey, loginWithPasskey, startDeviceLink, linkDevice,
      signOut, updateDisplayName, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

`linkDevice`'s two-call sequence (`api.exchangeLinkCode` first, then this) mirrors how `AccountSheet.tsx` drives it in Task 12: the receiving device has only the code, so it exchanges that for options before it can create a credential at all.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): passkey AuthProvider (register/login/link/signOut), remove email+password auth"
```

---

## Task 10: Frontend — cloudCharacters.ts and its test

**Files:**
- Modify: `src/sync/cloudCharacters.ts` (full rewrite)
- Modify: `src/sync/__tests__/cloudCharacters.test.ts` (full rewrite)

- [ ] **Step 1: Rewrite the test to mock `@/lib/api` instead of `@/lib/supabase`**

```typescript
// src/sync/__tests__/cloudCharacters.test.ts
import { softDeleteAllCharacters, pushCharacter, pullCharacters, softDeleteCharacterCloud } from '../cloudCharacters';

jest.mock('@/lib/api', () => ({
  clearCharactersRequest: jest.fn(),
  putCharacter: jest.fn(),
  getCharacters: jest.fn(),
  deleteCharacterRequest: jest.fn(),
}));

import * as api from '@/lib/api';

describe('cloudCharacters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('softDeleteAllCharacters no-ops when there is no session', async () => {
    const result = await softDeleteAllCharacters(null);
    expect(api.clearCharactersRequest).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('softDeleteAllCharacters calls the clear endpoint when signed in', async () => {
    (api.clearCharactersRequest as jest.Mock).mockResolvedValue({ ok: true });
    const result = await softDeleteAllCharacters({ user: { id: 'u1', name: 'A' } } as any);
    expect(api.clearCharactersRequest).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('pushCharacter no-ops when there is no session', async () => {
    const dbStub = {} as any;
    const result = await pushCharacter(dbStub, null, { id: 'c1', system: 'dnd5e', data: {} });
    expect(api.putCharacter).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('pullCharacters returns [] when there is no session', async () => {
    const result = await pullCharacters(null);
    expect(api.getCharacters).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('softDeleteCharacterCloud no-ops when there is no session', async () => {
    await softDeleteCharacterCloud(null, 'c1');
    expect(api.deleteCharacterRequest).not.toHaveBeenCalled();
  });

  it('softDeleteCharacterCloud calls the delete endpoint when signed in', async () => {
    await softDeleteCharacterCloud({ user: { id: 'u1', name: 'A' } } as any, 'c1');
    expect(api.deleteCharacterRequest).toHaveBeenCalledWith('c1');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx jest src/sync/__tests__/cloudCharacters.test.ts
```

Expected: FAIL — current `cloudCharacters.ts` still imports `@/lib/supabase`, which no longer exists.

- [ ] **Step 3: Rewrite `src/sync/cloudCharacters.ts`**

```typescript
import type { SQLiteDatabase } from 'expo-sqlite';
import * as api from '@/lib/api';
import { setCloudUpdatedAt } from '@/db/queries';
import type { CloudCharacter } from '@/sync/reconcile';

type Session = { user: { id: string; name: string } } | null;

/** Upsert one character; the server sets updated_at, which we read back and
 *  store locally as cloud_updated_at. No-op when signed out; never throws. */
export async function pushCharacter(
  db: SQLiteDatabase,
  session: Session,
  c: { id: string; system: string; data: any },
): Promise<{ ok: boolean }> {
  if (!session) return { ok: true }; // no-op is not a failure
  const result = await api.putCharacter(c.id, c.system, c.data);
  if (!result) { console.warn('[sync] push failed'); return { ok: false }; }
  await setCloudUpdatedAt(db, c.id, result.updated_at);
  return { ok: true };
}

/** Fetch ALL of the user's rows, including tombstones (needed to propagate deletes). */
export async function pullCharacters(session: Session): Promise<CloudCharacter[]> {
  if (!session) return [];
  return api.getCharacters() as Promise<CloudCharacter[]>;
}

/** Soft-delete a character in the cloud so the deletion propagates to other devices. */
export async function softDeleteCharacterCloud(session: Session, id: string): Promise<void> {
  if (!session) return;
  await api.deleteCharacterRequest(id);
}

/** Soft-delete every one of the signed-in user's characters — the reversible half
 *  of account deletion ("Remove cloud data"). */
export async function softDeleteAllCharacters(session: Session): Promise<{ ok: boolean }> {
  if (!session) return { ok: true }; // no-op is not a failure
  return api.clearCharactersRequest();
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx jest src/sync/__tests__/cloudCharacters.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sync/cloudCharacters.ts src/sync/__tests__/cloudCharacters.test.ts
git commit -m "feat(sync): reimplement cloudCharacters.ts against the self-hosted api"
```

---

## Task 11: Frontend — i18n keys for passkeys and device linking

**Files:**
- Modify: `src/i18n/en.ts` (`settings.account` namespace)
- Modify: `src/i18n/es.ts` (`settings.account` namespace)

- [ ] **Step 1: Replace the `account` block in `src/i18n/en.ts`**

Remove these keys (email+password/magic-link only, no longer applicable): `emailPlaceholder`, `invalidEmail`, `linkExpired`, `backToSettings`, `password`, `passwordPlaceholder`, `confirmPassword`, `signIn`, `createAccount`, `createAccountLink`, `backToSignIn`, `forgotPassword`, `sendResetLink`, `confirmEmailSent`, `resetEmailSent`, `passwordTooShort`, `passwordMismatch`, `newPassword`, `updatePassword`, `passwordUpdated`, `linkExpiredReset`.

Replace `signedInAs` and add the new passkey/device-link keys, so the full block reads:

```typescript
    account: {
      title: 'Account',
      subtitle: 'Create a passkey to sync and back up your characters.',
      namePlaceholder: 'Your name',
      signedInAs: 'Signed in as {name}',
      signOut: 'Sign out',
      error: 'Could not complete the request. Try again.',
      signingIn: 'Working…',
      displayName: 'Display name',
      displayNamePlaceholder: 'Your name',
      saveName: 'Save',
      nameSaved: 'Saved!',
      signUpWithPasskey: 'Create account with passkey',
      signInWithPasskey: 'Sign in with passkey',
      haveLinkCode: 'I have a code from another device',
      linkCodePlaceholder: 'Enter code',
      linkDeviceSubmit: 'Link device',
      addThisDevice: 'Add this device',
      addThisDeviceHint: "Show this code on your new device, or enter it there within 5 minutes.",
      linkCodeShown: 'Code: {code}',
      backToSignIn: '← Back',
      dangerZone: 'Danger zone',
      removeCloudData: 'Remove cloud data',
      removeCloudDataHint: 'Deletes your backed-up characters from the cloud and signs you out. Characters on this device are untouched, and signing back in will re-upload them.',
      removeCloudDataConfirm: 'Remove your cloud backup? Characters on this device will not be affected.',
      removeCloudDataError: 'Could not remove your cloud data. Try again, or contact support if this keeps happening.',
      deleteAccount: 'Delete account',
      deleteAccountHint: 'Permanently deletes your account and all cloud data. This cannot be undone.',
      deleteAccountConfirmTitle: 'Delete account?',
      deleteAccountConfirmBody: 'This permanently deletes your account and every character backed up to the cloud. Characters on this device are not affected. This cannot be undone.',
      deleteAccountError: 'Could not delete your account. Try again, or contact support if this keeps happening.',
      deletingAccount: 'Deleting…',
    },
```

- [ ] **Step 2: Replace the matching block in `src/i18n/es.ts`**

```typescript
    account: {
      title: 'Cuenta',
      subtitle: 'Crea una passkey para sincronizar y respaldar tus personajes.',
      namePlaceholder: 'Tu nombre',
      signedInAs: 'Sesión iniciada como {name}',
      signOut: 'Cerrar sesión',
      error: 'No se pudo completar la solicitud. Inténtalo de nuevo.',
      signingIn: 'Procesando…',
      displayName: 'Nombre visible',
      displayNamePlaceholder: 'Tu nombre',
      saveName: 'Guardar',
      nameSaved: '¡Guardado!',
      signUpWithPasskey: 'Crear cuenta con passkey',
      signInWithPasskey: 'Iniciar sesión con passkey',
      haveLinkCode: 'Tengo un código de otro dispositivo',
      linkCodePlaceholder: 'Ingresa el código',
      linkDeviceSubmit: 'Vincular dispositivo',
      addThisDevice: 'Agregar este dispositivo',
      addThisDeviceHint: 'Muestra este código en tu nuevo dispositivo, o ingrésalo allí en los próximos 5 minutos.',
      linkCodeShown: 'Código: {code}',
      backToSignIn: '← Volver',
      dangerZone: 'Zona de peligro',
      removeCloudData: 'Eliminar datos en la nube',
      removeCloudDataHint: 'Elimina tus personajes respaldados en la nube y cierra tu sesión. Los personajes en este dispositivo no se ven afectados, y volver a iniciar sesión los volverá a subir.',
      removeCloudDataConfirm: '¿Eliminar tu respaldo en la nube? Los personajes en este dispositivo no se verán afectados.',
      removeCloudDataError: 'No se pudieron eliminar tus datos en la nube. Intenta de nuevo, o contacta soporte si esto persiste.',
      deleteAccount: 'Eliminar cuenta',
      deleteAccountHint: 'Elimina permanentemente tu cuenta y todos los datos en la nube. Esta acción no se puede deshacer.',
      deleteAccountConfirmTitle: '¿Eliminar cuenta?',
      deleteAccountConfirmBody: 'Esto elimina permanentemente tu cuenta y todos los personajes respaldados en la nube. Los personajes en este dispositivo no se ven afectados. Esta acción no se puede deshacer.',
      deleteAccountError: 'No se pudo eliminar tu cuenta. Intenta de nuevo, o contacta soporte si esto persiste.',
      deletingAccount: 'Eliminando…',
    },
```

- [ ] **Step 3: Run the i18n tests**

```bash
npx jest src/i18n
```

Expected: PASS — the ES overlay test checks structural parity (keys present, no placeholder drift), and both files were edited together so they match.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts
git commit -m "i18n: replace email/password account strings with passkey + device-link strings"
```

---

## Task 12: Frontend — AccountSheet.tsx rewrite

**Files:**
- Modify: `src/components/ui/AccountSheet.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `src/components/ui/AccountSheet.tsx`**

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { X, LogOut } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { exchangeLinkCode } from '@/lib/api';
import { softDeleteAllCharacters } from '@/sync/cloudCharacters';
import { confirmRemove } from '@/lib/confirm';

type Props = { visible: boolean; onClose: () => void };

type Mode = 'start' | 'enterName' | 'showLinkCode' | 'enterLinkCode';

/** Bottom sheet for passkey auth (signed-out) or profile (signed-in). */
export function AccountSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const {
    session, loading, displayName,
    registerPasskey, loginWithPasskey, startDeviceLink, linkDevice,
    signOut, updateDisplayName, deleteAccount,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('start');
  const [name, setName] = useState('');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [removingCloud, setRemovingCloud] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMode('start'); setName(''); setLinkCode(null); setLinkCodeInput('');
      setFormError(null); setSubmitting(false); setNameStatus('idle');
    }
  }, [visible]);

  useEffect(() => { setFormError(null); }, [mode]);

  useEffect(() => {
    setNameInput(displayName ?? '');
    setNameStatus('idle');
  }, [displayName]);

  async function onSignUp() {
    if (!name.trim()) { setFormError(tr('settings.account.error')); return; }
    setSubmitting(true); setFormError(null);
    const { error } = await registerPasskey(name.trim());
    setSubmitting(false);
    if (error) setFormError(error);
  }

  async function onSignIn() {
    setSubmitting(true); setFormError(null);
    const { error } = await loginWithPasskey();
    setSubmitting(false);
    if (error) setFormError(error);
  }

  async function onShowLinkCode() {
    setSubmitting(true); setFormError(null);
    const { code, error } = await startDeviceLink();
    setSubmitting(false);
    if (error) { setFormError(error); return; }
    setLinkCode(code); setMode('showLinkCode');
  }

  async function onSubmitLinkCode() {
    if (!linkCodeInput.trim()) return;
    setSubmitting(true); setFormError(null);
    try {
      const { options } = await exchangeLinkCode(linkCodeInput.trim());
      const { error } = await linkDevice(linkCodeInput.trim(), options);
      if (error) setFormError(error);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : tr('settings.account.error'));
    }
    setSubmitting(false);
  }

  async function onSaveName() {
    setNameStatus('saving');
    const { error } = await updateDisplayName(nameInput);
    setNameStatus(error ? 'idle' : 'saved');
  }

  const nameDirty = nameInput !== (displayName ?? '');

  function onRemoveCloudData() {
    confirmRemove(
      tr,
      tr('settings.account.removeCloudDataConfirm'),
      async () => {
        setRemovingCloud(true);
        setAccountError(null);
        const { ok } = await softDeleteAllCharacters(session);
        setRemovingCloud(false);
        if (!ok) { setAccountError(tr('settings.account.removeCloudDataError')); return; }
        signOut();
        onClose();
      },
      tr('settings.account.removeCloudData'),
    );
  }

  async function onDeleteAccount() {
    setDeletingAccount(true);
    setAccountError(null);
    const { error } = await deleteAccount();
    setDeletingAccount(false);
    if (error) { setAccountError(tr('settings.account.deleteAccountError')); return; }
    setDeleteConfirmOpen(false);
    onClose();
  }

  function inputColors() {
    return { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary };
  }

  function primaryButton(label: string, onPress: () => void) {
    return (
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: t.colors.accent, opacity: submitting ? 0.6 : 1 }]}
        onPress={onPress}
        disabled={submitting}
      >
        <Text style={[styles.saveBtnText, { color: t.colors.accentText }]}>
          {submitting ? tr('settings.account.signingIn') : label}
        </Text>
      </TouchableOpacity>
    );
  }

  function errorRow() {
    return formError ? <Text style={[styles.errorText, { color: t.colors.danger }]}>{formError}</Text> : null;
  }

  function linkButton(labelKey: TKey, onPress: () => void) {
    return (
      <TouchableOpacity onPress={onPress} hitSlop={8}>
        <Text style={[styles.link, { color: t.colors.accent }]}>{tr(labelKey)}</Text>
      </TouchableOpacity>
    );
  }

  function renderBody() {
    if (loading) return <ActivityIndicator color={t.colors.accent} style={{ marginTop: 24 }} />;
    if (session) return renderSignedIn();
    if (mode === 'enterName') return renderEnterName();
    if (mode === 'enterLinkCode') return renderEnterLinkCode();
    return renderStart();
  }

  function renderStart() {
    return (
      <View style={styles.body}>
        <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('settings.account.subtitle')}</Text>
        {errorRow()}
        {primaryButton(tr('settings.account.signInWithPasskey'), onSignIn)}
        <View style={styles.linkRowCenter}>{linkButton('settings.account.signUpWithPasskey', () => setMode('enterName'))}</View>
        <View style={styles.linkRowCenter}>{linkButton('settings.account.haveLinkCode', () => setMode('enterLinkCode'))}</View>
      </View>
    );
  }

  function renderEnterName() {
    return (
      <View style={styles.body}>
        <TextInput
          style={[styles.input, inputColors()]}
          value={name}
          onChangeText={(v) => { setName(v); if (formError) setFormError(null); }}
          placeholder={tr('settings.account.namePlaceholder')}
          placeholderTextColor={t.colors.textMuted}
          autoFocus
          autoCorrect={false}
        />
        {errorRow()}
        {primaryButton(tr('settings.account.signUpWithPasskey'), onSignUp)}
        <View style={styles.linkRowCenter}>{linkButton('settings.account.backToSignIn', () => setMode('start'))}</View>
      </View>
    );
  }

  function renderEnterLinkCode() {
    return (
      <View style={styles.body}>
        <TextInput
          style={[styles.input, inputColors()]}
          value={linkCodeInput}
          onChangeText={(v) => { setLinkCodeInput(v); if (formError) setFormError(null); }}
          placeholder={tr('settings.account.linkCodePlaceholder')}
          placeholderTextColor={t.colors.textMuted}
          keyboardType="number-pad"
          autoFocus
        />
        {errorRow()}
        {primaryButton(tr('settings.account.linkDeviceSubmit'), onSubmitLinkCode)}
        <View style={styles.linkRowCenter}>{linkButton('settings.account.backToSignIn', () => setMode('start'))}</View>
      </View>
    );
  }

  function renderSignedIn() {
    if (!session) return null;
    if (mode === 'showLinkCode' && linkCode) {
      return (
        <View style={styles.body}>
          <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('settings.account.addThisDeviceHint')}</Text>
          <Text style={[styles.linkCode, { color: t.colors.text }]}>{tr('settings.account.linkCodeShown', { code: linkCode })}</Text>
          <View style={styles.linkRowCenter}>{linkButton('settings.account.backToSignIn', () => setMode('start'))}</View>
        </View>
      );
    }
    return (
      <View style={styles.body}>
        <View style={[styles.avatar, { backgroundColor: t.colors.accent + '22' }]}>
          <Text style={[styles.avatarText, { color: t.colors.accent }]}>
            {(displayName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.emailLabel, { color: t.colors.textSecondary }]} numberOfLines={1}>
          {tr('settings.account.signedInAs', { name: displayName ?? '' })}
        </Text>
        <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
          {tr('settings.account.displayName')}
        </Text>
        <TextInput
          style={[styles.input, inputColors()]}
          value={nameInput}
          onChangeText={(v) => { setNameInput(v); if (nameStatus === 'saved') setNameStatus('idle'); }}
          placeholder={tr('settings.account.displayNamePlaceholder')}
          placeholderTextColor={t.colors.textMuted}
          autoCorrect={false}
        />
        {(nameDirty || nameStatus === 'saved') && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: t.colors.accent, opacity: nameStatus === 'saving' ? 0.6 : 1 }]}
            onPress={onSaveName}
            disabled={nameStatus === 'saving'}
          >
            <Text style={[styles.saveBtnText, { color: t.colors.accentText }]}>
              {nameStatus === 'saved' ? tr('settings.account.nameSaved') : tr('settings.account.saveName')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.dangerBtn, { borderColor: t.colors.border, marginTop: 8 }]} onPress={onShowLinkCode}>
          <Text style={[styles.dangerBtnText, { color: t.colors.text }]}>{tr('settings.account.addThisDevice')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: t.colors.border }]}
          onPress={() => { signOut(); onClose(); }}
        >
          <LogOut size={16} color={t.colors.danger} />
          <Text style={[styles.signOutText, { color: t.colors.danger }]}>{tr('settings.account.signOut')}</Text>
        </TouchableOpacity>

        <View style={[styles.dangerZone, { borderColor: t.colors.border }]}>
          <Text style={[styles.dangerZoneTitle, { color: t.colors.textMuted }]}>{tr('settings.account.dangerZone')}</Text>

          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: t.colors.border, opacity: removingCloud ? 0.6 : 1 }]}
            onPress={onRemoveCloudData}
            disabled={removingCloud}
          >
            <Text style={[styles.dangerBtnText, { color: t.colors.text }]}>{tr('settings.account.removeCloudData')}</Text>
          </TouchableOpacity>
          <Text style={[styles.dangerHint, { color: t.colors.textMuted }]}>{tr('settings.account.removeCloudDataHint')}</Text>

          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: t.colors.danger, marginTop: 12 }]}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={[styles.dangerBtnText, { color: t.colors.danger }]}>{tr('settings.account.deleteAccount')}</Text>
          </TouchableOpacity>
          <Text style={[styles.dangerHint, { color: t.colors.textMuted }]}>{tr('settings.account.deleteAccountHint')}</Text>

          {accountError && <Text style={[styles.errorText, { color: t.colors.danger }]}>{accountError}</Text>}
        </View>

        {deleteConfirmOpen && (
          <View style={[styles.confirmBox, { borderColor: t.colors.danger, backgroundColor: t.colors.backgroundSecondary }]}>
            <Text style={[styles.confirmTitle, { color: t.colors.text }]}>{tr('settings.account.deleteAccountConfirmTitle')}</Text>
            <Text style={[styles.confirmBody, { color: t.colors.textMuted }]}>{tr('settings.account.deleteAccountConfirmBody')}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setDeleteConfirmOpen(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: t.colors.danger, opacity: deletingAccount ? 0.6 : 1 }]}
                onPress={onDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>
                  {deletingAccount ? tr('settings.account.deletingAccount') : tr('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('settings.account.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={22} color={t.colors.textMuted} /></TouchableOpacity>
          </View>
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { gap: 12 },
  hint: { fontSize: 14, lineHeight: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  avatarText: { fontSize: 24, fontWeight: '700' },
  emailLabel: { textAlign: 'center', fontSize: 13, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 13, marginTop: 8 },
  signOutText: { fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 12, marginTop: -4 },
  link: { fontSize: 14, fontWeight: '600' },
  linkRowCenter: { alignItems: 'center', marginTop: 4 },
  linkCode: { fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 4, marginVertical: 12 },
  dangerZone: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  dangerZoneTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dangerBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },
  dangerHint: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  confirmBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, gap: 10 },
  confirmTitle: { fontSize: 15, fontWeight: '700' },
  confirmBody: { fontSize: 13, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors referencing `AccountSheet.tsx`. (Other files with lingering `.email`/`supabaseConfig` references are fixed in the next task — if the typechecker stops here, note the remaining error files and proceed to Task 13.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/AccountSheet.tsx
git commit -m "feat(ui): rewrite AccountSheet for passkey sign-up/sign-in + device linking"
```

---

## Task 13: Frontend — remaining screens' config references

**Corrected against the actual source** (an earlier draft of this task guessed at these files without reading them — verified during Task 2's implementation that `configured` is what gates the Account UI in `settings.tsx`/`index.tsx`. The Report tab and its `_layout.tsx`/`supabaseConfig` wiring were moved into Task 2 and are already gone by this point — nothing left to do for them here.)

**Files:**
- Modify: `app/(tabs)/settings.tsx` — drop `configured` from `useAuth()` destructuring (Task 9's `AuthProvider` no longer exposes it — the backend is always present in a self-hosted deploy), gate the Account section on `Platform.OS === 'web'` instead, fix the email reference.
- Modify: `app/(tabs)/index.tsx` — same `configured` → `Platform.OS === 'web'` change, add the `Platform` import, fix the email references.

- [ ] **Step 1: Fix `app/(tabs)/settings.tsx`**

Change:
```typescript
  const { session, loading, configured } = useAuth();
```
to:
```typescript
  const { session, loading } = useAuth();
```

Change:
```typescript
      {configured && (
```
to:
```typescript
      {Platform.OS === 'web' && (
```

Change:
```typescript
                  ? tr('settings.account.signedInAs', { email: session.user.email ?? '' })
```
to:
```typescript
                  ? tr('settings.account.signedInAs', { name: session.user.name })
```

`Platform` is already imported in this file (see its first import line), so no new import is needed here.

- [ ] **Step 2: Fix `app/(tabs)/index.tsx`**

Add `Platform` to the react-native import at the top of the file:
```typescript
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator, Platform } from 'react-native';
```

Change:
```typescript
  const { session, configured, displayName } = useAuth();
```
to:
```typescript
  const { session, displayName } = useAuth();
```

Change:
```typescript
          {configured && (
```
to:
```typescript
          {Platform.OS === 'web' && (
```

Change:
```typescript
              {session && (displayName ?? session.user.email) ? (
```
to:
```typescript
              {session && displayName ? (
```

Change:
```typescript
                    {(displayName ?? session.user.email ?? '?')[0].toUpperCase()}
```
to:
```typescript
                    {(displayName ?? '?')[0].toUpperCase()}
```

- [ ] **Step 3: Confirm no remaining references to the deleted concepts**

```bash
grep -rn "supabaseConfig\|session\.user\.email\|isValidEmail\|isValidPassword\|signInWithPassword\|sendPasswordReset\|\bsignUp\b\|bugReports\|tabs\.report" app src 2>/dev/null
```

Expected: no output. (`tabs.report` is the i18n key used only by the Report tab deleted in Task 2 — a later cleanup could remove it from `en.ts`/`es.ts`, but leaving an unused i18n key behind is harmless and out of scope here; this grep is checking for *code* references, not flagging the key itself.)

- [ ] **Step 4: Typecheck and test**

```bash
npm run typecheck
npm test
```

Expected: both pass. If `npm test` fails on a file not touched by this plan, stop and report it rather than patching around it blind — it means something outside this plan's scope broke.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: gate Account UI to web (backend is web-only for passkeys this pass), fix session field references"
```

---

## Task 14: docker-compose, web container, and docs

**Files:**
- Create: `web/Dockerfile`
- Create: `web/nginx.conf.template`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `docs/SELF_HOSTING.md`
- Delete: `wrangler.jsonc`, `public/_headers` (Cloudflare-specific, not used by this fork)

- [ ] **Step 1: Remove the Cloudflare-specific files (this fork serves via nginx, not Cloudflare Workers)**

```bash
rm wrangler.jsonc public/_headers
```

- [ ] **Step 2: `web/Dockerfile`**

```dockerfile
# Multi-stage: build the Expo web export, then serve it with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY . .
RUN npm run build:web

FROM nginx:alpine
COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV NGINX_PORT=80
ENV BACKEND=api
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
            CMD wget --spider -q "http://127.0.0.1:${NGINX_PORT}/" || exit 1
```

- [ ] **Step 3: `web/nginx.conf.template`**

```nginx
server {
  listen ${NGINX_PORT};

  # wa-sqlite (web SQLite VFS) needs the page cross-origin isolated.
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Embedder-Policy "require-corp" always;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://${BACKEND}:${PORT}/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cookie_path / /;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 4: `docker-compose.yml`**

```yaml
name: ttrp-helper-selfhosted

services:
  api:
    build: ./api
    restart: unless-stopped
    environment:
      - PORT=3000
      - DATA_DIR=/data
      - RP_ID=${RP_ID:-localhost}
      - ORIGIN=${ORIGIN:-http://localhost:8080}
      - RP_NAME=${RP_NAME:-TTRP Helper}
      - SESSION_DAYS=${SESSION_DAYS:-90}
    volumes:
      - ./data:/data   # users, passkeys, characters — BACK THIS UP

  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "${WEB_PORT:-8080}:${NGINX_PORT:-80}"
    environment:
      - NGINX_PORT=${NGINX_PORT:-80}
      - BACKEND=api
      - PORT=3000
```

- [ ] **Step 5: `.env.example`**

```bash
# Copy this file to ".env" and adjust for your setup, then: docker compose up -d --build
#
# ── Local testing (default) ────────────────────────────────────────────────
# Works out of the box on the machine running Docker. Open http://localhost:8080
# WebAuthn treats http://localhost as a secure context, so no HTTPS is needed here.
RP_ID=localhost
ORIGIN=http://localhost:8080
WEB_PORT=8080
RP_NAME=TTRP Helper

# ── Real deployment behind your own HTTPS domain ───────────────────────────
# Passkeys are bound to the exact hostname, and browsers only allow them over
# HTTPS (localhost is the one exception). Put this app behind a reverse proxy
# / tunnel that terminates TLS for your domain, then set:
#
#   RP_ID=characters.example.com
#   ORIGIN=https://characters.example.com
#   WEB_PORT=8080
#
# (Point your proxy at the web container's WEB_PORT.) Changing RP_ID after
# users have registered breaks their existing passkeys — treat it as a
# one-time decision made at first deploy.

# ── Session length (optional) ──────────────────────────────────────────────
# How long a signed-in session lasts before needing to sign in again.
#
#   SESSION_DAYS=90
```

- [ ] **Step 6: `docs/SELF_HOSTING.md`**

```markdown
# Self-Hosting

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:8080, then "Create account with passkey" to register.

## Adding a second device

On a device you're already signed in on: Account → "Add this device" shows a
6-digit code, valid for 5 minutes. On the new device, choose "I have a code
from another device," enter it, and create a passkey there — it joins the
same account instead of creating a new one.

## Backups

Everything lives in `./data`: `db.json` (accounts + passkey credentials) and
one `characters-<id>.json` per user. Back up that directory; there is no
database server to dump.

## Real deployments (your own domain)

Passkeys require HTTPS (except on `localhost`) and are bound to the exact
hostname in `RP_ID`. Put a reverse proxy / tunnel in front of this stack that
terminates TLS for your domain, point it at the `web` container's `WEB_PORT`,
then set `RP_ID` and `ORIGIN` in `.env` to match before anyone registers —
changing `RP_ID` later breaks existing passkeys.

## What this does *not* cover

- Native iOS/Android builds — passkey login is web-only for now. Native
  builds hide the Account tab entirely.
- Publishing anywhere — this is a local, self-built stack. `docker compose
  up --build` builds both images from source; nothing is pulled from a
  registry.

## Troubleshooting

**Characters don't sync / "signing in" spins forever.** Open your browser's
dev tools → Network tab and reload. If the page loads but `/api/*` requests
fail, the `web` container's nginx proxy isn't reaching `api` — check `docker
compose logs api`.

**Sync silently does nothing after signing in.** Check the Console tab for a
COOP/COEP-related error. The app's local database (`wa-sqlite`) needs the
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers the
`web` container sets — if you've put another proxy in front that strips
response headers, make sure it passes these two through.
```

- [ ] **Step 7: Full end-to-end build**

```bash
docker compose up -d --build
sleep 3
docker compose ps
curl -s http://localhost:8080/ | head -c 200
curl -s http://localhost:8080/api/health
```

Expected: both containers `running`/healthy; the first `curl` returns HTML; the second returns `{"ok":true,"users":0}`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(compose): docker-compose (api+web), nginx COOP/COEP + /api proxy, self-hosting docs"
```

---

## Task 15: Manual end-to-end verification (browser)

No new files — this task exercises the running stack from Task 14 and fixes anything it finds.

- [ ] **Step 1: Register the first account**

With `docker compose up` still running, open `http://localhost:8080` in a browser, go to Account, "Create account with passkey," complete the OS/browser passkey prompt. Confirm the sheet switches to the signed-in view showing the name you entered.

- [ ] **Step 2: Create a character and confirm it reaches the server**

Create any character in the app. Then:
```bash
cat data/characters-*.json
```
Expected: the file contains the character's `id`, `system`, `data`, and a `updated_at` timestamp, with `deleted_at: null`.

- [ ] **Step 3: Link a second "device" (a second browser or a private/incognito window)**

In the first (signed-in) window: Account → "Add this device," note the 6-digit code. In a second browser window: Account → "I have a code from another device," enter it, complete the passkey prompt. Confirm the second window shows the same account/name, and that the character from Step 2 appears in its character list after the app's normal pull-on-open sync runs.

- [ ] **Step 4: Delete a character on one window, confirm it disappears on the other**

Delete the character from window A. Reload window B. Confirm the character is gone (tombstoned, not still present).

- [ ] **Step 5: "Remove cloud data"**

Account → "Remove cloud data" → confirm. Check `data/characters-<uid>.json` again — every entry should now have a non-null `deleted_at`, and the app should have signed out.

- [ ] **Step 6: Sign back in and delete the account**

Sign in again (same passkey), Account → "Delete account" → confirm. Then:
```bash
cat data/db.json
```
Expected: the user and their credential(s) are gone from `db.json`, and the `characters-<uid>.json` file no longer exists.

- [ ] **Step 7: Export/import unaffected**

Signed out (or with a fresh account), create a character, export it to JSON (Settings → export), delete it locally, re-import the exported file. Confirm it's back. This exercises `src/lib/transfer.ts`, which this whole plan never touched — it's here as a regression check, not new work.

- [ ] **Step 8: If anything in Steps 1–7 failed, fix it now**

Common failure points to check first if something's wrong:
- Blank/broken app on load → check `docker compose logs web` for the `npm run build:web` step failing.
- Passkey prompt never appears → confirm you're on `http://localhost:8080` (not `127.0.0.1` — WebAuthn's secure-context exception is specifically for the string `localhost`).
- "verification failed" on register/login → `RP_ID`/`ORIGIN` in `.env` must match what's in the browser's address bar exactly (scheme + host + port for `ORIGIN`, bare hostname for `RP_ID`).

- [ ] **Step 9: Final commit (only if Step 8 required changes)**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end passkey/sync verification"
```

## Verification results (2026-08-28)

`docker compose up -d --build` from a clean state (`down -v` first): both containers reached `healthy`. Verified via browser (Claude's Browser pane) and `curl`:

- ✅ App loads at `http://localhost:8080`; tab bar shows exactly `Characters` / `Dice` / `Settings` (Report tab correctly absent).
- ✅ `curl /api/health` → `{"ok":true,"users":0}`; `curl /api/me` → 401 (proxy reaches `api` for a real authenticated route, not just the trivial health check).
- ✅ COOP/COEP headers present on `/`.
- ✅ AccountSheet renders all three signed-out modes correctly (start / enter-name / enter-link-code).
- ✅ `POST /api/register/options` returns 200 with a real WebAuthn challenge; the browser's `navigator.credentials.create()` call is correctly reached (network tab confirms the request fired) — this is as far as an **automated** browser can go without a platform authenticator (Touch ID / Windows Hello / security key / phone), which this sandboxed environment doesn't have. This is an inherent limitation of automated WebAuthn testing everywhere, not a defect here.
- ✅ Aborting mid-ceremony leaves no partial state — `db.json` doesn't exist until a registration actually completes (`register/verify` succeeds), confirmed by inspecting `./data` after the aborted attempt above.
- ✅ Device-link error path fully exercised (doesn't need a real authenticator to fail correctly): entering an invalid code shows "code expired or invalid" in the UI, sourced from a real `400` from `/api/passkey/link/exchange`.
- ✅ Core offline-first functionality unaffected by any of this fork's changes: created a character while signed out, reloaded the page, character persisted — confirms `wa-sqlite`/OPFS local storage works correctly through the new nginx COOP/COEP setup (the one gotcha called out in the design spec).
- ✅ No unexpected console errors — only the two errors from deliberately-triggered test cases above (401, 400).
- ⏭️ **Not completed, needs a human with a real device:** actually finishing a passkey registration/login (the biometric/security-key confirmation step), and therefore the multi-device linking flow and account-deletion flow that depend on having a real signed-in account. Everything up to that point is verified working; the remaining gap is a platform limitation of this environment, not application risk — WebAuthn is designed to require a human present for exactly this step.
