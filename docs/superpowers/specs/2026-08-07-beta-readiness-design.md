# Beta Readiness — Design

Three small, related changes preparing the app for testing with multiple real users: a beta badge on the D&D 5e system so testers know which sheet is less mature, a bug-report tab so they have a real channel to flag problems, and a translation-correctness fix surfaced while investigating this work.

> **Revised after review.** The first draft of this spec contained a security flaw in the `bug_reports` RLS design — it claimed a `default auth.uid()` column prevented user impersonation, which is false. The flaw and its fix were both verified empirically against a local Postgres instance. See [Corrections after review](#corrections-after-review) at the end for the full list of what changed and why.

## Why now

The user is about to create Apple/Google developer accounts and recruit beta testers (Android's mandatory closed-testing track needs 12 of them, per the app-store distribution spec). Before strangers start using the app, it needs two things it doesn't have: a way to signal that D&D 5e is behind WFRP 4e in maturity, and a way for testers to actually tell the developer something's wrong.

Investigating a related question ("what's missing to make the app fully translatable") surfaced a concrete, in-scope bug: `src/lib/confirm.ts`'s native confirmation dialog hardcodes English "Cancel"/"Remove" button text on every destructive action in the app — including the "Remove cloud data" flow shipped in the previous session. A Spanish-speaking tester on a phone sees an English dialog with a Spanish message. Small fix, same theme, bundled in here rather than deferred.

## Decisions

| Area | Decision |
|---|---|
| Beta badge scope | Only the D&D 5e option in `CreateCharacterModal`'s system picker — the one place a player actively chooses the system. |
| Bug report destination | New Supabase table, not GitHub Issues or email. Fits the existing schema-as-code pattern from the backend-hardening work; no new external service. |
| Bug report auth | Anonymous submission allowed, with an optional contact email. Sign-in is not required — the app works fully offline, and requiring an account would shrink the pool of testers willing to report something. |
| Bug report offline handling | Simple fail-with-retry message. No new offline queue. Losing an unsent bug report is a real but low-stakes failure, unlike losing character data — doesn't justify replicating `src/sync/outbox.ts`'s complexity for a beta-only feature. |
| Contextual flagging | Not in this pass. A "report this" shortcut inside `WikiModal` (pre-filling which skill/talent/spell) is a natural follow-up once the general tab exists and real usage shows what testers actually report. |
| Report visibility | Write-only from the client. No `select` RLS policy — verified that this returns zero rows for both `anon` and `authenticated` even when `grant select` is present. The developer reads via Supabase Studio, which uses the service role and bypasses RLS. |

## Architecture

### 1. Beta badge

**File:** `src/components/ui/CreateCharacterModal.tsx`

The `SYSTEMS` array gains a `beta?: boolean` flag on the `dnd5e` entry:

```typescript
const SYSTEMS: { id: GameSystem; label: string; sub: string; beta?: boolean }[] = [
  { id: 'dnd5e',  label: 'D&D 5e',       sub: 'Dungeons & Dragons 5th Edition', beta: true },
  { id: 'wfrp4e', label: 'WFRP 4e',      sub: 'Warhammer Fantasy Roleplay' },
];
```

Rendered as a small muted pill next to the label, reusing the visual language already established by `WfrpRollModal`'s SL badge (border + tinted background, not an alarming color — this is a maturity note, not a warning). New i18n key `create.betaLabel` ("Beta" — identical in Spanish, but still routed through `tr()` for consistency and any future wording change).

### 2. Bug report — schema

**File:** `supabase/migrations/<timestamp>_bug_reports.sql`

```sql
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'content', 'suggestion')),
  message text not null check (char_length(message) between 1 and 5000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  system text check (system is null or system in ('dnd5e', 'wfrp4e')),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  platform text check (platform is null or platform in ('ios', 'android', 'web')),
  locale text check (locale is null or char_length(locale) <= 16),
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

create policy "submit own or anonymous"
  on public.bug_reports for insert
  with check (user_id is null or user_id = auth.uid());
```

#### Why the policy is `user_id is null or user_id = auth.uid()`, not `true`

**A `DEFAULT` does not protect a column.** Postgres applies a column default only when the column is *omitted* from the `INSERT`. PostgREST forwards whatever JSON keys the client sends, so a client that explicitly supplies `user_id` bypasses the default entirely. Paired with `with check (true)`, any authenticated user could stamp a report with someone else's id.

This was verified, not reasoned about — against the local stack, using the exact schema from this spec's first draft:

```
CASE: Bob (authenticated) inserts with explicit user_id = Alice's id
Result: INSERT 0 1   → stored_user_id = 11111111-1111-1111-1111-111111111111
Verdict: impersonation succeeded
```

The corrected policy was verified against all four meaningful cases:

| Case | Expected | Result |
|---|---|---|
| `anon` omits `user_id` | succeeds, stored anonymous | ✅ succeeds, `user_id` null |
| authenticated omits `user_id` | succeeds, stamped with real id | ✅ succeeds, stamped correctly |
| authenticated forges another user's id | rejected | ✅ `new row violates row-level security policy` |
| `anon` forges a user's id | rejected | ✅ `new row violates row-level security policy` |

One deliberate consequence: an authenticated user *may* explicitly send `user_id: null` to file a report anonymously. That passes the policy. This is acceptable — arguably desirable — since it lets someone report something sensitive without it being tied to their account.

The `check` constraints on `system`, `platform`, `message` length, and `contact_email` length are not paranoia about testers; they bound what an open-insert endpoint can be made to store. `message` is capped at 5000 characters — long enough for a detailed report with a stack trace pasted in, short enough that the table can't be used to store arbitrary payloads.

#### pgTAP coverage

`supabase/tests/bug_reports.sql`, following the `rls_characters.sql` pattern established in the backend-hardening work:

1. RLS is enabled on `public.bug_reports`.
2. `anon` can insert a report omitting `user_id`.
3. An authenticated user can insert a report omitting `user_id`, and it is stamped with their real `auth.uid()`.
4. An authenticated user attempting to insert with another user's `user_id` is **rejected** (`42501`).
5. `anon` attempting to insert with any non-null `user_id` is **rejected** (`42501`).
6. `anon` selects zero rows.
7. An authenticated user selects zero rows.
8. An invalid `category` is rejected by the check constraint.

Assertions 4 and 5 are the load-bearing ones — they are exactly the case the first draft of this spec got wrong, and the reason this file has a test suite at all rather than trusting the schema by inspection.

### 3. Bug report — client

**New file:** `src/sync/bugReports.ts` — `submitBugReport()`, mirroring `cloudCharacters.ts`'s helper style: gated on `supabaseConfig.enabled`, returns `{ ok: boolean }`, never throws.

**The client never sends `user_id`.** It is omitted from the insert payload entirely, letting the column default supply it. The RLS policy above is what makes this safe rather than merely conventional, but omitting it client-side keeps the two consistent and means an authenticated report is correctly attributed without the client having to know the user's id.

**New file:** `app/(tabs)/report.tsx` — added to the tab bar in `app/(tabs)/_layout.tsx` alongside Characters/Dice/Settings, using the `Bug` icon from `lucide-react-native` (confirmed present in the installed version; already the icon library used throughout).

Form fields:
- Category — segmented control, three options: bug / wrong content / suggestion
- System — optional: none / D&D 5e / WFRP 4e (relevant mainly for content reports, but useful triage context generally)
- Message — required, multiline free text, capped client-side at 5000 characters to match the database constraint (so the limit surfaces as a character counter rather than a server rejection)
- Contact email — optional, pre-filled from the signed-in user's email if there is a session, editable/removable either way

Captured silently, not shown as form fields: app version, platform (`Platform.OS`, already used in `confirm.ts`), and current locale (`useLocale()`, already exists).

**`expo-constants` must be installed explicitly** — `npx expo install expo-constants`. It is currently present in `node_modules` only as a transitive dependency of other Expo packages and is **not** declared in `package.json`. Importing an undeclared transitive dependency works today but breaks silently if hoisting changes or an upstream package drops it; it must be a direct dependency before being imported.

**When Supabase is unconfigured** (`supabaseConfig.enabled === false` — no env keys, the fully-offline configuration the app already supports): the Report tab is hidden from the tab bar entirely, rather than rendering a form that cannot submit. This matches how `AccountSheet` already hides account UI when unconfigured.

On failure or while offline: a plain retry message, per the offline-handling decision above.

### 4. Translation fix — `confirm.ts`

**File:** `src/lib/confirm.ts`

```typescript
{ text: 'Cancel', style: 'cancel' },
{ text: 'Remove', style: 'destructive', onPress: onConfirm },
```

becomes calls through `tr()`. `common.cancel` already exists and is already translated (`'Cancelar'`). `common.remove` does not exist yet — added as `'Remove'` / `'Quitar'`, kept distinct from the existing `common.delete` / `'Eliminar'`, preserving the Remove-vs-Delete distinction the English strings already draw.

**Scope of the change: 19 call sites across 12 files.** All 12 files already call `useTranslation()`, so `tr` is in scope at every one — verified. The change threads `tr` as a parameter (`confirmRemove(tr, message, onConfirm, title)`) rather than converting `confirmRemove` into a hook, since it is invoked from event handlers rather than render bodies. Each call site gains one argument; none is restructured. A missed call site is a TypeScript compile error, not a runtime surprise.

**This fix affects native only.** On web, `confirmRemove` falls back to `window.confirm()`, whose button labels are supplied and localized by the browser itself and cannot be customized. So the visible improvement is on iOS and Android; web behavior is unchanged and already correct (browser-localized).

## Error handling and risk

- **The insert policy is open to anonymous submissions, which is a spam vector.** The anon key ships in the client bundle by design, so anyone who extracts it can post to this table directly, bypassing the app UI entirely. Accepted for a closed beta with ~12 known testers and no public store listing. The check constraints above bound the *size* of what can be stored, but not the *rate*. If abused, the real mitigations are a Postgres rate-limit trigger or moving submission behind an Edge Function that can apply throttling — deliberately not built speculatively, but named here so the response is obvious if it happens.
- **`confirmRemove` signature change touches 19 call sites.** Mechanical, and compile-enforced, but it is the largest surface area in this spec — worth doing in its own commit so it can be reviewed independently of the new feature work.
- **Bug reports have no read-side tooling.** Reviewing means opening Supabase Studio manually. Fine at beta scale; an admin view is out of scope.
- **The Report tab is beta scaffolding occupying permanent tab-bar real estate.** Four tabs is still comfortable, but this should be revisited before a public launch — either moved into Settings or removed once the beta ends. Noted so it does not silently become permanent by default.

## Testing

| Layer | How |
|---|---|
| RLS (`bug_reports`) | pgTAP, `supabase/tests/bug_reports.sql`, run via `npm run test:db` — 8 assertions, including the two impersonation-rejection cases |
| `submitBugReport()` | Jest unit test, mocked Supabase client, mirroring `cloudCharacters.test.ts` — guard clauses (unconfigured → no-op), success path, failure path, and that `user_id` is never included in the payload |
| `confirmRemove` | `npm run typecheck` — a missed `tr` argument at any of the 19 call sites is a compile error |
| Beta badge / report tab UI | Manual, per the repo's existing posture — no RN component test harness |

## Non-goals

- No contextual "report this" shortcut from `WikiModal` — deferred, see Decisions.
- No offline queue for bug reports — deferred, see Decisions.
- No admin UI for reviewing reports — Supabase Studio is sufficient at this scale.
- No rate limiting — accepted risk at beta scale, see Error handling.
- No changes to the D&D 5e sheet itself — the beta badge signals maturity, it does not fix what the badge is about.
- No Spanish content translation — the ES overlay is missing descriptions for ~3,700 entries (name-only today). Real work, needs its own spec, likely a scripted pass like `scripts/translate-spell-es.mjs`.

## Corrections after review

Recorded so the reasoning is not lost, and because two of these were confidently wrong in a way that would have shipped:

1. **Critical — RLS impersonation.** The first draft used `user_id uuid default auth.uid()` with `with check (true)` and explicitly claimed this prevented users from stamping reports with someone else's id. It does not: a column default is skipped whenever the client supplies the column, which PostgREST allows. Verified empirically — the forged insert succeeded. Fixed by constraining the policy to `user_id is null or user_id = auth.uid()`, verified against all four cases. The irony is that the original text cited the `characters`-table impersonation bug caught earlier in this session as the reason the design was safe.
2. **`confirmRemove` scope understated.** The first draft said "~12 call sites"; that was a count of *files*. There are **19** call sites across those 12 files — a ~60% underestimate of the mechanical work.
3. **`expo-constants` dependency misstated.** The first draft said it was "already a transitive Expo dependency — no new install needed." It is present in `node_modules` but **not declared** in `package.json`. Importing an undeclared transitive dependency is fragile; it now requires an explicit `npx expo install expo-constants`.
4. **Added input constraints.** The original schema had no length bound on `message` or `contact_email`, and left `system` unconstrained while `category` had a check — inconsistent, and an unbounded text column behind an open-insert policy. Added length and enum checks.
5. **Added unconfigured-Supabase behavior.** The original spec did not say what the Report tab does when the app runs without Supabase keys. It now hides, matching existing `AccountSheet` behavior.
6. **Clarified the `confirm.ts` fix is native-only.** `window.confirm()` on web does not support custom button labels; the original text implied the fix applied everywhere.
