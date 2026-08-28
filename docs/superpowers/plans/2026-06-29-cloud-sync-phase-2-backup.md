# Cloud Sync — Phase 2: One-Way Backup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When signed in, push every character save to the cloud and restore missing characters on sign-in — delivering cloud backup + restore-on-new-device, with no change to offline behavior.

**Architecture:** Local SQLite stays the source of truth. After each local save, a fire-and-forget upsert mirrors the character to the Supabase `characters` table. On sign-in, pull the user's cloud rows and `INSERT OR IGNORE` any whose id isn't present locally (restore-missing — existing local rows are never overwritten in Phase 2; bidirectional last-write-wins is Phase 3). All cloud calls are no-ops when signed out or unconfigured, so offline-first is untouched.

**Tech Stack:** Expo SDK 56 · TypeScript strict · `@supabase/supabase-js` v2 · expo-sqlite · jest-expo. Verify: `npm run typecheck`, `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-29-cloud-sync-and-accounts-design.md`

**Sequence:** Plan 2 of 4. Builds on Phase 1 (auth) which is merged. Phase 3 (two-way sync: delta pulls, tombstones, LWW) and Phase 4 (harden) follow.

**Preconditions (already true):**
- Phase 1 merged: `supabase` client, `supabaseConfig.enabled`, `AuthProvider`/`useAuth` (`{ session, configured, … }`).
- The Supabase `characters` table + RLS exist (Phase 1, Task 1).
- The local `characters` table already has an `updated_at` (ms) column — no local migration needed.

---

## Design notes (read once)

- **Push:** `pushCharacter(session, { id, system, data })` upserts `{ id, user_id, system, data, updated_at }` (data is the JS object — supabase-js stores it as jsonb). `updated_at` is the device ISO time for now; Phase 3 switches to a DB trigger for server-authoritative time. Fire-and-forget: never blocks or fails a local save.
- **Pull/restore:** on sign-in, `pullCharacters(session)` selects the user's non-deleted rows (RLS scopes to them); we restore only ids missing locally via `INSERT OR IGNORE`. Existing local characters are left untouched (no overwrite) — that's the Phase 2 "backup/restore" guarantee; full newer-wins reconciliation is Phase 3.
- **Gating:** every cloud call early-returns when `!supabaseConfig.enabled || !session`. Signed-out / unconfigured behavior is byte-for-byte unchanged.

## File map

| File | Change |
|---|---|
| `src/sync/reconcile.ts` | Create — pure helpers (`charactersToRestore`, `toCloudUpsert`, `cloudRowToLocalParams`) + types |
| `src/sync/__tests__/reconcile.test.ts` | Create — unit tests for the pure helpers |
| `src/sync/cloudCharacters.ts` | Create — `pushCharacter`, `pullCharacters` (Supabase calls) |
| `src/db/queries.ts` | Modify — add `restoreCharactersFromCloud` (INSERT OR IGNORE) |
| `src/hooks/useCharacter.ts` | Modify — push after each local save |
| `src/hooks/useCharacterList.ts` | Modify — pull + restore on sign-in, then refresh |

---

## Task 1: Pure sync helpers (TDD)

**Files:**
- Create: `src/sync/reconcile.ts`
- Test: `src/sync/__tests__/reconcile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { charactersToRestore, toCloudUpsert, cloudRowToLocalParams, type CloudCharacter } from '../reconcile';

const row = (id: string, over: Partial<CloudCharacter> = {}): CloudCharacter => ({
  id, system: 'wfrp4e', data: { name: 'Grim', system: 'wfrp4e' },
  updated_at: '2026-06-29T20:00:00.000Z', deleted_at: null, ...over,
});

describe('charactersToRestore', () => {
  it('returns only cloud rows whose id is not local', () => {
    const cloud = [row('a'), row('b'), row('c')];
    const local = new Set(['b']);
    expect(charactersToRestore(local, cloud).map(r => r.id)).toEqual(['a', 'c']);
  });
  it('skips tombstoned (deleted_at set) rows', () => {
    const cloud = [row('a'), row('b', { deleted_at: '2026-06-29T20:00:00.000Z' })];
    expect(charactersToRestore(new Set(), cloud).map(r => r.id)).toEqual(['a']);
  });
});

describe('toCloudUpsert', () => {
  it('builds the upsert payload with user_id and the given timestamp', () => {
    const data = { name: 'Grim', system: 'wfrp4e' };
    expect(toCloudUpsert('user-1', { id: 'a', system: 'wfrp4e', data }, '2026-06-29T20:00:00.000Z'))
      .toEqual({ id: 'a', user_id: 'user-1', system: 'wfrp4e', data, updated_at: '2026-06-29T20:00:00.000Z' });
  });
});

describe('cloudRowToLocalParams', () => {
  it('maps a cloud row to local insert params', () => {
    const p = cloudRowToLocalParams(row('a', { updated_at: '2026-06-29T20:00:00.000Z' }));
    expect(p).toEqual({
      id: 'a', system: 'wfrp4e', name: 'Grim',
      dataJson: JSON.stringify({ name: 'Grim', system: 'wfrp4e' }),
      updatedAtMs: Date.parse('2026-06-29T20:00:00.000Z'),
    });
  });
  it('falls back to empty name and now() when data/timestamp are odd', () => {
    const p = cloudRowToLocalParams(row('a', { data: {}, updated_at: 'not-a-date' }));
    expect(p.name).toBe('');
    expect(typeof p.updatedAtMs).toBe('number');
    expect(Number.isNaN(p.updatedAtMs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reconcile`
Expected: FAIL — `Cannot find module '../reconcile'`.

- [ ] **Step 3: Implement `src/sync/reconcile.ts`**

```ts
/** A character row as returned from the Supabase `characters` table. */
export type CloudCharacter = {
  id: string;
  system: string;
  data: any; // jsonb → JS object (the per-character JSON)
  updated_at: string; // ISO timestamp
  deleted_at: string | null;
};

/** Cloud rows that should be restored locally: not tombstoned, and not already present. */
export function charactersToRestore(localIds: Set<string>, cloud: CloudCharacter[]): CloudCharacter[] {
  return cloud.filter((c) => c.deleted_at == null && !localIds.has(c.id));
}

/** Build the upsert payload for pushing a local character to the cloud. */
export function toCloudUpsert(
  userId: string,
  c: { id: string; system: string; data: any },
  nowIso: string,
) {
  return { id: c.id, user_id: userId, system: c.system, data: c.data, updated_at: nowIso };
}

/** Map a cloud row to the params used to insert it into local SQLite. */
export function cloudRowToLocalParams(c: CloudCharacter) {
  const name = (c.data && typeof c.data === 'object' && typeof c.data.name === 'string') ? c.data.name : '';
  const parsedMs = Date.parse(c.updated_at);
  return {
    id: c.id,
    system: c.system,
    name,
    dataJson: JSON.stringify(c.data ?? {}),
    updatedAtMs: Number.isNaN(parsedMs) ? Date.now() : parsedMs,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reconcile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sync/reconcile.ts src/sync/__tests__/reconcile.test.ts
git commit -m "feat(sync): pure backup reconcile helpers"
```

---

## Task 2: Local restore query

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Add `restoreCharactersFromCloud`**

In `src/db/queries.ts`, in the Characters section (after `duplicateCharacter`), add:

```ts
/** Insert characters pulled from the cloud, skipping any id that already exists
 *  locally (restore-missing — never overwrites a local character). Returns the
 *  number actually inserted. */
export async function restoreCharactersFromCloud(
  db: SQLite.SQLiteDatabase,
  rows: Array<{ id: string; system: string; name: string; dataJson: string; updatedAtMs: number }>,
): Promise<number> {
  let restored = 0;
  for (const r of rows) {
    const res = await db.runAsync(
      `INSERT OR IGNORE INTO characters (id, system, name, portrait_uri, data, schema_ver, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 1, ?, ?)`,
      [r.id, r.system, r.name, r.dataJson, r.updatedAtMs, r.updatedAtMs],
    );
    if (res.changes > 0) restored++;
  }
  return restored;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat(sync): local restore-from-cloud query (insert or ignore)"
```

---

## Task 3: Cloud character module (push / pull)

**Files:**
- Create: `src/sync/cloudCharacters.ts`

- [ ] **Step 1: Implement push + pull**

```ts
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import { toCloudUpsert, type CloudCharacter } from '@/sync/reconcile';

/** Upsert one character to the cloud. No-op when unconfigured or signed out.
 *  Fire-and-forget: logs and swallows errors so a save never fails on the network. */
export async function pushCharacter(
  session: Session | null,
  c: { id: string; system: string; data: any },
): Promise<void> {
  if (!supabaseConfig.enabled || !session) return;
  const payload = toCloudUpsert(session.user.id, c, new Date().toISOString());
  const { error } = await supabase.from('characters').upsert(payload);
  if (error) console.warn('[sync] push failed:', error.message);
}

/** Fetch the signed-in user's non-deleted characters. Returns [] when unconfigured,
 *  signed out, or on error. RLS scopes the result to the current user. */
export async function pullCharacters(session: Session | null): Promise<CloudCharacter[]> {
  if (!supabaseConfig.enabled || !session) return [];
  const { data, error } = await supabase
    .from('characters')
    .select('id,system,data,updated_at,deleted_at')
    .is('deleted_at', null);
  if (error) { console.warn('[sync] pull failed:', error.message); return []; }
  return (data ?? []) as CloudCharacter[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/sync/cloudCharacters.ts
git commit -m "feat(sync): cloud character push/pull"
```

---

## Task 4: Push on save

**Files:**
- Modify: `src/hooks/useCharacter.ts`

Centralize the two existing save sites (debounced `patch` and `flush`) into one helper that saves locally then pushes.

- [ ] **Step 1: Add imports**

At the top of `src/hooks/useCharacter.ts`:

```ts
import { useAuth } from '@/auth/AuthProvider';
import { pushCharacter } from '@/sync/cloudCharacters';
```

- [ ] **Step 2: Add a save-and-push helper and use it in both save sites**

Inside `useCharacter`, after `const db = useSQLiteContext();` add:

```ts
  const { session } = useAuth();
```

Add a helper (after the `latestData`/`saveTimer` refs, before `flush`):

```ts
  // Save locally, then mirror to the cloud (fire-and-forget; never blocks the save).
  const saveAndPush = useCallback(async (next: EditableCharacter) => {
    await updateCharacter(db, id, next);
    void pushCharacter(session, { id, system: next.system, data: next });
  }, [db, id, session]);
```

Replace the `await updateCharacter(db, id, latestData.current);` call inside `flush` with `await saveAndPush(latestData.current);`, and replace the `await updateCharacter(db, id, next);` inside the debounced `patch` timeout with `await saveAndPush(next);`. Update the `flush` dependency array to `[saveAndPush]` and `patch`'s to `[saveAndPush]`.

Resulting `flush` and `patch`:

```ts
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (latestData.current) {
      setSaving(true);
      await saveAndPush(latestData.current);
      setSaving(false);
    }
  }, [saveAndPush]);

  const patch = useCallback((updates: Partial<EditableCharacter>) => {
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates } as EditableCharacter;
      latestData.current = next;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        await saveAndPush(next);
        setSaving(false);
      }, 800);

      return next;
    });
  }, [saveAndPush]);
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCharacter.ts
git commit -m "feat(sync): push character to cloud on save"
```

---

## Task 5: Pull + restore on sign-in

**Files:**
- Modify: `src/hooks/useCharacterList.ts`

- [ ] **Step 1: Add imports**

At the top of `src/hooks/useCharacterList.ts`:

```ts
import { useAuth } from '@/auth/AuthProvider';
import { pullCharacters } from '@/sync/cloudCharacters';
import { charactersToRestore, cloudRowToLocalParams } from '@/sync/reconcile';
```

- [ ] **Step 2: Restore on sign-in**

Inside `useCharacterList`, after `const db = useSQLiteContext();` add:

```ts
  const { session } = useAuth();
```

After the existing `useEffect(() => { refresh(); }, [refresh]);`, add:

```ts
  // On sign-in, pull the user's cloud characters and restore any missing locally,
  // then refresh the list. No-op when signed out / unconfigured.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const cloud = await pullCharacters(session);
      const localIds = new Set((await queries.getAllCharacters(db)).map(r => r.id));
      const missing = charactersToRestore(localIds, cloud);
      if (missing.length === 0) return;
      await queries.restoreCharactersFromCloud(db, missing.map(cloudRowToLocalParams));
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [session, db, refresh]);
```

- [ ] **Step 3: Typecheck + test**

Run: `npm run typecheck` → no errors.
Run: `npm test` → all green (existing suites + new `reconcile` suite).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCharacterList.ts
git commit -m "feat(sync): pull + restore characters on sign-in"
```

---

## Task 6: Manual end-to-end verification

Needs a live Supabase project + a signed-in session (Phase 1, Task 1 complete).

- [ ] **Step 1: Backup (push)**

Sign in (Settings → Account). Create or edit a character. In the Supabase dashboard → Table Editor → `characters`, confirm a row appears with your `user_id`, the right `system`, and the character JSON in `data`. Edit the character again → confirm `data`/`updated_at` update.

- [ ] **Step 2: Restore (pull) — the key test**

On a second device/browser profile (or after clearing local app data), sign in with the **same email**. Open the Characters list → your characters from device 1 appear (restored). Confirm the character opens and renders correctly.

- [ ] **Step 3: No overwrite of local edits**

On device 1, edit a character while device 2 also has it. Re-open the list on device 1 (which triggers a pull) → your local edit is **preserved** (Phase 2 never overwrites existing local rows; bidirectional newer-wins is Phase 3).

- [ ] **Step 4: Offline-first regression**

Sign out → the app works exactly as before, no cloud calls. Blank the `.env` keys → Account UI hidden, no errors, characters all local. (Restore `.env` after.)

- [ ] **Step 5: Final checks**

Run `npm run typecheck` (clean) and `npm test` (green).

---

## Definition of done (Phase 2)

- Saving a character while signed in upserts it to the cloud `characters` table (verifiable in the dashboard).
- Signing in on a fresh device restores all of the user's characters into the local list.
- Existing local characters are never overwritten by a pull (restore-missing only).
- Signed-out / unconfigured behavior is unchanged; all cloud calls are no-ops.
- `npm run typecheck` clean; `npm test` green (incl. the new `reconcile` suite).

## Not in this plan (later phases)

- **Phase 3 — Two-way sync:** delta pulls via `last_synced_at`, last-write-wins per character using server-authoritative `updated_at` (DB trigger), `deleted_at` tombstones so deletions propagate, and an offline push queue with retry.
- **Phase 4 — Harden:** a "syncing…/backed up" indicator, push throttling/queue, session-refresh edge cases, account + data deletion, and the secure-store orphan-chunk cleanup carried over from Phase 1.
