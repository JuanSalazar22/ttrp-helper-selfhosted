# Cloud Sync — Phase 3: Two-Way Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sync bidirectional — a change on one device propagates to others, and a delete on one device removes the character everywhere — robust against device-clock skew.

**Architecture:** The cloud is the authoritative clock (a DB trigger sets `updated_at = now()` on every write). Each local row remembers the cloud `updated_at` it last synced (`cloud_updated_at`). On pull we compare cloud `updated_at` to that stored value (server-time vs stored-server-time — no device clocks involved): different ⇒ cloud changed since last sync ⇒ overwrite local; equal ⇒ keep local. Deletes are tombstones (`deleted_at`): a local delete soft-deletes the cloud row; a pull that sees a tombstone deletes the local row. Still offline-first: every cloud call no-ops without a session.

**Tech Stack:** Expo SDK 56 · TypeScript strict · @supabase/supabase-js v2 · expo-sqlite · jest-expo. Verify: `npm run typecheck`, `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-29-cloud-sync-and-accounts-design.md`

**Sequence:** Plan 3 of 4. Builds on Phase 1 (auth) + Phase 2 (one-way backup), both merged. Phase 4 (harden) follows.

**Supersedes from Phase 2:** the restore-missing path (`charactersToRestore` + `restoreCharactersFromCloud` + the Phase-2 pull effect) is replaced by `reconcilePull` + apply-actions. Push gains a server-time read-back. `pullCharacters` stops filtering out tombstones (we need them to propagate deletes).

---

## File map

| File | Change |
|---|---|
| **Supabase dashboard** | Manual — add an `updated_at = now()` trigger on `characters` (Task 1) |
| `src/db/schema.ts` | Modify — add `cloud_updated_at TEXT` column (+ backfill ALTER for existing installs) |
| `src/sync/reconcile.ts` | Modify — add `reconcilePull` + `PullAction`/`LocalRef` types (keep existing helpers) |
| `src/sync/__tests__/reconcile.test.ts` | Modify — add `reconcilePull` tests |
| `src/db/queries.ts` | Modify — add `getCharacterSyncRefs`, `upsertLocalCharacter`, `setCloudUpdatedAt`; remove now-unused `restoreCharactersFromCloud` |
| `src/sync/cloudCharacters.ts` | Modify — `pushCharacter` reads back server time + stores it; `pullCharacters` fetches tombstones too; add `softDeleteCharacterCloud` |
| `src/hooks/useCharacter.ts` | Modify — `pushCharacter` now takes `db` |
| `src/hooks/useCharacterList.ts` | Modify — pull applies `reconcilePull` actions; `remove` soft-deletes the cloud row |

---

## Task 1: Supabase trigger — server-authoritative `updated_at` (manual)

No app code. Run once in the Supabase dashboard so the cloud clock is the single source of truth.

- [ ] **Step 1: Run the SQL**

Dashboard → SQL Editor → New query → run:

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
  before insert or update on public.characters
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Verify**

Table Editor → `characters` → edit any row's `data` → confirm `updated_at` jumps to the current time even though you didn't set it.

---

## Task 2: Local `cloud_updated_at` column

**Files:** Modify `src/db/schema.ts`

- [ ] **Step 1: Add the column to the CREATE and backfill old installs**

In the `characters` `CREATE TABLE`, add a column after `updated_at`:

```sql
      updated_at   INTEGER NOT NULL,
      cloud_updated_at TEXT
```

Then, near the existing `ALTER TABLE content_translations ADD COLUMN name` backfill block at the bottom of `initDatabase`, add an analogous guarded backfill:

```ts
  // cloud_updated_at was added in Phase 3; backfill on older installs.
  try {
    await db.execAsync('ALTER TABLE characters ADD COLUMN cloud_updated_at TEXT;');
  } catch {
    // Column already exists — ignore.
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(sync): add local cloud_updated_at column for two-way sync"
```

---

## Task 3: `reconcilePull` (TDD)

**Files:** Modify `src/sync/reconcile.ts` and `src/sync/__tests__/reconcile.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing test file)

```ts
import { reconcilePull, type LocalRef } from '../reconcile';

const cloudRow = (id: string, over: Partial<CloudCharacter> = {}): CloudCharacter => ({
  id, system: 'wfrp4e', data: { name: 'Grim', system: 'wfrp4e' },
  updated_at: 't1', deleted_at: null, ...over,
});
const localMap = (entries: Array<[string, string | null]>) =>
  new Map<string, LocalRef>(entries.map(([id, cloudUpdatedAt]) => [id, { id, cloudUpdatedAt }]));

describe('reconcilePull', () => {
  it('inserts a cloud row missing locally', () => {
    const a = reconcilePull(localMap([]), [cloudRow('a')]);
    expect(a).toEqual([{ kind: 'insert', row: cloudRow('a') }]);
  });
  it('updates when cloud updated_at differs from the last-synced value', () => {
    const a = reconcilePull(localMap([['a', 't0']]), [cloudRow('a', { updated_at: 't1' })]);
    expect(a).toEqual([{ kind: 'update', row: cloudRow('a', { updated_at: 't1' }) }]);
  });
  it('skips when cloud is unchanged since last sync', () => {
    expect(reconcilePull(localMap([['a', 't1']]), [cloudRow('a', { updated_at: 't1' })])).toEqual([]);
  });
  it('deletes locally when the cloud row is tombstoned', () => {
    const a = reconcilePull(localMap([['a', 't1']]), [cloudRow('a', { deleted_at: 't2' })]);
    expect(a).toEqual([{ kind: 'delete', id: 'a' }]);
  });
  it('ignores a tombstoned row that is not present locally', () => {
    expect(reconcilePull(localMap([]), [cloudRow('a', { deleted_at: 't2' })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reconcile`
Expected: FAIL — `reconcilePull` is not exported.

- [ ] **Step 3: Implement** (add to `src/sync/reconcile.ts`, keep the existing helpers)

```ts
/** A local row's identity + the cloud updated_at we last synced for it. */
export type LocalRef = { id: string; cloudUpdatedAt: string | null };

/** What a pull should do for a cloud row, after comparing against local state. */
export type PullAction =
  | { kind: 'insert'; row: CloudCharacter }
  | { kind: 'update'; row: CloudCharacter }
  | { kind: 'delete'; id: string };

/** Decide per cloud row: tombstoned → delete local (if present); missing local → insert;
 *  cloud changed since last sync (updated_at != stored cloudUpdatedAt) → update; else skip.
 *  Compares server-time to stored-server-time, so device clock skew can't misorder. */
export function reconcilePull(local: Map<string, LocalRef>, cloud: CloudCharacter[]): PullAction[] {
  const actions: PullAction[] = [];
  for (const c of cloud) {
    const l = local.get(c.id);
    if (c.deleted_at != null) {
      if (l) actions.push({ kind: 'delete', id: c.id });
      continue;
    }
    if (!l) { actions.push({ kind: 'insert', row: c }); continue; }
    if (c.updated_at !== l.cloudUpdatedAt) actions.push({ kind: 'update', row: c });
  }
  return actions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reconcile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sync/reconcile.ts src/sync/__tests__/reconcile.test.ts
git commit -m "feat(sync): reconcilePull — insert/update/delete decisions for two-way sync"
```

---

## Task 4: Local sync queries

**Files:** Modify `src/db/queries.ts`

- [ ] **Step 1: Add the three queries and remove the superseded one**

In the Characters section: **remove** `restoreCharactersFromCloud` (Phase 2's restore-missing helper — superseded), and add:

```ts
/** Local rows' id + last-synced cloud timestamp, for building the pull reconcile map. */
export async function getCharacterSyncRefs(
  db: SQLite.SQLiteDatabase,
): Promise<Array<{ id: string; cloud_updated_at: string | null }>> {
  return db.getAllAsync<{ id: string; cloud_updated_at: string | null }>(
    'SELECT id, cloud_updated_at FROM characters',
  );
}

/** Insert or replace a character pulled from the cloud, recording the cloud timestamp.
 *  Used for both 'insert' and 'update' pull actions. Preserves created_at on conflict. */
export async function upsertLocalCharacter(
  db: SQLite.SQLiteDatabase,
  r: { id: string; system: string; name: string; dataJson: string; updatedAtMs: number; cloudUpdatedAt: string },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO characters (id, system, name, portrait_uri, data, schema_ver, created_at, updated_at, cloud_updated_at)
     VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       system = excluded.system, name = excluded.name, data = excluded.data,
       updated_at = excluded.updated_at, cloud_updated_at = excluded.cloud_updated_at`,
    [r.id, r.system, r.name, r.dataJson, r.updatedAtMs, r.updatedAtMs, r.cloudUpdatedAt],
  );
}

/** Record the cloud timestamp we last synced for a local row (called after a push). */
export async function setCloudUpdatedAt(
  db: SQLite.SQLiteDatabase,
  id: string,
  cloudUpdatedAt: string,
): Promise<void> {
  await db.runAsync('UPDATE characters SET cloud_updated_at = ? WHERE id = ?', [cloudUpdatedAt, id]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: errors only where `restoreCharactersFromCloud` is still referenced (fixed in Task 6). Confirm those are the *only* errors; the new functions compile.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat(sync): local two-way-sync queries (refs/upsert/setCloudUpdatedAt)"
```

---

## Task 5: Cloud module — read-back push, full pull, soft delete

**Files:** Modify `src/sync/cloudCharacters.ts`

- [ ] **Step 1: Rewrite the module**

```ts
import type { Session } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import { setCloudUpdatedAt } from '@/db/queries';
import type { CloudCharacter } from '@/sync/reconcile';

/** Upsert one character; the DB trigger sets updated_at, which we read back and store
 *  locally as cloud_updated_at. No-op when unconfigured/signed out; never throws. */
export async function pushCharacter(
  db: SQLiteDatabase,
  session: Session | null,
  c: { id: string; system: string; data: any },
): Promise<void> {
  if (!supabaseConfig.enabled || !session) return;
  const { data, error } = await supabase
    .from('characters')
    .upsert({ id: c.id, user_id: session.user.id, system: c.system, data: c.data, deleted_at: null })
    .select('updated_at')
    .single();
  if (error) { console.warn('[sync] push failed:', error.message); return; }
  if (data?.updated_at) await setCloudUpdatedAt(db, c.id, data.updated_at as string);
}

/** Fetch ALL of the user's rows, including tombstones (needed to propagate deletes). */
export async function pullCharacters(session: Session | null): Promise<CloudCharacter[]> {
  if (!supabaseConfig.enabled || !session) return [];
  const { data, error } = await supabase
    .from('characters')
    .select('id,system,data,updated_at,deleted_at');
  if (error) { console.warn('[sync] pull failed:', error.message); return []; }
  return (data ?? []) as CloudCharacter[];
}

/** Soft-delete a character in the cloud so the deletion propagates to other devices. */
export async function softDeleteCharacterCloud(session: Session | null, id: string): Promise<void> {
  if (!supabaseConfig.enabled || !session) return;
  const { error } = await supabase
    .from('characters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('[sync] soft-delete failed:', error.message);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: errors only at the `pushCharacter` call site in `useCharacter.ts` (now needs `db`) — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/sync/cloudCharacters.ts
git commit -m "feat(sync): read-back push, tombstone-aware pull, cloud soft-delete"
```

---

## Task 6: Wire the hooks

**Files:** Modify `src/hooks/useCharacter.ts`, `src/hooks/useCharacterList.ts`

- [ ] **Step 1: `useCharacter.ts` — pass `db` to push**

In `saveAndPush`, change the push call to include `db`:

```ts
  const saveAndPush = useCallback(async (next: EditableCharacter) => {
    await updateCharacter(db, id, next);
    void pushCharacter(db, session, { id, system: next.system, data: next });
  }, [db, id, session]);
```

- [ ] **Step 2: `useCharacterList.ts` — apply reconcile actions on pull, soft-delete on remove**

Replace the Phase-2 imports
```ts
import { pullCharacters } from '@/sync/cloudCharacters';
import { charactersToRestore, cloudRowToLocalParams } from '@/sync/reconcile';
```
with
```ts
import { pullCharacters, softDeleteCharacterCloud } from '@/sync/cloudCharacters';
import { reconcilePull, cloudRowToLocalParams, type LocalRef } from '@/sync/reconcile';
```

Replace the Phase-2 sign-in pull effect with:

```ts
  // On sign-in / list mount while signed in: pull the user's cloud rows and apply
  // inserts, updates (cloud newer than last sync), and tombstone deletes; then refresh.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
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
    })();
    return () => { cancelled = true; };
  }, [session, db, refresh]);
```

Update `remove` to soft-delete the cloud row after the local delete:

```ts
  const remove = useCallback(async (id: string) => {
    await queries.deleteCharacter(db, id);
    void softDeleteCharacterCloud(session, id);
    await refresh();
  }, [db, refresh, session]);
```

- [ ] **Step 3: Typecheck + test**

Run: `npm run typecheck` → no errors (the Task 4/5 call-site errors are resolved here).
Run: `npm test` → all green (incl. the extended `reconcile` suite).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCharacter.ts src/hooks/useCharacterList.ts
git commit -m "feat(sync): apply two-way reconcile on pull + propagate deletes"
```

---

## Task 7: Manual end-to-end verification

Needs the Task 1 trigger applied + a signed-in session on two local stores.

- [ ] **Step 1: Cross-device update**

Sign in on store A and store B (same email); both show the same character. On A, edit the character (wait ~2s for the push). On B, reopen the Characters list (or sign out/in) → the edit appears. (Fixes report #1.)

- [ ] **Step 2: Delete propagation**

On A, delete a character. In the Supabase dashboard → `characters`, the row's `deleted_at` is now set (not removed). On B, reopen the list → the character is gone, and it does **not** zombie-restore. (Fixes report #2.)

- [ ] **Step 3: No spurious overwrite**

Edit a character on A and immediately reopen A's list (triggering a pull) → your just-made edit is intact (the row you pushed has matching `cloud_updated_at`, so the pull skips it).

- [ ] **Step 4: Offline-first regression**

Sign out → app behaves as before, no cloud calls. Blank `.env` → Account hidden, no errors. Restore `.env`.

- [ ] **Step 5: Final checks**

`npm run typecheck` clean; `npm test` green.

---

## Definition of done (Phase 3)

- An edit on one signed-in device shows on another after its next pull (cloud-newer-than-last-sync wins).
- A delete on one device propagates (cloud tombstone) and removes the character on other devices, with no zombie-restore.
- A device's own just-pushed edit is never clobbered by the same pull (change-detection via `cloud_updated_at`).
- Signed-out / unconfigured behavior unchanged; all cloud calls no-op.
- `npm run typecheck` clean; `npm test` green.

## Not in this plan (Phase 4 — harden)

- Delta pulls via a `last_synced_at` cursor (this plan pulls all rows each time — fine at hobby scale).
- Offline push queue with retry (a save made offline pushes on the next online save/pull, not immediately).
- "Syncing…/backed up" indicator, account + data deletion, secure-store orphan-chunk cleanup, gate `signIn` on `configured`.
- True concurrent-edit conflict UX — here, a cloud change since last sync wins; the rare local-and-cloud-both-edited case favors cloud.
