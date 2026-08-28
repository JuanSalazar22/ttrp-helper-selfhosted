# Cloud Sync — Phase 4: Harden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the now-working two-way sync (Phase 3) durable and legible: don't lose writes made while offline, don't leak orphaned secure-store chunks on session refresh, surface a sync status to the user, and refuse sign-in attempts when Supabase isn't configured.

**Architecture:** Still local-first; every cloud call no-ops without a session. Phase 3 push was fire-and-forget — a failed push (offline, transient error) was logged and dropped. Phase 4 records each failed push id in a tiny local outbox and retries on the next save or sign-in. A single shared `SyncStatus` (`idle` | `syncing` | `error` | `offline`) is derived in the auth/sync layer and shown in the UI. Two correctness fixes round it out: secure-store `setItem` now deletes stale chunks before writing (a session that shrinks from N→M chunks left N−M orphans, which could corrupt a later read), and `signIn` returns an error instead of calling Supabase when unconfigured.

**Tech Stack:** Expo SDK 56 · TypeScript strict · @supabase/supabase-js v2 · expo-sqlite · jest-expo. Verify: `npm run typecheck`, `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-29-cloud-sync-and-accounts-design.md`

**Sequence:** Plan 4 of 4. Builds on Phases 1–3 (all merged). Final cloud-sync plan.

## Non-goals (deferred — not in this plan)

- **Delta pulls (`last_synced_at` cursor).** Current pull fetches all of the user's rows each open. For a hobby app with a handful of characters this is cheap; a cursor + a `sync_meta` table adds schema and edge cases (tombstone GC) for negligible gain. Revisit only if a user reports large libraries.
- **Auth-user account deletion.** Deleting the Supabase auth user requires a service-role key, which must never ship in the client — it needs a server-side Edge Function. Out of scope here. (Deleting a user's *character rows* from Settings is a small future task that the anon key + RLS can do; not included now to keep this plan focused.)

---

## File map

| File | Change |
|---|---|
| `src/lib/secureStorage.ts` | Modify — `setItem` deletes any pre-existing chunks (and a possible scalar value) before writing the new representation |
| `src/lib/__tests__/secureStorage.test.ts` | New — round-trip + shrink-without-orphan tests over a fake SecureStore |
| `src/auth/AuthProvider.tsx` | Modify — `signIn` returns `{ error }` early when `!configured` |
| `src/sync/syncStatus.ts` | New — `SyncStatus` type + pure `nextStatus` reducer (queue size + last error + online flag → status) |
| `src/sync/__tests__/syncStatus.test.ts` | New — reducer tests |
| `src/sync/outbox.ts` | New — in-memory failed-push queue: `enqueue(id)`, `dequeueAll()`, `size()`; pure, module-scoped |
| `src/sync/__tests__/outbox.test.ts` | New — enqueue dedupes, dequeueAll drains |
| `src/sync/cloudCharacters.ts` | Modify — `pushCharacter` returns `{ ok: boolean }`; on failure caller enqueues |
| `src/sync/SyncProvider.tsx` | New — context exposing `status` + `retry()`; subscribes to NetInfo online/offline, drains the outbox on reconnect / sign-in |
| `app/_layout.tsx` (or wherever `AuthProvider` mounts) | Modify — mount `SyncProvider` inside `AuthProvider` |
| `src/hooks/useCharacter.ts` | Modify — on push failure, enqueue id + report status via SyncProvider |
| `src/components/SyncBadge.tsx` | New — small text/icon badge reading `useSyncStatus()` |
| `src/i18n/locales/en.ts` | Modify — add `sync.syncing` / `sync.backedUp` / `sync.offline` / `sync.error` keys |
| `app/(tabs)/index.tsx` (character list header) | Modify — render `<SyncBadge />` |

> Exact mount points (`app/_layout.tsx`, list header file) must be confirmed against the tree during implementation; the table is the intent, not a literal path guarantee.

---

## Task 1: Secure-store orphan-chunk cleanup

`setItem` currently overwrites the head key but never deletes leftover `.i` chunks when the new value needs fewer (or zero) chunks. A later `getItem` that reads a stale head is fine, but a partial/over-counted read is a latent corruption. Fix: clear the old representation first.

- [ ] **Step 1: Write failing tests** in `src/lib/__tests__/secureStorage.test.ts` against a `Map`-backed fake `SecureStore` (mock `expo-secure-store`):
  - round-trips a short value;
  - round-trips a value > `CHUNK_SIZE` (multi-chunk);
  - writing a short value *over* a previous multi-chunk value leaves no `.i` keys in the store;
  - writing a 2-chunk value over a 5-chunk value leaves exactly head + `.0` + `.1`.
- [ ] **Step 2:** In `setItem`, before writing, read the existing head; if it was chunked, delete all old `.i` keys; then write the new value (scalar or chunked). Keep `CHUNK_SIZE`/`HEAD` constants.
- [ ] **Step 3:** `npm test src/lib/__tests__/secureStorage.test.ts` green; `npm run typecheck` clean.

## Task 2: Gate `signIn` on `configured`

- [ ] **Step 1:** In `AuthProvider.signIn`, if `!supabaseConfig.enabled` return `{ error: 'Sync is not configured' }` before touching `supabase`. (The Account UI already hides when unconfigured; this is defense in depth.)
- [ ] **Step 2:** `npm run typecheck` clean. No new test required, but add one to the existing auth test if present.

## Task 3: Sync status reducer + outbox (pure, tested first)

- [ ] **Step 1:** `src/sync/syncStatus.ts` — `export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';` and a pure `nextStatus({ online, inFlight, queueSize }): SyncStatus` (offline if `!online`; syncing if `inFlight > 0`; error if `queueSize > 0`; else idle). Tests cover each branch + precedence.
- [ ] **Step 2:** `src/sync/outbox.ts` — module-scoped `Set<string>`; `enqueue(id)` (dedupes), `dequeueAll(): string[]` (returns + clears), `size()`. Tests: enqueue dedupes, dequeueAll drains and second call is empty.
- [ ] **Step 3:** `npm test` green for both; `npm run typecheck` clean.

## Task 4: `pushCharacter` reports success; SyncProvider wires it together

- [ ] **Step 1:** `pushCharacter` returns `Promise<{ ok: boolean }>` (`ok:false` on the `error` branch and on the unconfigured/no-session no-op? — no: treat no-op as `ok:true`, only real failures are `ok:false`). Update existing callers/tests.
- [ ] **Step 2:** `src/sync/SyncProvider.tsx` — context `{ status, retry }`. Tracks `inFlight`, subscribes to `@react-native-community/netinfo` (already a dep? if not, use `navigator.onLine` + `online`/`offline` events on web and assume online on native to avoid a new dep — confirm during impl) for `online`. Derives `status` via `nextStatus`. `drain()` dequeues the outbox and re-pushes each id (needs current data — fetch from local db by id, then `pushCharacter`); runs on reconnect and on sign-in. Exposes `useSyncStatus()`.
- [ ] **Step 3:** Mount `<SyncProvider>` inside `<AuthProvider>` at the app root.
- [ ] **Step 4:** `useCharacter`/`saveAndPush`: await `pushCharacter`; if `!ok`, `outbox.enqueue(id)` and bump status. Keep it fire-and-forget for the UI (never blocks the local save).
- [ ] **Step 5:** `npm run typecheck` + `npm test` green.

## Task 5: Sync badge + i18n

- [ ] **Step 1:** Add i18n keys `sync.syncing` ("Syncing…"), `sync.backedUp` ("Backed up"), `sync.offline` ("Offline"), `sync.error` ("Sync error — will retry") to `en.ts` (source-of-truth). ES overlay optional (DeepPartial — missing keys fall back to EN).
- [ ] **Step 2:** `src/components/SyncBadge.tsx` — reads `useSyncStatus()`; renders nothing when not signed in or `idle`→show "Backed up" briefly/lightly; map status→label. Small, matches existing badge/text styles.
- [ ] **Step 3:** Render `<SyncBadge />` in the character-list header.
- [ ] **Step 4:** `npm run typecheck` + `npm test` green. Manual: sign in, edit a character → badge shows syncing then backed up; go offline (devtools) and edit → badge offline/error, comes back on reconnect.

---

## Definition of done

- `npm run typecheck` clean, `npm test` all green.
- Offline edits are not lost: they re-push on reconnect (manual verify).
- No orphan secure-store chunks after a session shrink (unit-tested).
- `signIn` refuses when unconfigured.
- A sync badge reflects syncing / backed up / offline / error.
- Offline-first preserved: with no `.env` keys the app is unchanged and the badge never renders.
