# Beta Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the app for multi-user beta testing — mark D&D 5e as beta, give testers a bug-report channel, and fix hardcoded English in the native confirm dialog.

**Architecture:** Three independent slices. The beta badge is a one-file UI change. The bug-report feature adds a write-only Supabase table (RLS constrained so a client cannot forge `user_id`), a `submitBugReport()` helper mirroring `cloudCharacters.ts`, and a new tab screen. The translation fix threads `tr` through `confirmRemove` at 19 call sites.

**Tech Stack:** Expo SDK 56 · React Native 0.85 · TypeScript strict · Supabase (Postgres + RLS) · pgTAP · jest-expo. Verify: `npm run typecheck`, `npm test`, `npm run test:db`.

**Spec:** `docs/superpowers/specs/2026-08-07-beta-readiness-design.md`

**Sequence:** Standalone. Builds on the merged backend-hardening work (migrations, `npm run test:db`, `supabase/tests/` pattern).

---

## Prerequisites

The local Supabase stack must be running for Tasks 3 and 8:

```bash
npm run db:start
```

Tasks 1, 2, 4, 5, 6, 7 need no backend.

---

## File map

| File | Change |
|---|---|
| `src/i18n/en.ts` | Modify — add `common.remove`, `common.removeTitle`, `create.betaLabel`, `tabs.report`, `report.*` |
| `src/i18n/es.ts` | Modify — Spanish overlay for the same keys |
| `src/components/ui/CreateCharacterModal.tsx` | Modify — `beta` flag on the D&D entry + badge rendering + style |
| `src/lib/confirm.ts` | Modify — accept `tr`, translate button labels and default title |
| 12 component files | Modify — pass `tr` as first arg to `confirmRemove` (19 call sites) |
| `supabase/migrations/<ts>_bug_reports.sql` | Create — `bug_reports` table, RLS, grants |
| `supabase/tests/bug_reports.sql` | Create — 9 pgTAP assertions |
| `package.json` | Modify — add `expo-constants` |
| `src/sync/bugReports.ts` | Create — `submitBugReport()` |
| `src/sync/__tests__/bugReports.test.ts` | Create — guard clauses, payload shape, failure path |
| `app/(tabs)/report.tsx` | Create — the report form screen |
| `app/(tabs)/_layout.tsx` | Modify — register the Report tab, hidden when Supabase is unconfigured |
| `TODO.md` | Modify — record what shipped |

---

## Task 1: Beta badge on D&D 5e

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`
- Modify: `src/components/ui/CreateCharacterModal.tsx`

- [ ] **Step 1: Add the i18n key (EN)**

In `src/i18n/en.ts`, inside the `create` object (after `namePlaceholder`):

```typescript
    betaLabel: 'Beta',
```

- [ ] **Step 2: Add the i18n key (ES)**

In `src/i18n/es.ts`, inside its `create` object (after `namePlaceholder`):

```typescript
    betaLabel: 'Beta',
```

(Same word in both languages, but routed through `tr()` so a future wording change is one edit.)

- [ ] **Step 3: Add the `beta` flag to the SYSTEMS array**

In `src/components/ui/CreateCharacterModal.tsx`, replace the `SYSTEMS` constant:

```typescript
const SYSTEMS: { id: GameSystem; label: string; sub: string; beta?: boolean }[] = [
  { id: 'dnd5e',  label: 'D&D 5e',       sub: 'Dungeons & Dragons 5th Edition', beta: true },
  { id: 'wfrp4e', label: 'WFRP 4e',      sub: 'Warhammer Fantasy Roleplay' },
];
```

- [ ] **Step 4: Render the badge**

In the same file, replace the system label `<Text>` block inside `SYSTEMS.map(...)`:

```tsx
                  <Text style={[styles.systemLabel, { color: active ? t.colors.accent : t.colors.text }]}>
                    {s.label}
                  </Text>
```

with a row containing the label plus the conditional badge:

```tsx
                  <View style={styles.systemLabelRow}>
                    <Text style={[styles.systemLabel, { color: active ? t.colors.accent : t.colors.text }]}>
                      {s.label}
                    </Text>
                    {s.beta && (
                      <View style={[styles.betaBadge, { borderColor: t.colors.textMuted }]}>
                        <Text style={[styles.betaBadgeText, { color: t.colors.textMuted }]}>
                          {tr('create.betaLabel')}
                        </Text>
                      </View>
                    )}
                  </View>
```

- [ ] **Step 5: Add the styles**

In the same file's `StyleSheet.create` block, after `systemLabel`:

```typescript
  systemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  betaBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  betaBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: clean (pre-existing Deno errors in `supabase/functions/delete-account/index.ts` are expected and out of scope — that file is intentionally outside the Node toolchain).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts src/components/ui/CreateCharacterModal.tsx
git commit -m "feat(ui): mark D&D 5e as beta in the system picker"
```

---

## Task 2: Translate the native confirm dialog

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`
- Modify: `src/lib/confirm.ts`
- Modify: 12 component files (19 call sites, listed in Step 4)

The current `confirmRemove` hardcodes three English strings: the two button labels *and* the default `title = 'Remove?'` parameter. All three are fixed here.

- [ ] **Step 1: Add i18n keys (EN)**

In `src/i18n/en.ts`, inside `common` (after `save`):

```typescript
    remove: 'Remove',
    removeTitle: 'Remove?',
```

- [ ] **Step 2: Add i18n keys (ES)**

In `src/i18n/es.ts`, inside `common` (after `save`):

```typescript
    remove: 'Quitar',
    removeTitle: '¿Quitar?',
```

`Quitar` is deliberately distinct from the existing `delete: 'Eliminar'` — it preserves the remove-from-list vs delete-permanently distinction the English strings already draw.

- [ ] **Step 3: Rewrite `confirm.ts`**

Replace the entire contents of `src/lib/confirm.ts`:

```typescript
import { Alert, Platform } from 'react-native';
import type { TFunc } from '@/i18n';

/**
 * Cross-platform destructive confirm. react-native-web does not render `Alert.alert`
 * (it's a no-op), so on web we fall back to the browser `confirm` dialog — this is why
 * delete buttons silently did nothing on web. Calls `onConfirm` only if the user agrees.
 *
 * `tr` is threaded in rather than imported: the active locale lives in React state
 * (LocaleProvider), so it cannot be read from module scope. Every call site is inside a
 * component that already calls useTranslation().
 *
 * Note the web branch cannot translate its buttons — `window.confirm` renders
 * browser-supplied, browser-localized OK/Cancel labels that cannot be customized.
 */
export function confirmRemove(
  tr: TFunc,
  message: string,
  onConfirm: () => void,
  title?: string,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert(title ?? tr('common.removeTitle'), message, [
    { text: tr('common.cancel'), style: 'cancel' },
    { text: tr('common.remove'), style: 'destructive', onPress: onConfirm },
  ]);
}
```

- [ ] **Step 4: Update all 19 call sites**

The change at every site is mechanical: insert `tr,` as the new first argument. Every one of these files already calls `useTranslation()` at the top of its component, so `tr` is in scope — verified.

Exact sites:

| File | Lines |
|---|---|
| `src/components/ui/AccountSheet.tsx` | 106 |
| `src/components/dnd5e/Spellcasting.tsx` | 142, 173 |
| `src/components/dnd5e/FeaturesSection.tsx` | 56 |
| `src/components/dnd5e/Inventory.tsx` | 45 |
| `src/components/dnd5e/Attacks.tsx` | 54 |
| `src/components/wfrp4e/WfrpSkills.tsx` | 54, 110 |
| `src/components/wfrp4e/Trappings.tsx` | 85, 178 |
| `src/components/wfrp4e/Combat.tsx` | 85, 148 |
| `src/components/wfrp4e/CorruptionSin.tsx` | 60 |
| `src/components/wfrp4e/Talents.tsx` | 81, 123 |
| `src/components/wfrp4e/Magic.tsx` | 76, 117 |
| `src/components/wfrp4e/Buffs.tsx` | 76, 156 |

The sites take three shapes. Examples of each, showing before → after:

*Shape A — inline, two args* (`Buffs.tsx:156`):

```tsx
onPress={() => confirmRemove(tr('wfrp.buffs.clearAllConfirm', { n: stored.length }), () => onChange({ buffs: [] }))}
```
becomes
```tsx
onPress={() => confirmRemove(tr, tr('wfrp.buffs.clearAllConfirm', { n: stored.length }), () => onChange({ buffs: [] }))}
```

*Shape B — inline, three args with explicit title* (`Spellcasting.tsx:142`):

```tsx
onPress={() => confirmRemove(tr('dnd.spells.deleteConfirm', { name: spell.name }), () => deleteSpell(spell.id), tr('dnd.spells.deleteTitle'))}
```
becomes
```tsx
onPress={() => confirmRemove(tr, tr('dnd.spells.deleteConfirm', { name: spell.name }), () => deleteSpell(spell.id), tr('dnd.spells.deleteTitle'))}
```

*Shape C — multi-line* (`AccountSheet.tsx:106`):

```tsx
    confirmRemove(
      tr('settings.account.removeCloudDataConfirm'),
```
becomes
```tsx
    confirmRemove(
      tr,
      tr('settings.account.removeCloudDataConfirm'),
```

- [ ] **Step 5: Typecheck — this is the completeness check**

```bash
npm run typecheck
```

Expected: clean. A missed call site is a TypeScript error (`Argument of type 'string' is not assignable to parameter of type 'TFunc'`), so a clean typecheck proves all 19 were updated. If any error appears, fix that site and re-run.

- [ ] **Step 6: Run the test suite**

```bash
npm test
```

Expected: 188 passing, 17 suites — unchanged. No existing test touches `confirmRemove`, so this is a regression check.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts src/lib/confirm.ts src/components
git commit -m "fix(i18n): translate native confirm dialog buttons and title"
```

---

## Task 3: `bug_reports` table + RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_bug_reports.sql`
- Create: `supabase/tests/bug_reports.sql`

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new bug_reports
```

This creates `supabase/migrations/<timestamp>_bug_reports.sql`. Put this in it:

```sql
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'content', 'suggestion')),
  message text not null check (char_length(message) between 1 and 5000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  system text check (system is null or system in ('dnd5e', 'wfrp4e')),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  platform text check (platform is null or platform in ('ios', 'android', 'web')),
  locale text check (locale is null or char_length(locale) <= 16),
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

-- A DEFAULT does not protect a column: Postgres skips it whenever the client supplies
-- the column, and PostgREST forwards whatever JSON the client sends. So the policy —
-- not the default — is what stops a caller stamping a report with someone else's id.
-- Anonymous reports (user_id null) stay allowed, including from signed-in users who
-- deliberately omit it.
create policy "submit own or anonymous"
  on public.bug_reports for insert
  with check (user_id is null or user_id = auth.uid());

-- ALTER DEFAULT PRIVILEGES in the baseline migration auto-grants
-- SELECT/INSERT/UPDATE/DELETE on every new public table to anon and authenticated.
-- No explicit revoke here — RLS alone makes the table write-only in practice, the
-- same pattern already proven on public.characters. Revoking table-level SELECT or
-- UPDATE/DELETE grants doesn't just close reads: it changes the *error mode*. With
-- the grant present and RLS blocking, a SELECT with no matching policy returns zero
-- rows silently; an UPDATE/DELETE with no matching policy runs and affects zero rows.
-- Without the grant, those same statements throw "permission denied" before RLS is
-- ever consulted — a real behavior difference, not a cosmetic one.
```

- [ ] **Step 2: Apply the migration locally**

```bash
npx supabase db reset
```

Expected: replays all migrations from empty, ending with `bug_reports`. No errors.

- [ ] **Step 3: Write the pgTAP test**

Create `supabase/tests/bug_reports.sql`:

```sql
-- supabase/tests/bug_reports.sql
begin;
select plan(9);

-- 1. RLS is on
select ok(
  (select relrowsecurity from pg_class where oid = 'public.bug_reports'::regclass),
  'RLS is enabled on public.bug_reports'
);

-- Fixture: two auth users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

-- 2. anon can submit an anonymous report
set local role anon;
reset request.jwt.claims;

select lives_ok(
  $$ insert into public.bug_reports (category, message) values ('bug', 'anon report') $$,
  'anon can submit a report'
);

-- 3. anon cannot forge a user_id
select throws_ok(
  $$ insert into public.bug_reports (category, message, user_id)
     values ('bug', 'forged by anon', '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'anon cannot submit with a forged user_id'
);

-- 4. authenticated user can submit
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  $$ insert into public.bug_reports (category, message) values ('bug', 'bob report') $$,
  'authenticated user can submit a report'
);

-- 5. that submission was stamped with the real auth.uid()
--    (read as superuser — there is no select policy, so no client role can verify this)
reset role;
select is(
  (select user_id::text from public.bug_reports where message = 'bob report'),
  '22222222-2222-2222-2222-222222222222',
  'authenticated submission is stamped with the real auth.uid()'
);

-- 6. authenticated user cannot forge another user's id
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ insert into public.bug_reports (category, message, user_id)
     values ('bug', 'forged by bob', '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'authenticated user cannot submit with another user''s user_id'
);

-- 7. authenticated user reads zero rows
select is(
  (select count(*)::int from public.bug_reports),
  0,
  'authenticated user cannot read any reports'
);

-- 8. anon reads zero rows
set local role anon;
reset request.jwt.claims;

select is(
  (select count(*)::int from public.bug_reports),
  0,
  'anon cannot read any reports'
);

-- 9. invalid category is rejected by the check constraint
select throws_ok(
  $$ insert into public.bug_reports (category, message) values ('nonsense', 'bad category') $$,
  '23514',
  null,
  'invalid category is rejected by the check constraint'
);

select * from finish();
rollback;
```

Assertion count: `ok` ×1, `lives_ok` ×2, `throws_ok` ×3, `is` ×3 = **9**, matching `plan(9)`. Verify this count by hand before running — a mismatch fails the suite with a confusing "planned N but ran M" error rather than a real assertion failure.

- [ ] **Step 4: Run the tests**

```bash
npm run test:db
```

Expected: `Files=2, Tests=21` — the 12 existing `rls_characters` assertions plus these 9 — `Result: PASS`.

- [ ] **Step 5: Prove assertions 3 and 6 are load-bearing**

These two are the whole reason this table has a test suite; the spec's first draft shipped a policy that would fail them. Confirm they actually catch a regression: temporarily change the policy in the migration to `with check (true)`, then:

```bash
npx supabase db reset && npm run test:db
```

Expected: assertions 3 and 6 **fail** (the forged inserts succeed when they should throw). Then restore `with check (user_id is null or user_id = auth.uid())`, re-run `npx supabase db reset && npm run test:db`, and confirm 21/21 pass again. Verify with `git diff` that the migration file ends byte-identical to Step 1 before committing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations supabase/tests/bug_reports.sql
git commit -m "feat(supabase): bug_reports table with forge-proof RLS + pgTAP coverage"
```

---

## Task 4: Add `expo-constants` as a direct dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

`expo-constants` is present in `node_modules` only as a transitive dependency of other Expo packages. Importing an undeclared transitive dependency works today but breaks silently if hoisting changes or an upstream package drops it.

- [ ] **Step 1: Install it**

```bash
npx expo install expo-constants
```

- [ ] **Step 2: Verify it is now declared**

```bash
grep '"expo-constants"' package.json
```

Expected: one line showing the version under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-constants as a direct dependency"
```

---

## Task 5: `submitBugReport()` helper

**Files:**
- Create: `src/sync/bugReports.ts`
- Create: `src/sync/__tests__/bugReports.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sync/__tests__/bugReports.test.ts`:

```typescript
import { submitBugReport } from '../bugReports';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/lib/config', () => ({
  supabaseConfig: { enabled: true },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';

const validInput = {
  category: 'bug' as const,
  message: 'Something is broken',
  contactEmail: null,
  system: null,
  locale: 'en',
};

describe('submitBugReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fails when sync is not configured', async () => {
    (supabaseConfig as any).enabled = false;
    const result = await submitBugReport(validInput);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false });
    (supabaseConfig as any).enabled = true;
  });

  it('inserts into bug_reports and returns ok on success', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const result = await submitBugReport(validInput);

    expect(supabase.from).toHaveBeenCalledWith('bug_reports');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'bug',
        message: 'Something is broken',
        app_version: '1.0.0',
        locale: 'en',
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('never sends user_id — the database default and RLS policy own that column', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await submitBugReport(validInput);

    expect(insert.mock.calls[0][0]).not.toHaveProperty('user_id');
  });

  it('trims the message and normalizes an empty contact email to null', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await submitBugReport({ ...validInput, message: '  padded  ', contactEmail: '   ' });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'padded', contact_email: null }),
    );
  });

  it('returns ok:false when the insert fails', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const result = await submitBugReport(validInput);

    expect(result).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- src/sync/__tests__/bugReports.test.ts
```

Expected: FAIL — `Cannot find module '../bugReports'`.

- [ ] **Step 3: Implement the helper**

Create `src/sync/bugReports.ts`:

```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import type { GameSystem } from '@/types';

export type ReportCategory = 'bug' | 'content' | 'suggestion';

export type BugReportInput = {
  category: ReportCategory;
  message: string;
  contactEmail: string | null;
  system: GameSystem | null;
  locale: string;
};

/** Submit a beta tester's bug report. Never throws.
 *
 *  Unlike the cloud-sync helpers, an unconfigured Supabase is reported as a failure
 *  rather than a silent no-op: the user pressed Send and their report went nowhere,
 *  which they need to know. (The Report tab is hidden when unconfigured, so this is
 *  a defensive guard rather than a path users normally reach.)
 *
 *  `user_id` is deliberately absent from the payload — the column's `default auth.uid()`
 *  supplies it server-side, and the RLS policy rejects any client-supplied value that
 *  isn't the caller's own id. */
export async function submitBugReport(input: BugReportInput): Promise<{ ok: boolean }> {
  if (!supabaseConfig.enabled) return { ok: false };

  const { error } = await supabase.from('bug_reports').insert({
    category: input.category,
    message: input.message.trim(),
    contact_email: input.contactEmail?.trim() || null,
    system: input.system,
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    locale: input.locale,
  });

  if (error) {
    console.warn('[report] submit failed:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test -- src/sync/__tests__/bugReports.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/sync/bugReports.ts src/sync/__tests__/bugReports.test.ts
git commit -m "feat(sync): add submitBugReport helper"
```

---

## Task 6: i18n keys for the report screen

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Add the tab label and `report` section (EN)**

In `src/i18n/en.ts`, add to the `tabs` object (after `settings`):

```typescript
    report: 'Report',
```

Then add a new top-level `report` section immediately after the `tabs` object closes:

```typescript
  report: {
    title: 'Report a problem',
    subtitle: 'The app is in beta. Tell us what broke, what reads wrong, or what you wish it did.',
    category: 'Type',
    categoryBug: 'Bug',
    categoryContent: 'Wrong content',
    categorySuggestion: 'Suggestion',
    system: 'Game system',
    systemNone: 'Not specific',
    systemDnd: 'D&D 5e',
    systemWfrp: 'WFRP 4e',
    message: 'What happened?',
    messagePlaceholder: 'Describe the problem, what you expected, and how to reproduce it…',
    contactEmail: 'Email (optional)',
    contactEmailPlaceholder: 'you@example.com',
    contactEmailHint: 'Only used if we need to ask a follow-up question.',
    submit: 'Send report',
    submitting: 'Sending…',
    successTitle: 'Report sent',
    successBody: 'Thank you — this is genuinely useful.',
    sendAnother: 'Send another',
    error: 'Could not send your report. Check your connection and try again.',
  },
```

- [ ] **Step 2: Add the Spanish overlay (ES)**

In `src/i18n/es.ts`, add to its `tabs` object:

```typescript
    report: 'Reportar',
```

And the matching `report` section after `tabs`:

```typescript
  report: {
    title: 'Reportar un problema',
    subtitle: 'La app está en beta. Cuéntanos qué falló, qué está mal escrito o qué te gustaría que hiciera.',
    category: 'Tipo',
    categoryBug: 'Error',
    categoryContent: 'Contenido incorrecto',
    categorySuggestion: 'Sugerencia',
    system: 'Sistema de juego',
    systemNone: 'No específico',
    systemDnd: 'D&D 5e',
    systemWfrp: 'WFRP 4e',
    message: '¿Qué pasó?',
    messagePlaceholder: 'Describe el problema, qué esperabas y cómo reproducirlo…',
    contactEmail: 'Correo (opcional)',
    contactEmailPlaceholder: 'tu@ejemplo.com',
    contactEmailHint: 'Solo se usa si necesitamos hacerte una pregunta de seguimiento.',
    submit: 'Enviar reporte',
    submitting: 'Enviando…',
    successTitle: 'Reporte enviado',
    successBody: 'Gracias — esto es de mucha ayuda.',
    sendAnother: 'Enviar otro',
    error: 'No se pudo enviar tu reporte. Revisa tu conexión e inténtalo de nuevo.',
  },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean. `es.ts` is typed `DeepPartial<Messages>`, so a mistyped key is a compile error.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts
git commit -m "i18n: add bug-report screen strings (EN/ES)"
```

---

## Task 7: Report tab screen

**Files:**
- Create: `app/(tabs)/report.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create the screen**

Create `app/(tabs)/report.tsx`:

```tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale, type TKey } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { textStyle } from '@/tokens/typography';
import { submitBugReport, type ReportCategory } from '@/sync/bugReports';
import type { GameSystem } from '@/types';

const CATEGORIES: { id: ReportCategory; labelKey: TKey }[] = [
  { id: 'bug', labelKey: 'report.categoryBug' },
  { id: 'content', labelKey: 'report.categoryContent' },
  { id: 'suggestion', labelKey: 'report.categorySuggestion' },
];

const SYSTEMS: { id: GameSystem | null; labelKey: TKey }[] = [
  { id: null, labelKey: 'report.systemNone' },
  { id: 'dnd5e', labelKey: 'report.systemDnd' },
  { id: 'wfrp4e', labelKey: 'report.systemWfrp' },
];

// Matches the database check constraint on bug_reports.message, so the limit surfaces
// as a character counter instead of a server-side rejection.
const MAX_MESSAGE = 5000;

export default function ReportScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const { locale } = useLocale();
  const { session } = useAuth();

  const [category, setCategory] = useState<ReportCategory>('bug');
  const [system, setSystem] = useState<GameSystem | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = message.trim().length > 0 && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const { ok } = await submitBugReport({
      category,
      message,
      contactEmail: email,
      system,
      locale,
    });
    setSubmitting(false);
    if (!ok) { setError(tr('report.error')); return; }
    setSent(true);
  }

  function reset() {
    setCategory('bug');
    setSystem(null);
    setMessage('');
    setError(null);
    setSent(false);
  }

  function chipRow<T extends string | null>(
    options: { id: T; labelKey: TKey }[],
    value: T,
    onSelect: (v: T) => void,
  ) {
    return (
      <View style={styles.chipRow}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <TouchableOpacity
              key={String(o.id)}
              style={[styles.chip, {
                borderColor: active ? t.colors.accent : t.colors.border,
                backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
              }]}
              onPress={() => onSelect(o.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: active ? t.colors.accent : t.colors.textMuted }]}>
                {tr(o.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (sent) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <View style={styles.successWrap}>
          <CircleCheck size={48} color={t.colors.success} />
          <Text style={[styles.successTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {tr('report.successTitle')}
          </Text>
          <Text style={[styles.successBody, { color: t.colors.textSecondary }]}>
            {tr('report.successBody')}
          </Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: t.colors.border }]}
            onPress={reset}
          >
            <Text style={[styles.secondaryBtnText, { color: t.colors.accent }]}>
              {tr('report.sendAnother')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {tr('report.title')}
          </Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
            {tr('report.subtitle')}
          </Text>

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.category')}</Text>
          {chipRow(CATEGORIES, category, setCategory)}

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.system')}</Text>
          {chipRow(SYSTEMS, system, setSystem)}

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.message')}</Text>
          <TextInput
            style={[styles.messageInput, {
              color: t.colors.text,
              borderColor: t.colors.border,
              backgroundColor: t.colors.backgroundSecondary,
            }]}
            value={message}
            onChangeText={setMessage}
            placeholder={tr('report.messagePlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={MAX_MESSAGE}
          />
          <Text style={[styles.counter, { color: t.colors.textMuted }]}>
            {message.length} / {MAX_MESSAGE}
          </Text>

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.contactEmail')}</Text>
          <TextInput
            style={[styles.input, {
              color: t.colors.text,
              borderColor: t.colors.border,
              backgroundColor: t.colors.backgroundSecondary,
            }]}
            value={email}
            onChangeText={setEmail}
            placeholder={tr('report.contactEmailPlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            inputMode="email"
          />
          <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('report.contactEmailHint')}</Text>

          {error && <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, {
              backgroundColor: t.colors.accent,
              opacity: canSubmit ? 1 : 0.5,
            }]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={[styles.submitBtnText, { color: t.colors.accentText }]}>
              {submitting ? tr('report.submitting') : tr('report.submit')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  heading: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  fieldLabel: { ...textStyle.fieldLabel, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  messageInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, minHeight: 140,
  },
  counter: { fontSize: 11, textAlign: 'right' },
  hint: { fontSize: 12, lineHeight: 16 },
  error: { fontSize: 13, marginTop: 4 },
  submitBtn: { borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontSize: 15, fontWeight: '700' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: '700' },
  successBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  secondaryBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Register the tab**

In `app/(tabs)/_layout.tsx`, add these imports:

```typescript
import { Users, Dices, Settings, Bug } from 'lucide-react-native';
import { supabaseConfig } from '@/lib/config';
```

(the `lucide-react-native` import line already exists — add `Bug` to it rather than duplicating the import.)

Then add a new `Tabs.Screen` between the `dice` and `settings` screens:

```tsx
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

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Verify in the browser against the local stack**

Ensure the local stack is running (`npm run db:start`) and `.env.local` points at it, then:

```bash
npm run web
```

Check, by hand:
- A "Report" tab appears in the tab bar with a bug icon.
- Selecting each category and system chip visibly highlights it.
- Send is disabled while the message is empty, enabled once text is typed.
- Submitting a report shows the success screen; "Send another" returns to a cleared form.
- The report actually landed: open Supabase Studio at `http://127.0.0.1:54323`, table editor, `bug_reports` — the row is present with the right `category`, `message`, `platform` (`web`), `locale`, and `app_version`.
- Signed out, `user_id` is null. Sign in, submit again, and confirm the second row has your real `user_id` — proving the server-side default works through the real client, not just in pgTAP.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/report.tsx" "app/(tabs)/_layout.tsx"
git commit -m "feat(ui): add bug-report tab"
```

---

## Task 8: Update TODO.md

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Add a shipped entry**

In `TODO.md`, under "Near-term features", add after the backend-hardening entry:

```markdown
- [x] **Beta readiness — D&D beta badge, bug-report tab, translated confirm dialog.** D&D 5e is marked `Beta` in the create-character system picker so testers know it trails WFRP. A Report tab (`app/(tabs)/report.tsx`) lets testers file bugs, wrong-content reports, and suggestions into a write-only `bug_reports` Supabase table — anonymous submission allowed, with the RLS policy (`user_id is null or user_id = auth.uid()`) rejecting forged user ids, since a column default alone does not stop a client from supplying its own value. Reports capture app version, platform, and locale automatically. The tab hides when Supabase is unconfigured. Also fixed: `confirmRemove` hardcoded English "Cancel"/"Remove"/"Remove?" in the native alert on all 19 call sites — now translated (web is unaffected; `window.confirm` labels are browser-supplied). Plan: `docs/superpowers/plans/2026-08-07-beta-readiness.md`.
```

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: record beta readiness work in TODO.md"
```

---

## Final verification

- [ ] **Full suite**

```bash
npm run typecheck
npm test
npm run test:db
```

Expected:
- typecheck clean (except the known, out-of-scope Deno errors in `supabase/functions/delete-account/index.ts`)
- jest: 193 tests across 18 suites (188 existing + 5 new from Task 5)
- pgTAP: `Files=2, Tests=21`, `Result: PASS`

- [ ] **Stop the local stack when done**

```bash
npm run db:stop
```
