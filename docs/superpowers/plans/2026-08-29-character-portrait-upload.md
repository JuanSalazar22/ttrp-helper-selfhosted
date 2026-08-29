# Character Portrait Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload a photo for a character, crop it Facebook-style (pan/pinch inside a circular frame), see it on the sheet header, the D&D left column, and the character-list row — and have it follow the character to other signed-in devices via the self-hosted server.

**Architecture:** A pure crop-math module drives a hand-rolled Reanimated pan/pinch screen; `expo-image-manipulator` turns the final position into a saved 512×512 JPEG; the file is always saved locally first (works with zero account) and, when signed in, base64-uploaded to three new routes on the existing raw-`http` server, tracked by a new `portrait_updated_at` timestamp that flows through the existing character-list pull/reconcile cycle so other devices know to fetch it.

**Tech Stack:** `expo-image-picker` (existing), `expo-image-manipulator` (new dependency), `expo-file-system` (existing), Reanimated (existing), the existing hand-rolled `api/server.js`.

**Reference doc:** [2026-08-29-character-portrait-upload-design.md](../specs/2026-08-29-character-portrait-upload-design.md) (including its amendment)

**Working directory:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted`.

---

## Task 1: Local schema — `portrait_updated_at` column

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/types/index.ts`
- Modify: `src/db/queries.ts`
- Test: `src/db/__tests__/portrait.test.ts`

- [ ] **Step 1: Add the column via the existing backfill pattern**

In `src/db/schema.ts`, find:
```typescript
  // cloud_updated_at was added in Phase 3; backfill on older installs.
  try {
    await db.execAsync('ALTER TABLE characters ADD COLUMN cloud_updated_at TEXT;');
  } catch {
    // Column already exists — ignore.
  }
```
Add immediately after it:
```typescript

  // portrait_updated_at was added for portrait upload; backfill on older installs.
  try {
    await db.execAsync('ALTER TABLE characters ADD COLUMN portrait_updated_at TEXT;');
  } catch {
    // Column already exists — ignore.
  }
```

- [ ] **Step 2: Add the field to `CharacterRow`**

In `src/types/index.ts`, change:
```typescript
export type CharacterRow = {
  id: string;
  system: GameSystem;
  name: string;
  portrait_uri: string | null;
  data: string;
  schema_ver: number;
  created_at: number;
  updated_at: number;
};
```
to:
```typescript
export type CharacterRow = {
  id: string;
  system: GameSystem;
  name: string;
  portrait_uri: string | null;
  portrait_updated_at: string | null;
  data: string;
  schema_ver: number;
  created_at: number;
  updated_at: number;
};
```

- [ ] **Step 3: Write the failing test for the extended `updatePortrait`**

Create `src/db/__tests__/portrait.test.ts`:
```typescript
import * as SQLite from 'expo-sqlite';
import { initDatabase } from '../schema';
import { createCharacter, getCharacter, updatePortrait } from '../queries';
import { defaultWfrp4eCharacter } from '@/types/wfrp4e';

describe('updatePortrait', () => {
  async function freshDb() {
    const db = await SQLite.openDatabaseAsync(`test-${Math.random()}.db`);
    await initDatabase(db);
    return db;
  }

  it('sets portrait_uri and portrait_updated_at together', async () => {
    const db = await freshDb();
    const id = await createCharacter(db, 'wfrp4e', 'Test', defaultWfrp4eCharacter('Test'));
    await updatePortrait(db, id, 'file:///portraits/abc.jpg', '2026-08-29T00:00:00.000Z');
    const row = await getCharacter(db, id);
    expect(row?.portrait_uri).toBe('file:///portraits/abc.jpg');
    expect(row?.portrait_updated_at).toBe('2026-08-29T00:00:00.000Z');
  });

  it('clears both fields when uri is null (portrait removal)', async () => {
    const db = await freshDb();
    const id = await createCharacter(db, 'wfrp4e', 'Test', defaultWfrp4eCharacter('Test'));
    await updatePortrait(db, id, 'file:///portraits/abc.jpg', '2026-08-29T00:00:00.000Z');
    await updatePortrait(db, id, null, null);
    const row = await getCharacter(db, id);
    expect(row?.portrait_uri).toBeNull();
    expect(row?.portrait_updated_at).toBeNull();
  });

  it('defaults portrait_updated_at to null when not provided (local-only save, no account)', async () => {
    const db = await freshDb();
    const id = await createCharacter(db, 'wfrp4e', 'Test', defaultWfrp4eCharacter('Test'));
    await updatePortrait(db, id, 'file:///portraits/abc.jpg');
    const row = await getCharacter(db, id);
    expect(row?.portrait_uri).toBe('file:///portraits/abc.jpg');
    expect(row?.portrait_updated_at).toBeNull();
  });
});
```

- [ ] **Step 4: Run it, confirm it fails**

```bash
npx jest src/db/__tests__/portrait.test.ts
```
Expected: FAIL — `updatePortrait` doesn't accept a third argument yet, so the first two tests' `portrait_updated_at` assertions fail (third test passes already, since the current single-arg call just happens to leave it null).

- [ ] **Step 5: Extend `updatePortrait`**

In `src/db/queries.ts`, change:
```typescript
export async function updatePortrait(
  db: SQLite.SQLiteDatabase,
  id: string,
  uri: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE characters SET portrait_uri = ?, updated_at = ? WHERE id = ?',
    [uri, Date.now(), id]
  );
}
```
to:
```typescript
export async function updatePortrait(
  db: SQLite.SQLiteDatabase,
  id: string,
  uri: string | null,
  portraitUpdatedAt: string | null = null
): Promise<void> {
  await db.runAsync(
    'UPDATE characters SET portrait_uri = ?, portrait_updated_at = ?, updated_at = ? WHERE id = ?',
    [uri, portraitUpdatedAt, Date.now(), id]
  );
}
```

- [ ] **Step 6: Run the test again, confirm it passes**

```bash
npx jest src/db/__tests__/portrait.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 7: Extend `getCharacterSyncRefs` to expose the local portrait timestamp (needed by Task 8)**

In `src/db/queries.ts`, change:
```typescript
export async function getCharacterSyncRefs(
  db: SQLite.SQLiteDatabase,
): Promise<Array<{ id: string; cloud_updated_at: string | null }>> {
  return db.getAllAsync<{ id: string; cloud_updated_at: string | null }>(
    'SELECT id, cloud_updated_at FROM characters',
  );
}
```
to:
```typescript
export async function getCharacterSyncRefs(
  db: SQLite.SQLiteDatabase,
): Promise<Array<{ id: string; cloud_updated_at: string | null; portrait_updated_at: string | null }>> {
  return db.getAllAsync<{ id: string; cloud_updated_at: string | null; portrait_updated_at: string | null }>(
    'SELECT id, cloud_updated_at, portrait_updated_at FROM characters',
  );
}
```

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```
Expected: this surfaces every call site that destructures `LocalRef`-shaped objects from `getCharacterSyncRefs` — at this point in the plan, `src/hooks/useCharacterList.ts` builds a `LocalRef` (from `reconcile.ts`) that doesn't yet have a `portraitUpdatedAt` field, so this is expected to still be clean (the extra returned field is simply unused there until Task 8) — confirm no actual errors, just proceeding cleanly.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts src/types/index.ts src/db/queries.ts src/db/__tests__/portrait.test.ts
git commit -m "feat(portrait): portrait_updated_at column + updatePortrait/getCharacterSyncRefs support"
```

---

## Task 2: Crop math — pure function, TDD

**Files:**
- Create: `src/components/ui/portraitCropMath.ts`
- Test: `src/components/ui/__tests__/portraitCropMath.test.ts`

This is the pan/pinch clamping logic: given an image's natural size, a square frame size, and a proposed scale + translation, clamp so the image always fully covers the frame (can't zoom out past "fills the frame," can't pan an edge into view), then compute the final source-pixel crop rectangle to feed `expo-image-manipulator`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/__tests__/portraitCropMath.test.ts`:
```typescript
import { clampTransform, cropRectFor, MIN_SCALE_FOR } from '../portraitCropMath';

describe('MIN_SCALE_FOR', () => {
  it('is the scale at which the shorter image dimension exactly fills the frame', () => {
    // A 1000x2000 portrait image in a 300x300 frame: shorter side (1000) must
    // reach 300, so min scale is 300/1000 = 0.3.
    expect(MIN_SCALE_FOR(1000, 2000, 300)).toBeCloseTo(0.3);
    // A 2000x1000 landscape image in a 300x300 frame: shorter side (1000) must
    // reach 300, so min scale is 300/1000 = 0.3 too (shorter side always drives it).
    expect(MIN_SCALE_FOR(2000, 1000, 300)).toBeCloseTo(0.3);
  });
});

describe('clampTransform', () => {
  const frame = 300;
  const imageW = 1000;
  const imageH = 2000; // portrait image, min scale = 0.3

  it('clamps scale up to the minimum that fills the frame', () => {
    const r = clampTransform({ scale: 0.1, translateX: 0, translateY: 0 }, imageW, imageH, frame);
    expect(r.scale).toBeCloseTo(0.3);
  });

  it('leaves scale unchanged when already above the minimum', () => {
    const r = clampTransform({ scale: 0.5, translateX: 0, translateY: 0 }, imageW, imageH, frame);
    expect(r.scale).toBeCloseTo(0.5);
  });

  it('clamps translation so the image edge never enters the frame', () => {
    // At scale 0.3, scaled image is 300x600 — centered, it can pan at most
    // (600-300)/2 = 150 vertically before an edge shows; horizontally it's
    // already exactly the frame width, so translateX must clamp to 0.
    const r = clampTransform({ scale: 0.3, translateX: 999, translateY: 999 }, imageW, imageH, frame);
    expect(r.translateX).toBeCloseTo(0);
    expect(r.translateY).toBeCloseTo(150);
  });

  it('clamps negative translation symmetrically', () => {
    const r = clampTransform({ scale: 0.3, translateX: -999, translateY: -999 }, imageW, imageH, frame);
    expect(r.translateX).toBeCloseTo(0);
    expect(r.translateY).toBeCloseTo(-150);
  });
});

describe('cropRectFor', () => {
  it('maps a centered, minimum-scale transform to the full shorter-side square', () => {
    // 1000x2000 image, frame 300, scale 0.3 (fills width), no pan: the crop
    // should be the full width (1000) and a centered 1000-tall vertical slice.
    const rect = cropRectFor({ scale: 0.3, translateX: 0, translateY: 0 }, 1000, 2000, 300);
    expect(rect.originX).toBeCloseTo(0);
    expect(rect.originY).toBeCloseTo(500); // (2000 - 1000) / 2
    expect(rect.width).toBeCloseTo(1000);
    expect(rect.height).toBeCloseTo(1000);
  });

  it('shifts the crop origin opposite to a pan', () => {
    // Panning the image down by 30 screen px at scale 0.3 reveals more of the
    // top of the image — in source pixels that's translateY / scale = 100px,
    // shifting the crop's originY up (i.e. showing an earlier/higher region).
    const rect = cropRectFor({ scale: 0.3, translateX: 0, translateY: 30 }, 1000, 2000, 300);
    expect(rect.originY).toBeCloseTo(400); // 500 - (30 / 0.3)
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npx jest src/components/ui/__tests__/portraitCropMath.test.ts
```
Expected: FAIL — `Cannot find module '../portraitCropMath'`.

- [ ] **Step 3: Implement `portraitCropMath.ts`**

Create `src/components/ui/portraitCropMath.ts`:
```typescript
/** Pure math behind the pan/pinch crop screen (see PortraitCropper.tsx). All
 *  units are screen/frame pixels except where noted "source pixels" (the
 *  original image's own pixel grid, used only by cropRectFor). */

export type Transform = { scale: number; translateX: number; translateY: number };

/** The scale at which the image's SHORTER dimension exactly fills a square
 *  frame of the given size — the smallest scale allowed, so the image always
 *  fully covers the circular crop area with no gaps. */
export function MIN_SCALE_FOR(imageW: number, imageH: number, frame: number): number {
  return frame / Math.min(imageW, imageH);
}

/** Clamp a proposed transform so scale never drops below the frame-filling
 *  minimum, and translation never lets an image edge show inside the frame. */
export function clampTransform(t: Transform, imageW: number, imageH: number, frame: number): Transform {
  const minScale = MIN_SCALE_FOR(imageW, imageH, frame);
  const scale = Math.max(t.scale, minScale);
  const scaledW = imageW * scale;
  const scaledH = imageH * scale;
  const maxX = Math.max(0, (scaledW - frame) / 2);
  const maxY = Math.max(0, (scaledH - frame) / 2);
  return {
    scale,
    translateX: Math.min(maxX, Math.max(-maxX, t.translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, t.translateY)),
  };
}

/** Given a (clamped) transform, the square region of the ORIGINAL image (in
 *  its own source-pixel coordinates) that lands inside the frame — the input
 *  to expo-image-manipulator's crop action. */
export function cropRectFor(
  t: Transform,
  imageW: number,
  imageH: number,
  frame: number,
): { originX: number; originY: number; width: number; height: number } {
  const sourceSize = frame / t.scale;
  const centerX = imageW / 2 - t.translateX / t.scale;
  const centerY = imageH / 2 - t.translateY / t.scale;
  return {
    originX: centerX - sourceSize / 2,
    originY: centerY - sourceSize / 2,
    width: sourceSize,
    height: sourceSize,
  };
}
```

- [ ] **Step 4: Run the tests again, confirm they pass**

```bash
npx jest src/components/ui/__tests__/portraitCropMath.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/portraitCropMath.ts src/components/ui/__tests__/portraitCropMath.test.ts
git commit -m "feat(portrait): pan/pinch crop clamping + crop-rect math"
```

---

## Task 3: Local portrait file storage

**Files:**
- Create: `src/lib/portraitStorage.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/portraitStorage.ts`:
```typescript
import * as FileSystem from 'expo-file-system';

const DIR = `${FileSystem.documentDirectory}portraits/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** Copy a (already-cropped) image file into this app's own storage, named by
 *  character id so re-saving a character's portrait overwrites the old file
 *  instead of leaking one per upload. Returns the resulting local file URI. */
export async function saveLocalPortrait(characterId: string, sourceUri: string): Promise<string> {
  await ensureDir();
  const dest = `${DIR}${characterId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deleteLocalPortrait(characterId: string): Promise<void> {
  const path = `${DIR}${characterId}.jpg`;
  try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch { /* already gone */ }
}

/** Base64 contents of a character's locally-cached portrait, for uploading —
 *  null if there's no local file (e.g. offline device that hasn't cached the
 *  cloud copy yet). */
export async function readLocalPortraitBase64(characterId: string): Promise<string | null> {
  const path = `${DIR}${characterId}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: clean (`expo-file-system` is already a project dependency).

- [ ] **Step 3: Commit**

```bash
git add src/lib/portraitStorage.ts
git commit -m "feat(portrait): local portrait file storage helpers"
```

---

## Task 4: Server routes — upload, fetch, delete, cleanup

**Files:**
- Modify: `api/server.js`

- [ ] **Step 1: Read the current file in full before editing**

```bash
cat -n api/server.js
```
(No inline diff shown here for the read — this file uses a hand-rolled router; get exact current line numbers before editing, since they've shifted from what earlier exploration saw.)

- [ ] **Step 2: Add a portraits directory helper and size cap, near the existing `charsFile` helper**

Find:
```javascript
const charsFile = (uid) => path.join(DATA, 'characters-' + uid.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
```
Add immediately after it:
```javascript
const PORTRAIT_MAX_BASE64 = 3 * 1024 * 1024; // ~3MB base64 — generous for a 512x512 JPEG (typically tens of KB)
const portraitsDir = (uid) => path.join(DATA, 'portraits', uid.replace(/[^a-zA-Z0-9_-]/g, ''));
const portraitFile = (uid, id) => path.join(portraitsDir(uid), id.replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg');
function deletePortraitFile(uid, id) {
  try { fs.unlinkSync(portraitFile(uid, id)); } catch { /* none to delete */ }
}
```

- [ ] **Step 3: Add the three portrait routes as pattern-matched handlers in the request listener**

These can't live in the `routes` object (which is keyed by fixed `'METHOD /path'` strings) since `:id` varies — like the existing tombstone-delete route, they're pattern-matched directly in the request listener via `charIdFromPath`.

Find this existing block (the tombstone-delete route):
```javascript
  if (req.method === 'POST' && charIdFromPath(url.pathname, '/delete') !== null) {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const id = charIdFromPath(url.pathname, '/delete');
    const list = readChars(user.id);
    const row = list.find((c) => c.id === id);
    if (row) { row.deleted_at = new Date().toISOString(); saveChars(user.id, list); }
```
and find where that block ends (its closing `}` followed by whatever comes next — read the file to find the exact end, since the earlier exploration only saw the start of it). Add the following three blocks immediately after that block ends, still inside the same request listener function, before the final `routes[key]` dispatch fallback:

```javascript
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
```

- [ ] **Step 4: Clean up portrait files on character delete, clear, and account delete**

Find:
```javascript
    if (row) { row.deleted_at = new Date().toISOString(); saveChars(user.id, list); }
```
(the tombstone-delete route body) and add right after it, still inside that same `if` block:
```javascript
    deletePortraitFile(user.id, id);
```

Find `'POST /api/characters/clear'`'s handler body:
```javascript
  'POST /api/characters/clear': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const now = new Date().toISOString();
    const list = readChars(user.id).map((c) => ({ ...c, deleted_at: now }));
    saveChars(user.id, list);
    json(res, 200, { ok: true });
  },
```
Change it to also remove every portrait file for that user:
```javascript
  'POST /api/characters/clear': async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const now = new Date().toISOString();
    const list = readChars(user.id).map((c) => ({ ...c, deleted_at: now }));
    for (const c of list) deletePortraitFile(user.id, c.id);
    saveChars(user.id, list);
    json(res, 200, { ok: true });
  },
```

Find `'POST /api/account/delete'`'s handler body:
```javascript
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
Change it to also remove the user's whole portraits directory:
```javascript
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
```

- [ ] **Step 5: Manual verification (this server has no existing test suite to extend — confirm that's still true before assuming so)**

```bash
ls api/*.test.js api/__tests__ 2>/dev/null
```
If nothing is found (expected — confirm rather than assume), verify manually instead:
```bash
cd api && node server.js &
sleep 1
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/register/options -H 'content-type: application/json' -d '{"name":"Test"}'
```
This first call won't complete a full passkey registration (that needs a real WebAuthn authenticator) — instead, verify the new routes reject unauthenticated requests correctly, which doesn't need a session:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT http://localhost:3000/api/characters/fake-id/portrait -H 'content-type: application/json' -d '{"image":"data:image/jpeg;base64,Zm9v"}'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/characters/fake-id/portrait
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:3000/api/characters/fake-id/portrait
```
Expected: all three print `401` (not signed in). Then stop the server:
```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add api/server.js
git commit -m "feat(portrait): server routes for portrait upload, fetch, delete + cleanup on character/account delete"
```

---

## Task 5: Client API + cloud sync functions

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/sync/cloudCharacters.ts`

- [ ] **Step 1: Add portrait functions to `src/lib/api.ts`**

Add at the end of the file:
```typescript

export async function putCharacterPortrait(id: string, base64Jpeg: string): Promise<{ portrait_updated_at: string } | null> {
  const res = await apiFetch(`/characters/${encodeURIComponent(id)}/portrait`, {
    method: 'PUT',
    body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Jpeg}` }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getCharacterPortraitBase64(id: string): Promise<string | null> {
  const res = await apiFetch(`/characters/${encodeURIComponent(id)}/portrait`);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  // btoa/Buffer both work here; Buffer is available in the RN/Node/web runtimes this app targets.
  return Buffer.from(buf).toString('base64');
}

export async function deleteCharacterPortrait(id: string): Promise<void> {
  await apiFetch(`/characters/${encodeURIComponent(id)}/portrait`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Add matching cloud-sync wrappers to `src/sync/cloudCharacters.ts`**

Add at the end of the file:
```typescript

/** Upload a character's local portrait to the cloud. No-op when signed out;
 *  never throws — callers enqueue the character id in the outbox on failure,
 *  the same way a failed character-data push is retried. */
export async function pushPortrait(session: Session, id: string, base64Jpeg: string): Promise<{ ok: boolean; portraitUpdatedAt?: string }> {
  if (!session) return { ok: true };
  const result = await api.putCharacterPortrait(id, base64Jpeg);
  if (!result) { console.warn('[sync] portrait push failed'); return { ok: false }; }
  return { ok: true, portraitUpdatedAt: result.portrait_updated_at };
}

/** Fetch a character's portrait from the cloud as base64, or null if signed out,
 *  not found, or the request fails. */
export async function pullPortrait(session: Session, id: string): Promise<string | null> {
  if (!session) return null;
  return api.getCharacterPortraitBase64(id);
}

/** Tell the cloud to delete a character's portrait (mirrors softDeleteCharacterCloud's
 *  no-op-when-signed-out, never-throw shape). */
export async function deletePortraitCloud(session: Session, id: string): Promise<void> {
  if (!session) return;
  await api.deleteCharacterPortrait(id);
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/sync/cloudCharacters.ts
git commit -m "feat(portrait): client API + cloud sync functions for portrait upload/fetch/delete"
```

---

## Task 6: `needsPortraitPull` — pure function, TDD

**Files:**
- Modify: `src/sync/reconcile.ts`
- Modify: `src/sync/__tests__/reconcile.test.ts`

- [ ] **Step 1: Read the existing test file first**

```bash
cat -n src/sync/__tests__/reconcile.test.ts
```
Match its existing style (Jest `describe`/`it`, no mocking needed — these are pure functions) for the new tests below.

- [ ] **Step 2: Write the failing tests**

Add to `src/sync/__tests__/reconcile.test.ts`:
```typescript
import { needsPortraitPull } from '../reconcile';

describe('needsPortraitPull', () => {
  it('is false when neither side has a portrait', () => {
    expect(needsPortraitPull(null, null)).toBe(false);
  });

  it('is true when the cloud has a portrait and the local side has none', () => {
    expect(needsPortraitPull(null, '2026-08-29T00:00:00.000Z')).toBe(true);
  });

  it('is true when the cloud portrait is newer than the local one', () => {
    expect(needsPortraitPull('2026-08-28T00:00:00.000Z', '2026-08-29T00:00:00.000Z')).toBe(true);
  });

  it('is false when local is already up to date with cloud', () => {
    expect(needsPortraitPull('2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z')).toBe(false);
  });

  it('is false when the cloud has no portrait (removed) even if local still has one — removal is handled separately, this only decides whether to FETCH', () => {
    expect(needsPortraitPull('2026-08-29T00:00:00.000Z', null)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests, confirm they fail**

```bash
npx jest src/sync/__tests__/reconcile.test.ts
```
Expected: FAIL — `needsPortraitPull` is not exported from `../reconcile`.

- [ ] **Step 4: Add the field to `CloudCharacter` and implement `needsPortraitPull`**

In `src/sync/reconcile.ts`, change:
```typescript
export type CloudCharacter = {
  id: string;
  system: string;
  data: any; // jsonb → JS object (the per-character JSON)
  updated_at: string; // ISO timestamp
  deleted_at: string | null;
};
```
to:
```typescript
export type CloudCharacter = {
  id: string;
  system: string;
  data: any; // jsonb → JS object (the per-character JSON)
  updated_at: string; // ISO timestamp
  deleted_at: string | null;
  portrait_updated_at: string | null;
};
```

Add at the end of the file:
```typescript

/** Whether a device needs to fetch the cloud's portrait: cloud has one and it's
 *  either missing locally or newer than what's locally recorded. Removal (cloud
 *  went from having one to not) is a separate concern handled where this is
 *  called — this only ever says "go fetch," never "go delete." */
export function needsPortraitPull(localPortraitUpdatedAt: string | null, cloudPortraitUpdatedAt: string | null): boolean {
  if (!cloudPortraitUpdatedAt) return false;
  if (!localPortraitUpdatedAt) return true;
  return cloudPortraitUpdatedAt !== localPortraitUpdatedAt;
}
```

- [ ] **Step 5: Run the tests again, confirm they pass**

```bash
npx jest src/sync/__tests__/reconcile.test.ts
```
Expected: PASS (all tests in the file, including the 5 new ones).

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: clean — `CloudCharacter`'s new required field will surface any place a `CloudCharacter` literal is constructed without it; there are two known spots this plan updates later (Task 4's server responses flow through untyped JSON, and any test fixtures) — if typecheck shows a fixture object missing the field in an existing test, add `portrait_updated_at: null` to it before proceeding, since that's the correct value for "no portrait."

- [ ] **Step 7: Commit**

```bash
git add src/sync/reconcile.ts src/sync/__tests__/reconcile.test.ts
git commit -m "feat(portrait): needsPortraitPull + portrait_updated_at on CloudCharacter"
```

---

## Task 7: Wire portrait pull into `useCharacterList`'s existing reconcile cycle

**Files:**
- Modify: `src/hooks/useCharacterList.ts`

- [ ] **Step 1: Add the imports**

At the top of `src/hooks/useCharacterList.ts`, change:
```typescript
import { pullCharacters, softDeleteCharacterCloud } from '@/sync/cloudCharacters';
import { reconcilePull, cloudRowToLocalParams, type LocalRef } from '@/sync/reconcile';
```
to:
```typescript
import { pullCharacters, softDeleteCharacterCloud, pullPortrait } from '@/sync/cloudCharacters';
import { reconcilePull, cloudRowToLocalParams, needsPortraitPull, type LocalRef } from '@/sync/reconcile';
import { saveLocalPortrait } from '@/lib/portraitStorage';
```

- [ ] **Step 2: Extend the local ref map with the local portrait timestamp**

Change:
```typescript
      const cloud = await pullCharacters(session);
      const refs = await queries.getCharacterSyncRefs(db);
      const localMap = new Map<string, LocalRef>(
        refs.map(r => [r.id, { id: r.id, cloudUpdatedAt: r.cloud_updated_at }]),
      );
      const actions = reconcilePull(localMap, cloud);
      if (actions.length === 0) return;
      for (const a of actions) {
        if (cancelled) return;
        if (a.kind === 'delete') {
          await queries.deleteCharacter(db, a.id);
        } else {
          const p = cloudRowToLocalParams(a.row);
          await queries.upsertLocalCharacter(db, { ...p, cloudUpdatedAt: a.row.updated_at });
        }
      }
      if (!cancelled) await refresh();
```
to:
```typescript
      const cloud = await pullCharacters(session);
      const refs = await queries.getCharacterSyncRefs(db);
      const localPortraitMap = new Map(refs.map(r => [r.id, r.portrait_updated_at]));
      const localMap = new Map<string, LocalRef>(
        refs.map(r => [r.id, { id: r.id, cloudUpdatedAt: r.cloud_updated_at }]),
      );
      const actions = reconcilePull(localMap, cloud);
      if (actions.length > 0) {
        for (const a of actions) {
          if (cancelled) return;
          if (a.kind === 'delete') {
            await queries.deleteCharacter(db, a.id);
          } else {
            const p = cloudRowToLocalParams(a.row);
            await queries.upsertLocalCharacter(db, { ...p, cloudUpdatedAt: a.row.updated_at });
          }
        }
      }
      // Independent of insert/update/delete: any cloud row with a newer portrait
      // than what this device has cached gets fetched and saved locally. This
      // runs for every non-deleted cloud row, not just ones reconcilePull acted
      // on, since a character's DATA can be unchanged while its portrait isn't.
      for (const c of cloud) {
        if (cancelled) return;
        if (c.deleted_at) continue;
        if (!needsPortraitPull(localPortraitMap.get(c.id) ?? null, c.portrait_updated_at)) continue;
        const base64 = await pullPortrait(session, c.id);
        if (!base64 || cancelled) continue;
        const tempPath = `${FileSystem.cacheDirectory}pulled-portrait-${c.id}.jpg`;
        await FileSystem.writeAsStringAsync(tempPath, base64, { encoding: FileSystem.EncodingType.Base64 });
        const localUri = await saveLocalPortrait(c.id, tempPath);
        await queries.updatePortrait(db, c.id, localUri, c.portrait_updated_at);
      }
      if (!cancelled) await refresh();
```

- [ ] **Step 3: Add the `expo-file-system` import**

At the top of the file, add:
```typescript
import * as FileSystem from 'expo-file-system';
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCharacterList.ts
git commit -m "feat(portrait): pull newer cloud portraits during the existing character reconcile cycle"
```

---

## Task 8: `useCharacter` gains `setPortrait`; outbox drain retries portrait pushes too

**Files:**
- Modify: `src/hooks/useCharacter.ts`
- Modify: `src/sync/SyncProvider.tsx`

- [ ] **Step 1: Add the imports**

Change:
```typescript
import { getCharacter, updateCharacter } from '@/db/queries';
```
to:
```typescript
import { getCharacter, updateCharacter, updatePortrait } from '@/db/queries';
import { useAuth } from '@/auth/AuthProvider';
import { saveLocalPortrait, deleteLocalPortrait, readLocalPortraitBase64 } from '@/lib/portraitStorage';
import { pushPortrait, deletePortraitCloud } from '@/sync/cloudCharacters';
import { enqueue } from '@/sync/outbox';
```

- [ ] **Step 2: Add `setPortrait` to the hook, and expose `row`**

Change:
```typescript
export function useCharacter(id: string) {
  const db = useSQLiteContext();
  const { pushNow } = useSync();
  const [row, setRow] = useState<CharacterRow | null>(null);
```
to:
```typescript
export function useCharacter(id: string) {
  const db = useSQLiteContext();
  const { pushNow } = useSync();
  const { session } = useAuth();
  const [row, setRow] = useState<CharacterRow | null>(null);
```

Add this new function inside the hook, after `flush` and before the `return`:
```typescript
  /** Save a newly-cropped portrait: always locally (works with no account), and
   *  to the cloud when signed in — enqueuing a retry via the existing outbox on
   *  upload failure, same as a failed character-data push. Pass `croppedUri`
   *  null to remove the portrait instead. */
  const setPortrait = useCallback(async (croppedUri: string | null) => {
    if (croppedUri === null) {
      await deleteLocalPortrait(id);
      await updatePortrait(db, id, null, null);
      setRow(prev => prev ? { ...prev, portrait_uri: null, portrait_updated_at: null } : prev);
      void deletePortraitCloud(session, id);
      return;
    }
    const localUri = await saveLocalPortrait(id, croppedUri);
    await updatePortrait(db, id, localUri, null);
    setRow(prev => prev ? { ...prev, portrait_uri: localUri, portrait_updated_at: null } : prev);
    const base64 = await readLocalPortraitBase64(id);
    if (!base64) return;
    const { ok, portraitUpdatedAt } = await pushPortrait(session, id, base64);
    if (!ok) { enqueue(id); return; }
    if (portraitUpdatedAt) {
      await updatePortrait(db, id, localUri, portraitUpdatedAt);
      setRow(prev => prev ? { ...prev, portrait_updated_at: portraitUpdatedAt } : prev);
    }
  }, [db, id, session]);
```

Change the `return` statement:
```typescript
  return { row, data, loading, saving, patch, flush };
```
to:
```typescript
  return { row, data, loading, saving, patch, flush, setPortrait };
```

- [ ] **Step 3: Wire the outbox drain to also retry a pending portrait push**

`setPortrait`'s failure path above calls the existing `enqueue(id)` — but `SyncProvider.tsx`'s `drain()` only re-pushes character *data* for a queued id today, so a failed portrait upload would sit in the outbox forever without this step. `drain()` already re-pushes character data unconditionally for every queued id (it doesn't track exactly what changed) — extend it to also unconditionally re-attempt a portrait push for any queued id that has a local portrait file, the same "just try again, it's idempotent" way.

In `src/sync/SyncProvider.tsx`, change:
```typescript
import { pushCharacter } from '@/sync/cloudCharacters';
```
to:
```typescript
import { pushCharacter, pushPortrait } from '@/sync/cloudCharacters';
import { readLocalPortraitBase64 } from '@/lib/portraitStorage';
import { updatePortrait } from '@/db/queries';
```

Change:
```typescript
  const drain = useCallback(async () => {
    if (!session) return;
    for (const id of dequeueAll()) {
      const row = await getCharacter(db, id);
      if (!row) continue;
      inFlight.current++; recompute();
      const { ok } = await pushCharacter(db, session, { id, system: row.system, data: JSON.parse(row.data) });
      inFlight.current--;
      if (!ok) enqueue(id);
      recompute();
    }
  }, [db, session, recompute]);
```
to:
```typescript
  const drain = useCallback(async () => {
    if (!session) return;
    for (const id of dequeueAll()) {
      const row = await getCharacter(db, id);
      if (!row) continue;
      inFlight.current++; recompute();
      const { ok } = await pushCharacter(db, session, { id, system: row.system, data: JSON.parse(row.data) });
      inFlight.current--;
      if (!ok) enqueue(id);

      // A queued id might also have a portrait that failed to push (setPortrait
      // enqueues the same id on portrait failure as on data failure) — retry it
      // too. Re-uploading an already-synced portrait is harmless, so this runs
      // unconditionally rather than tracking exactly which failure queued the id.
      if (row.portrait_uri) {
        const base64 = await readLocalPortraitBase64(id);
        if (base64) {
          const portraitResult = await pushPortrait(session, id, base64);
          if (portraitResult.ok && portraitResult.portraitUpdatedAt) {
            await updatePortrait(db, id, row.portrait_uri, portraitResult.portraitUpdatedAt);
          } else if (!portraitResult.ok) {
            enqueue(id);
          }
        }
      }
      recompute();
    }
  }, [db, session, recompute]);
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCharacter.ts src/sync/SyncProvider.tsx
git commit -m "feat(portrait): useCharacter exposes setPortrait; outbox drain also retries pending portrait pushes"
```

---

## Task 9: Add `expo-image-manipulator` and build the crop screen

**Files:**
- Modify: `package.json` (new dependency)
- Create: `src/components/ui/PortraitCropper.tsx`

- [ ] **Step 1: Install the dependency**

```bash
npx expo install expo-image-manipulator
```
Expected: adds `expo-image-manipulator` to `package.json` at a version matching this project's Expo SDK (`npx expo install` resolves the compatible version automatically — don't hand-pick a version number).

- [ ] **Step 2: Write the crop screen component**

Create `src/components/ui/PortraitCropper.tsx`:
```typescript
import { useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { clampTransform, cropRectFor } from './portraitCropMath';

const FRAME = Math.min(300, Dimensions.get('window').width - 48);
const OUTPUT_SIZE = 512;

type Props = {
  visible: boolean;
  sourceUri: string | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
};

/** Facebook-style pan/pinch crop: drag and pinch a picked photo inside a fixed
 *  circular frame, then confirm to produce a square JPEG of what's inside it.
 *  Math lives in portraitCropMath.ts (pure, unit-tested) — this component is
 *  just gesture wiring + the final expo-image-manipulator call. */
export function PortraitCropper({ visible, sourceUri, onCancel, onConfirm }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0 });

  if (sourceUri && imageSize.w === 1) {
    Image.getSize(sourceUri, (w, h) => setImageSize({ w, h }));
  }

  function clamp() {
    'worklet';
    const next = clampTransform(
      { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
      imageSize.w, imageSize.h, FRAME,
    );
    scale.value = next.scale;
    translateX.value = next.translateX;
    translateY.value = next.translateY;
  }

  const pan = Gesture.Pan()
    .onStart(() => { start.value = { scale: scale.value, x: translateX.value, y: translateY.value }; })
    .onUpdate((e) => {
      translateX.value = start.value.x + e.translationX;
      translateY.value = start.value.y + e.translationY;
    })
    .onEnd(() => { clamp(); });

  const pinch = Gesture.Pinch()
    .onStart(() => { start.value = { scale: scale.value, x: translateX.value, y: translateY.value }; })
    .onUpdate((e) => { scale.value = start.value.scale * e.scale; })
    .onEnd(() => { clamp(); });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  async function confirm() {
    if (!sourceUri) return;
    const rect = cropRectFor(
      { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
      imageSize.w, imageSize.h, FRAME,
    );
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ crop: rect }, { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    onConfirm(result.uri);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <View style={styles.frameWrap}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.frame, { width: FRAME, height: FRAME, borderRadius: FRAME / 2 }]}>
              {sourceUri && (
                <Animated.Image
                  source={{ uri: sourceUri }}
                  style={[{ width: FRAME, height: FRAME }, style]}
                  resizeMode="cover"
                />
              )}
            </View>
          </GestureDetector>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onCancel} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: t.colors.textSecondary }]}>{tr('common.cropCancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirm} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: t.colors.accent, fontWeight: '700' }]}>{tr('common.cropConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { overflow: 'hidden', borderRadius: FRAME / 2 },
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 40, marginTop: 32 },
  actionBtn: { padding: 12 },
  actionText: { fontSize: 16 },
});
```

- [ ] **Step 3: Check `react-native-gesture-handler` is already a dependency (Reanimated typically pairs with it)**

```bash
grep -n "react-native-gesture-handler" package.json
```
If not found, install it:
```bash
npx expo install react-native-gesture-handler
```
And confirm the app's root already wraps in `GestureHandlerRootView` (check `app/_layout.tsx`):
```bash
grep -n "GestureHandlerRootView" app/_layout.tsx
```
If missing, this is a real gap to fix as part of this task — report it rather than silently skipping gesture support; wrap the root layout's return value in `<GestureHandlerRootView style={{ flex: 1 }}>...</GestureHandlerRootView>` (import from `react-native-gesture-handler`) if not already present.

- [ ] **Step 4: Add the two new i18n keys**

In `src/i18n/en.ts`, find the `common` section (where `portraitPlaceholder` already lives) and add two keys alongside it:
```typescript
    cropCancel: 'Cancel',
    cropConfirm: 'Use Photo',
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/PortraitCropper.tsx src/i18n/en.ts app/_layout.tsx
git commit -m "feat(portrait): pan/pinch crop screen (expo-image-manipulator)"
```
(Only include `app/_layout.tsx` in the commit if Step 3 actually changed it.)

---

## Task 10: Wire `CharacterPortrait.tsx` for real — picker, crop, display, remove

**Files:**
- Modify: `src/components/ui/CharacterPortrait.tsx`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Add the new i18n keys**

In `src/i18n/en.ts`'s `common` section, add:
```typescript
    changePhoto: 'Change photo',
    removePhoto: 'Remove photo',
    addPhoto: 'Add photo',
```

- [ ] **Step 2: Rewrite the component**

Replace the full contents of `src/components/ui/CharacterPortrait.tsx`:
```typescript
import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { UserRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { PortraitCropper } from './PortraitCropper';

type Props = {
  /** 'lg' (default) is the full block shown atop the left column in wide layout.
   *  'sm' is a small tappable thumbnail (e.g. next to the name in the header). */
  size?: 'sm' | 'lg';
  portraitUri: string | null;
  onChange: (croppedUri: string | null) => void;
};

/** Portrait: shows the character's photo if set, otherwise a placeholder.
 *  Tapping opens the library picker (no photo yet) or a change/remove menu
 *  (photo already set). Picking a photo opens PortraitCropper before it's saved. */
export function CharacterPortrait({ size = 'lg', portraitUri, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    setPickedUri(result.assets[0].uri);
  }

  function handlePress() {
    if (size === 'sm' && !portraitUri) return void pickPhoto();
    if (size === 'sm' && portraitUri) return openMenu();
    setExpanded(true);
  }

  function openMenu() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [tr('common.changePhoto'), tr('common.removePhoto'), tr('common.cropCancel')], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (index) => { if (index === 0) pickPhoto(); else if (index === 1) onChange(null); },
      );
    } else {
      Alert.alert(tr('common.changePhoto'), undefined, [
        { text: tr('common.changePhoto'), onPress: pickPhoto },
        { text: tr('common.removePhoto'), style: 'destructive', onPress: () => onChange(null) },
        { text: tr('common.cropCancel'), style: 'cancel' },
      ]);
    }
  }

  const placeholder = (
    <View style={[styles.frame, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
      <UserRound size={56} color={t.colors.textMuted} />
      <Text style={[styles.label, { color: t.colors.textMuted }]}>{tr('common.addPhoto')}</Text>
    </View>
  );

  const content = portraitUri
    ? <Image source={{ uri: portraitUri }} style={styles.frame} />
    : placeholder;

  return (
    <>
      {size === 'lg' ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => portraitUri ? openMenu() : pickPhoto()}>
          {content}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.thumb, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
            onPress={handlePress}
            activeOpacity={0.7}
            accessibilityLabel={portraitUri ? tr('common.changePhoto') : tr('common.addPhoto')}
          >
            {portraitUri ? <Image source={{ uri: portraitUri }} style={styles.thumbImage} /> : <UserRound size={20} color={t.colors.textMuted} />}
          </TouchableOpacity>
          <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
            <View style={styles.overlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setExpanded(false)} />
              {content}
            </View>
          </Modal>
        </>
      )}
      <PortraitCropper
        visible={pickedUri !== null}
        sourceUri={pickedUri}
        onCancel={() => setPickedUri(null)}
        onConfirm={(croppedUri) => { setPickedUri(null); onChange(croppedUri); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  label: { fontSize: 12, fontWeight: '600' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
```

Note: when `portraitUri` is set, the 'lg' frame renders an actual photo inside a dashed-bordered box shaped for a *placeholder* (`borderStyle: 'dashed'`) — this is a known rough edge to tidy in Task 12's manual pass (e.g. drop the dashed border once a real photo is showing) rather than something to solve blindly here without seeing it rendered.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: errors at every call site of `<CharacterPortrait>` (they don't pass the new required `portraitUri`/`onChange` props yet) — this is expected and fixed in Task 11. Confirm the errors are ONLY at those call sites, nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CharacterPortrait.tsx src/i18n/en.ts
git commit -m "feat(portrait): CharacterPortrait renders real photos, supports pick/change/remove"
```

---

## Task 11: Thread portrait props through to `CharacterPortrait`'s call sites

**Files:**
- Modify: `app/character/[id].tsx`
- Modify: `src/components/dnd5e/Dnd5eSheet.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eHeader.tsx`

- [ ] **Step 1: `app/character/[id].tsx` — destructure `row`/`setPortrait`, pass them down**

Change:
```typescript
  const { data, loading, saving, patch } = useCharacter(id);
```
to:
```typescript
  const { row, data, loading, saving, patch, setPortrait } = useCharacter(id);
```

Change:
```typescript
      {data.system === 'dnd5e'
        ? <Dnd5eSheet character={data as Dnd5eCharacter} onChange={(p) => patch(p)} />
        : <Wfrp4eSheet character={data as Wfrp4eCharacter} onChange={(p) => patch(p)} />}
```
to:
```typescript
      {data.system === 'dnd5e'
        ? <Dnd5eSheet character={data as Dnd5eCharacter} onChange={(p) => patch(p)} portraitUri={row?.portrait_uri ?? null} onPortraitChange={setPortrait} />
        : <Wfrp4eSheet character={data as Wfrp4eCharacter} onChange={(p) => patch(p)} portraitUri={row?.portrait_uri ?? null} onPortraitChange={setPortrait} />}
```

- [ ] **Step 2: `Dnd5eSheet.tsx` — accept and pass through the new props**

Change:
```typescript
type Props = {
  character: Dnd5eCharacter;
  onChange: (patch: Partial<Dnd5eCharacter>) => void;
};

export function Dnd5eSheet({ character, onChange }: Props) {
```
to:
```typescript
type Props = {
  character: Dnd5eCharacter;
  onChange: (patch: Partial<Dnd5eCharacter>) => void;
  portraitUri: string | null;
  onPortraitChange: (croppedUri: string | null) => void;
};

export function Dnd5eSheet({ character, onChange, portraitUri, onPortraitChange }: Props) {
```

Change:
```typescript
  const left = [<CharacterPortrait key="portrait" />, s.ability, s.saves, s.skills, s.features];
```
to:
```typescript
  const left = [<CharacterPortrait key="portrait" portraitUri={portraitUri} onChange={onPortraitChange} />, s.ability, s.saves, s.skills, s.features];
```

- [ ] **Step 3: `Wfrp4eSheet.tsx` — accept and pass through the new props**

Change:
```typescript
type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

export function Wfrp4eSheet({ character, onChange }: Props) {
```
to:
```typescript
type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  portraitUri: string | null;
  onPortraitChange: (croppedUri: string | null) => void;
};

export function Wfrp4eSheet({ character, onChange, portraitUri, onPortraitChange }: Props) {
```

Change:
```typescript
      <Wfrp4eHeader character={character} onChange={onChange} />
```
to:
```typescript
      <Wfrp4eHeader character={character} onChange={onChange} portraitUri={portraitUri} onPortraitChange={onPortraitChange} />
```

- [ ] **Step 4: `Wfrp4eHeader.tsx` — accept the props and use them**

Change:
```typescript
type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};
```
to:
```typescript
type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  portraitUri: string | null;
  onPortraitChange: (croppedUri: string | null) => void;
};
```

Change:
```typescript
export function Wfrp4eHeader({ character, onChange }: Props) {
```
to:
```typescript
export function Wfrp4eHeader({ character, onChange, portraitUri, onPortraitChange }: Props) {
```

Change:
```typescript
        <CharacterPortrait size="sm" />
```
to:
```typescript
        <CharacterPortrait size="sm" portraitUri={portraitUri} onChange={onPortraitChange} />
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: clean — this resolves every error Task 10 left behind.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```
Expected: all passing, no regressions.

- [ ] **Step 7: Commit**

```bash
git add app/character/\[id\].tsx src/components/dnd5e/Dnd5eSheet.tsx src/components/wfrp4e/Wfrp4eSheet.tsx src/components/wfrp4e/Wfrp4eHeader.tsx
git commit -m "feat(portrait): thread portraitUri/onPortraitChange from the character screen down to CharacterPortrait"
```

---

## Task 12: Character-list row avatar

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Read the current `CharacterCard` styles block in full**

```bash
grep -n "^const styles" -A80 "app/(tabs)/index.tsx" | head -90
```
(Confirms exact current style keys before adding new ones, avoiding a name collision.)

- [ ] **Step 2: Add a small avatar to the card**

Change:
```typescript
    <TouchableOpacity
      style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
```
to:
```typescript
    <TouchableOpacity
      style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {row.portrait_uri
        ? <Image source={{ uri: row.portrait_uri }} style={[styles.cardAvatar, { borderColor: t.colors.border }]} />
        : (
          <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
            <User size={18} color={t.colors.textMuted} />
          </View>
        )}
      <View style={styles.cardLeft}>
```

Add `Image` to the existing `react-native` import at the top of the file:
```typescript
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator, Platform, Image } from 'react-native';
```
(`User` from `lucide-react-native` is already imported on line 5, per earlier exploration — reuse it, don't re-import.)

Add to the `styles` object (found in Step 1):
```typescript
  cardAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, marginRight: 12 },
  cardAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(portrait): show portrait thumbnail on character-list rows"
```

---

## Task 13: End-to-end manual verification

No new files — this exercises every prior task together.

- [ ] **Step 1: Start the app**

```bash
npx expo start --web
```

- [ ] **Step 2: Verify local-only flow (no account)**

Open a character (either system), tap the portrait, pick a photo from the library, pan/pinch inside the circle, confirm. Verify:
- The cropped photo appears immediately in the sheet header (WFRP) or left column (D&D).
- Going back to the character list shows the same photo as a small avatar on that character's card.
- Reopening the character (or reloading the page on web) still shows the photo — confirms it persisted to local SQLite + local file, not just in-memory state.

- [ ] **Step 3: Verify the placeholder-frame rough edge flagged in Task 10**

Look at the 'lg' (D&D left-column) rendering with a photo set. If the dashed placeholder border still shows around the real photo and looks wrong, fix it now: in `CharacterPortrait.tsx`, split `styles.frame` into a base shared with a `styles.frameEmpty` (dashed border + gap, placeholder only) so a set photo renders in a plain rounded box instead. Commit this fix separately if made:
```bash
git add src/components/ui/CharacterPortrait.tsx
git commit -m "fix(portrait): drop dashed placeholder border once a real photo is set"
```

- [ ] **Step 4: Verify remove**

Tap the portrait again (sm thumbnail: opens the change/remove menu; lg: same), choose "Remove photo." Verify it reverts to the generic-person placeholder everywhere (header, list row) immediately.

- [ ] **Step 5: Verify signed-in sync (needs two sessions/devices — or two browser profiles against the same self-hosted instance)**

Sign in with a passkey on this device, add/change a portrait, confirm no errors in the console. On a second device or browser profile signed into the same account, open the character list — confirm the portrait appears after the list's pull cycle runs (may need a manual refresh/reopen if this app doesn't auto-poll).

- [ ] **Step 6: Verify offline resilience**

Go offline (or stop the local `api` server), change a portrait — confirm it still saves and displays locally without error. Bring the server back / reconnect — confirm the sync status indicator (`SyncBadge`, seen imported in `app/(tabs)/index.tsx`) reflects the retry, and the portrait eventually appears server-side (check `docker-compose`'s `./data/portraits/` directory, or the dev equivalent, for the uploaded file).

- [ ] **Step 7: Final commit and push**

```bash
git push
```
