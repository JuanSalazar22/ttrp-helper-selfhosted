# i18n / Translations Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an English/Spanish translation engine (custom typed `t()` + `LocaleProvider`) and make the WFRP content store locale-ready, translating only one reference screen.

**Architecture:** A pure `translate()` string machine plus nested `en`/`es` dictionaries, wrapped in a `LocaleProvider` that mirrors the existing `ThemeProvider` (context + persisted SQLite setting). A `content_translations` overlay table + locale-threaded resolver lets Spanish book content be slotted in later; with no Spanish rows it is a pure passthrough.

**Tech Stack:** TypeScript (strict), React Native / Expo Router, expo-sqlite, jest-expo. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-23-translations-architecture-design.md`

---

## File Structure

**New:**
- `src/i18n/types.ts` — `Locale`, `Messages`, `TKey` (dot-path union), `TParams`, `DeepPartial`.
- `src/i18n/en.ts` — English dictionary (only the namespaces the reference screen needs).
- `src/i18n/es.ts` — `DeepPartial<Messages>`, starts empty; runtime falls back to English.
- `src/i18n/translate.ts` — pure `translate(active, fallback, key, params)`: interpolation + plural + fallback.
- `src/i18n/LocaleProvider.tsx` — context `{ locale, setLocale, t }`; `useLocale()`, `useTranslation()`.
- `src/i18n/index.ts` — public re-exports.
- `src/i18n/__tests__/translate.test.ts` — unit tests for `translate`.
- `src/db/__tests__/contentOverlay.test.ts` — unit test for `applyOverlay`.

**Modified:**
- `src/db/schema.ts` — add `content_translations` table.
- `src/db/queries.ts` — add `applyOverlay`, `seedContentTranslations`; thread optional `locale` into `getContentByIds` / `searchContent`.
- `app/_layout.tsx` — mount `LocaleProvider`; read/persist `locale` in `PrefLoader`.
- `app/(tabs)/settings.tsx` — Language segment via `useLocale`.
- `app/(tabs)/index.tsx` — migrate Characters screen strings to `t()`; date uses active locale.
- `src/components/wfrp4e/ContentPicker.tsx` — pass active locale into `searchContent` (reference content-side wiring).

**Convention note:** This codebase has **only pure-function jest tests** (`src/types/__tests__`, `src/dice/__tests__`) — no React-component or db-mock tests. This plan keeps to that: testable logic is extracted into pure functions (`translate`, `applyOverlay`); providers and screens are verified by typecheck + the web preview, not unit tests.

**Verify commands (used throughout):**
- Typecheck: `npm run typecheck` (the bare `tsc --noEmit` overflows the stack; always use this script).
- Tests: `npm test`

---

## Task 1: i18n types + dictionaries

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/es.ts`

- [ ] **Step 1: Create the English dictionary**

`src/i18n/en.ts` — a plain object (no `as const`, no imports, so `typeof en` yields `string` leaves and `{one,other}` plural leaves). Only the keys the Characters reference screen needs:

```ts
// English message dictionary. This is the single source of truth for the key space:
// `Messages = typeof en`. Spanish (es.ts) is a partial overlay of this shape.
export const en = {
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
  },
  characters: {
    title: 'Characters',
    emptyTitle: 'No characters yet',
    emptyBody: 'Tap + to create your first character.',
    importFailedTitle: 'Import failed',
    importFailedBody: 'Could not read that file.',
    duplicateA11y: 'Duplicate {name}',
    deleteA11y: 'Delete {name}',
  },
};
```

- [ ] **Step 2: Create the types**

`src/i18n/types.ts`:

```ts
import { en } from './en';

export type Locale = 'en' | 'es';

// Values allowed in interpolation. `count` (number) also drives plural selection.
export type TParams = Record<string, string | number>;

// The full message tree shape, derived from the English source of truth.
export type Messages = typeof en;

// Dot-path keys of the message tree, stopping at string leaves or {one,other} plural leaves.
type PathsOf<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends { one: string; other: string }
      ? K
      : T[K] extends object
        ? `${K}.${PathsOf<T[K]>}`
        : never;
}[keyof T & string];

export type TKey = PathsOf<Messages>;

// Spanish may omit any key; omissions fall back to English at runtime.
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```

- [ ] **Step 3: Create the (empty) Spanish dictionary**

`src/i18n/es.ts` — intentionally empty for now (architecture only; no strings translated):

```ts
import type { Messages, DeepPartial } from './types';

// Spanish overlay. Empty for now — every key falls back to English until authored.
export const es: DeepPartial<Messages> = {};
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): typed message dictionaries (en source of truth, es overlay)"
```

---

## Task 2: Pure `translate()` function (TDD)

**Files:**
- Create: `src/i18n/__tests__/translate.test.ts`
- Create: `src/i18n/translate.ts`

`translate` is intentionally **stringly-typed** (`key: string`). Compile-time key safety is enforced one level up, at `LocaleProvider`'s `t` (Task 3). This keeps `translate` a pure, fixture-testable string machine.

- [ ] **Step 1: Write the failing tests**

`src/i18n/__tests__/translate.test.ts`:

```ts
import { translate } from '../translate';

const en = {
  greeting: 'Hello {name}',
  plain: 'Settings',
  items: { one: '{count} item', other: '{count} items' },
};
const es = {
  plain: 'Ajustes',
  // greeting and items intentionally omitted to test fallback
};

describe('translate', () => {
  test('returns the active-locale string when present', () => {
    expect(translate(es, en, 'plain')).toBe('Ajustes');
  });

  test('falls back to the fallback dict when the active key is missing', () => {
    expect(translate(es, en, 'greeting', { name: 'Karl' })).toBe('Hello Karl');
  });

  test('interpolates {placeholder} params', () => {
    expect(translate(en, en, 'greeting', { name: 'Karl' })).toBe('Hello Karl');
  });

  test('selects the plural "one" form when count === 1', () => {
    expect(translate(en, en, 'items', { count: 1 })).toBe('1 item');
  });

  test('selects the plural "other" form when count !== 1', () => {
    expect(translate(en, en, 'items', { count: 3 })).toBe('3 items');
  });

  test('returns the raw key when the key is absent everywhere', () => {
    expect(translate(es, en, 'missing.key')).toBe('missing.key');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- translate`
Expected: FAIL — `Cannot find module '../translate'`.

- [ ] **Step 3: Implement `translate`**

`src/i18n/translate.ts`:

```ts
import type { TParams } from './types';

// Walk a dot-path into a nested dictionary; return the node or undefined.
function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object'
        ? (node as Record<string, unknown>)[part]
        : undefined,
    dict,
  );
}

// Replace {name} placeholders with params; leave unknown placeholders intact.
function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k: string) =>
    params[k] != null ? String(params[k]) : `{${k}}`,
  );
}

function isPlural(node: unknown): node is { one?: string; other?: string } {
  return !!node && typeof node === 'object' && 'other' in (node as object);
}

/**
 * Resolve a message key against the active dictionary, falling back to `fallback`
 * (English). Supports {placeholder} interpolation and {one,other} pluralisation
 * driven by params.count. Never throws: an absent key returns the key string.
 */
export function translate(
  active: unknown,
  fallback: unknown,
  key: string,
  params?: TParams,
): string {
  let node = lookup(active, key);
  if (node == null) node = lookup(fallback, key);

  if (isPlural(node)) {
    const count = typeof params?.count === 'number' ? params.count : 0;
    const form: 'one' | 'other' = count === 1 ? 'one' : 'other';
    let pn = (node as Record<string, unknown>)[form];
    if (pn == null) pn = lookup(fallback, `${key}.${form}`);
    node = pn;
  }

  if (typeof node !== 'string') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[i18n] missing translation key: ${key}`);
    }
    return key;
  }
  return interpolate(node, params);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- translate`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translate.ts src/i18n/__tests__/translate.test.ts
git commit -m "feat(i18n): pure translate() with interpolation, plural, fallback"
```

---

## Task 3: LocaleProvider + public API

**Files:**
- Create: `src/i18n/LocaleProvider.tsx`
- Create: `src/i18n/index.ts`

- [ ] **Step 1: Implement the provider**

`src/i18n/LocaleProvider.tsx` — mirrors `ThemeProvider` (state + optional `onChange` callback). `t` is memoised over the active locale and enforces `TKey` at the call site:

```tsx
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { en } from './en';
import { es } from './es';
import { translate } from './translate';
import type { Locale, TKey, TParams } from './types';

const DICTS: Record<Locale, unknown> = { en, es };

export type TFunc = (key: TKey, params?: TParams) => string;

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: TFunc };
const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({
  children,
  onLocaleChange,
}: {
  children: ReactNode;
  onLocaleChange?: (l: Locale) => void;
}) {
  const [locale, setLocaleState] = useState<Locale>('en');

  const setLocale = useCallback(
    (l: Locale) => {
      if (l !== 'en' && l !== 'es') return; // ignore unknown values
      setLocaleState(l);
      onLocaleChange?.(l);
    },
    [onLocaleChange],
  );

  const t = useMemo<TFunc>(
    () => (key, params) => translate(DICTS[locale], en, key, params),
    [locale],
  );

  return <LocaleCtx.Provider value={{ locale, setLocale, t }}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

export function useTranslation(): TFunc {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error('useTranslation must be used within LocaleProvider');
  return ctx.t;
}
```

- [ ] **Step 2: Create the public barrel**

`src/i18n/index.ts`:

```ts
export { LocaleProvider, useLocale, useTranslation, type TFunc } from './LocaleProvider';
export type { Locale, TKey } from './types';
```

- [ ] **Step 3: Verify typecheck + existing tests still pass**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/LocaleProvider.tsx src/i18n/index.ts
git commit -m "feat(i18n): LocaleProvider, useLocale, useTranslation"
```

---

## Task 4: Wire LocaleProvider into the app + Settings toggle

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Mount the provider and persist locale in `app/_layout.tsx`**

Add the import near the other hook imports:

```tsx
import { LocaleProvider, useLocale, type Locale } from '@/i18n';
```

In `PrefLoader`, pull `setLocale` from context and load the saved locale. Change the component to:

```tsx
function PrefLoader({ db }: { db: ReturnType<typeof useSQLiteContext> }) {
  const { setMode } = useThemeMode();
  const { setLocale } = useLocale();
  useEffect(() => {
    (async () => {
      const m = await getSetting(db, 'theme_mode');
      if (m === 'light' || m === 'dark' || m === 'system') setMode(m as ThemeMode);
      const loc = await getSetting(db, 'locale');
      if (loc === 'en' || loc === 'es') setLocale(loc);
      const h = await getSetting(db, 'haptics_enabled');
      setHapticsEnabled(h !== 'false');
      try { await seedContentLibrary(db); } catch (e) { console.warn('content seed failed', e); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
```

In `NativeThemed`, add a locale persist callback and wrap the tree (note: `PrefLoader` must be **inside** `LocaleProvider` so its `useLocale()` resolves):

```tsx
function NativeThemed() {
  const db = useSQLiteContext();
  const persist = useCallback((m: ThemeMode) => { setSetting(db, 'theme_mode', m); }, [db]);
  const persistLocale = useCallback((l: Locale) => { setSetting(db, 'locale', l); }, [db]);
  return (
    <ThemeProvider onModeChange={persist}>
      <LocaleProvider onLocaleChange={persistLocale}>
        <PrefLoader db={db} />
        <AppContent />
      </LocaleProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Add the Language segment to `app/(tabs)/settings.tsx`**

Add the import:

```tsx
import { useLocale, type Locale } from '@/i18n';
```

Add a language option list next to `MODES` (after line 22):

```tsx
const LANGS: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];
```

Inside `SettingsScreen`, after `const { mode, setMode } = useThemeMode();`:

```tsx
  const { locale, setLocale } = useLocale();
```

Add a Language section in the JSX, immediately after the Appearance `</View>` segment (after line 56):

```tsx
      <Text style={[styles.section, { color: t.colors.textMuted }]}>Language</Text>
      <View style={styles.segment}>
        {LANGS.map(l => {
          const active = locale === l.id;
          return (
            <TouchableOpacity key={l.id}
              style={[styles.segBtn, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
              onPress={() => setLocale(l.id)} activeOpacity={0.7}>
              <Text style={[styles.segText, { color: active ? t.colors.accent : t.colors.text }]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
```

(The "Language" / "English" / "Español" labels are language names — left as literals, not run through `t()`.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify in the web preview**

Start the preview if needed, open the Settings tab, confirm the new **Language** segment renders with English active. Tap **Español**, navigate away and back to Settings, and confirm Español stays selected (persisted). Check `preview_console_logs` for errors (expect none).

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx 'app/(tabs)/settings.tsx'
git commit -m "feat(i18n): mount LocaleProvider, persist locale, add Settings language toggle"
```

---

## Task 5: Content-ready schema + locale-threaded resolver

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/__tests__/contentOverlay.test.ts`
- Modify: `src/db/queries.ts`
- Modify: `src/components/wfrp4e/ContentPicker.tsx`

- [ ] **Step 1: Add the `content_translations` table**

In `src/db/schema.ts`, inside the `execAsync` template, add after the `idx_content_cat_name` index (after line 66, before the closing `` ` ``):

```sql
    -- Per-locale overlay for content_library display fields (name/description, …).
    -- A missing row means "use the English base". Seeded later from optional
    -- src/data/wfrp-content/<locale>/ bundles; empty today.
    CREATE TABLE IF NOT EXISTS content_translations (
      content_id TEXT NOT NULL,
      locale     TEXT NOT NULL,
      overlay    TEXT NOT NULL,
      PRIMARY KEY (content_id, locale)
    );
```

- [ ] **Step 2: Write the failing test for `applyOverlay`**

`src/db/__tests__/contentOverlay.test.ts`:

```ts
import { applyOverlay } from '../queries';
import type { ContentRecord } from '../queries';

const base = { id: '1', name: 'Merchant', description: 'Buy low, sell high.' } as unknown as ContentRecord;

describe('applyOverlay', () => {
  test('returns the base unchanged when there is no overlay', () => {
    expect(applyOverlay(base, null)).toEqual(base);
  });

  test('overlays translated display fields onto the base', () => {
    const result = applyOverlay(base, { name: 'Mercader', description: 'Compra barato, vende caro.' });
    expect(result.name).toBe('Mercader');
    expect((result as any).description).toBe('Compra barato, vende caro.');
    expect(result.id).toBe('1');
  });

  test('keeps base fields that the overlay does not specify', () => {
    const result = applyOverlay(base, { name: 'Mercader' });
    expect(result.name).toBe('Mercader');
    expect((result as any).description).toBe('Buy low, sell high.');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- contentOverlay`
Expected: FAIL — `applyOverlay` is not exported.

- [ ] **Step 4: Implement `applyOverlay`, `seedContentTranslations`, and locale-thread the resolvers**

In `src/db/queries.ts`:

Add the `Locale` type import near the top imports:

```ts
import type { Locale } from '@/i18n/types';
```

Add an overlay type and the pure merge helper in the content-library section (just above `getContentByIds`):

```ts
/** Partial display-field overlay stored per (content_id, locale). */
export type ContentOverlay = Partial<ContentRecord>;

/** Pure merge: overlay translated fields onto a base record. Null overlay → base. */
export function applyOverlay(base: ContentRecord, overlay: ContentOverlay | null): ContentRecord {
  return overlay ? { ...base, ...overlay } : base;
}
```

Replace `getContentByIds` with the locale-aware version (LEFT JOIN the overlay; defaults to English):

```ts
/** Resolve content records by id, overlaying the given locale's translations when present. */
export async function getContentByIds(
  db: SQLite.SQLiteDatabase,
  ids: string[],
  locale: Locale = 'en'
): Promise<ContentRecord[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.id IN (${placeholders})`,
    [locale, ...ids]
  );
  return rows.map((r) =>
    applyOverlay(JSON.parse(r.data) as ContentRecord, r.overlay ? JSON.parse(r.overlay) : null)
  );
}
```

Replace `searchContent` with the locale-aware version (search still matches the English base name; results carry the overlay):

```ts
/** Case-insensitive name search within one category, overlaying locale translations on results. */
export async function searchContent(
  db: SQLite.SQLiteDatabase,
  category: ContentCategory,
  query: string,
  limit = 30,
  locale: Locale = 'en'
): Promise<ContentRecord[]> {
  const q = `%${query.trim()}%`;
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.category = ? AND c.name LIKE ? COLLATE NOCASE
      ORDER BY c.name LIMIT ?`,
    [locale, category, q, limit]
  );
  return rows.map((r) =>
    applyOverlay(JSON.parse(r.data) as ContentRecord, r.overlay ? JSON.parse(r.overlay) : null)
  );
}
```

Add the seed function at the end of the content-library section (no-op today — no bundle ships):

```ts
/**
 * Seed per-locale content overlays from an optional bundle. No-op for English or an
 * empty bundle. Gated by a per-locale seed-version setting so it runs once per version.
 * No Spanish bundle ships today; this exists so content can be slotted in without
 * touching the resolver.
 */
export async function seedContentTranslations(
  db: SQLite.SQLiteDatabase,
  locale: Locale,
  bundle: { id: string; overlay: ContentOverlay }[],
  version: string
): Promise<void> {
  if (locale === 'en' || bundle.length === 0) return;
  const key = `content_translation_seed_version_${locale}`;
  if ((await getSetting(db, key)) === version) return;

  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO content_translations (content_id, locale, overlay)
     VALUES ($id, $locale, $overlay)`
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const row of bundle) {
        await stmt.executeAsync({
          $id: row.id,
          $locale: locale,
          $overlay: JSON.stringify(row.overlay),
        });
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
  await setSetting(db, key, version);
}
```

> Note: if `ContentRecord` is not already exported from `queries.ts`, add `export` to its declaration so the test and `ContentOverlay` can reference it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- contentOverlay`
Expected: PASS (3 tests).

- [ ] **Step 6: Thread the active locale into the autocomplete (reference content wiring)**

In `src/components/wfrp4e/ContentPicker.tsx`, add the import:

```tsx
import { useLocale } from '@/i18n';
```

Inside the `ContentPicker` component body (near the other hooks, around line 31), add:

```tsx
  const { locale } = useLocale();
```

Update the `searchContent` call (currently around line 46) to pass the locale as the trailing argument:

```tsx
        const res = await searchContent(db, category, query, filter ? 200 : 40, locale);
```

(The other resolver callers — `CareerAdvanceModal.tsx`, `CareerPicker.tsx` — keep the default `'en'` and are unchanged; threading them is part of the follow-on full-extraction effort. Behavior is identical since no Spanish rows exist.)

- [ ] **Step 7: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/queries.ts src/db/__tests__/contentOverlay.test.ts src/components/wfrp4e/ContentPicker.tsx
git commit -m "feat(i18n): content_translations overlay table + locale-threaded resolver"
```

---

## Task 6: Migrate the Characters screen (reference namespace)

**Files:**
- Modify: `app/(tabs)/index.tsx`

This is the one screen migrated end-to-end, proving the `t()` pattern and exercising compile-time key safety (a wrong key here fails `npm run typecheck`).

- [ ] **Step 1: Import the hooks**

In `app/(tabs)/index.tsx`, add:

```tsx
import { useTranslation, useLocale } from '@/i18n';
```

- [ ] **Step 2: Localise `CharacterCard`**

Inside `CharacterCard`, after `const t = useTheme();` add:

```tsx
  const tr = useTranslation();
  const { locale } = useLocale();
```

Change the date line to use the active locale:

```tsx
  const updatedStr = updated.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
```

Change the two accessibility labels:

```tsx
          <TouchableOpacity onPress={onDuplicate} hitSlop={8} style={styles.cardAction} accessibilityLabel={tr('characters.duplicateA11y', { name: row.name })}>
```
```tsx
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.cardAction} accessibilityLabel={tr('characters.deleteA11y', { name: row.name })}>
```

- [ ] **Step 3: Localise `CharacterListScreen`**

Inside `CharacterListScreen`, after `const t = useTheme();` add:

```tsx
  const tr = useTranslation();
```

Update the import-failure alert in `handleImport`:

```tsx
    } catch (e) {
      Alert.alert(tr('characters.importFailedTitle'), e instanceof Error ? e.message : tr('characters.importFailedBody'));
    }
```

Update the header title:

```tsx
        <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          {tr('characters.title')}
        </Text>
```

Update the empty state:

```tsx
          <Text style={[styles.emptyTitle, { color: t.colors.text }]}>{tr('characters.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: t.colors.textMuted }]}>
            {tr('characters.emptyBody')}
          </Text>
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS. (Sanity check the key safety: temporarily change one key to `tr('characters.nope')`, run `npm run typecheck`, confirm it ERRORS, then revert.)

- [ ] **Step 5: Verify in the web preview**

Reload the preview. On the Characters tab confirm the title, empty state (if no characters), and card dates render. Switch to Español in Settings, return to Characters: text stays English (es dict empty → fallback) and the date formats for `es` — confirming the wiring works without any authored Spanish. Check `preview_console_logs` for errors (none expected; no `[i18n] missing translation key` warnings, since all keys exist in `en`).

- [ ] **Step 6: Commit**

```bash
git add 'app/(tabs)/index.tsx'
git commit -m "feat(i18n): migrate Characters screen to t() (reference namespace)"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test run**

Run: `npm run typecheck && npm test`
Expected: PASS — all suites green, including the new `translate` (6) and `contentOverlay` (3) tests.

- [ ] **Step 2: Preview smoke test**

In the web preview: Settings shows Appearance / **Language** / Feedback / About; toggling English ⇄ Español persists across navigation; Characters screen renders via `t()`; no console errors.

- [ ] **Step 3: Confirm clean tree**

Run: `git status`
Expected: clean (everything committed across Tasks 1–6).

---

## Self-Review

**Spec coverage:**
- §A two layers → Tasks 1–4 (Layer 1), Task 5 (Layer 2). ✓
- §B file layout → Tasks 1–3 create every listed file. ✓
- §C `t()` contract (interpolation, plural, es→en fallback, never-throws, dev warn) → Task 2 tests + impl. ✓
- §C compile-time key safety → `TKey` (Task 1) enforced by `t` (Task 3), exercised in Task 6 Step 4. ✓
- §D provider wiring mirrors ThemeProvider; PrefLoader read + persist; default 'en'; Settings toggle → Tasks 3–4. ✓
- §E content_translations table, overlay resolver, locale threading, no-op seed → Task 5. ✓
- §F user data untouched (only chrome keys added); date uses locale → Task 6. ✓
- §G deliverable = engine + wiring + schema + one reference screen → Tasks 1–6; bulk extraction / ES authoring explicitly excluded. ✓
- §H tests (translate unit, resolver passthrough via applyOverlay, compile-time key) → Tasks 2, 5, 6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `Locale`, `Messages`, `TKey`, `TParams`, `DeepPartial` defined in Task 1 and used consistently. `translate(active, fallback, key, params)` signature identical across Tasks 2–3. `applyOverlay(base, overlay)` and `ContentOverlay` defined and used consistently in Task 5. `useTranslation()` returns `TFunc` used as `tr(...)` in Task 6. ✓
