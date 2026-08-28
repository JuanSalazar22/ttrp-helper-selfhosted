# i18n / Translations Architecture — TTRP Helper

- **Date:** 2026-06-23
- **Status:** Approved (design); implementation pending
- **Scope:** Architecture only. Build the translation machinery and make game-content storage locale-ready. Do **not** author any Spanish strings or content yet.

## Goal

Support an English and a Spanish version of the app. Ship the engine, the provider wiring, and a content-storage schema that can hold Spanish without re-architecture. No translation content is written in this effort beyond one reference UI namespace used to prove the pattern.

## Current state (as explored)

- No i18n dependency; `expo-localization` is **not** installed.
- ~146 hardcoded UI strings live as literal JSX text across `src/components/**`.
- Game content (careers, skills, talents, spells, prayers, mutations, qualities, runes, creature traits, trappings) is bundled **English-only** from Cubicle 7 JSON under `src/data/wfrp-content/*.json`, seeded into the `content_library` SQLite table (`id, category, name, attribute, data`) by `seedContentLibrary`, keyed by stable book IDs (e.g. `5ce1c0d2…`). Display fields are `name` + `description` (inside `data`).
- Preferences already persist through SQLite settings: `ThemeProvider` exposes `setMode` and an `onModeChange` callback; `PrefLoader` in `app/_layout.tsx` reads `getSetting(db,'theme_mode')` on boot and writes back with `setSetting`. The locale system mirrors this exactly — no new pattern is introduced.

## Decisions

1. **Translation scope:** Translate the UI strings now. Game content stays English for display, but the content store is made locale-ready so Spanish names/descriptions can be slotted in later with zero re-architecture. No Spanish content is authored now.
2. **Locale source:** Manual toggle only. The app starts in English; the user selects Spanish in Settings; the choice persists in SQLite. No device detection, so no `expo-localization` dependency.
3. **Engine:** A custom, ~60-line typed `t()` helper plus nested message dictionaries, wrapped in a `LocaleProvider` that mirrors `ThemeProvider`. Keys are a TypeScript union, so a typo or missing key is a compile error caught by CI typecheck. Zero dependencies, fully offline, unit-testable.
4. **Layer 2 (content) is in:** The `content_translations` overlay table and locale-threaded resolver are built now (passthrough while no Spanish rows exist). Not deferred.
5. **Deliverable boundary:** Engine + provider + wiring + content-ready schema + **one** migrated reference namespace (the Characters list screen). Bulk extraction of all ~146 strings and any Spanish authoring are separate follow-on efforts.

## Architecture

### Two independent layers

- **Layer 1 — UI strings:** custom typed `t()`, `en`/`es` dictionaries, `LocaleProvider`.
- **Layer 2 — game content:** `content_translations` overlay table + locale-aware resolver. With zero Spanish rows it is a pure passthrough — behavior identical to today.

The layers are independent: Layer 1 can ship and function with Layer 2 untouched, and vice versa.

### File layout

```
src/i18n/
  types.ts            Locale = 'en' | 'es'; Messages = typeof en; TKey dot-path union; DeepPartial<T>
  en.ts               Full English dictionary, nested namespaces (common, characters, wfrp.skills, …)
  es.ts               DeepPartial<Messages> — starts ~empty; per-key fallback to en at runtime
  translate.ts        PURE translate(dict, fallback, key, params) — interpolation + plural. Unit-tested.
  LocaleProvider.tsx  React context { locale, setLocale, t }; mirrors ThemeProvider
  index.ts            Re-exports: LocaleProvider, useTranslation(), useLocale()
```

`en.ts` is the single source of truth for the key space. `es.ts` is typed as `DeepPartial<Messages>` so it may omit keys; omissions fall back to English at runtime. Namespaces are nested objects grouped by feature so the dictionary stays navigable as it grows.

### `t()` contract

- `t('characters.title')` → `string`. The key argument is a `TKey` union of dot-paths derived from `en`; an unknown or misspelled key is a **compile-time** error.
- **Interpolation:** `t('xp.spent', { n: 5 })` substitutes `{n}` placeholders in the resolved string.
- **Plural:** `t('xp.advances', { count })` resolves the `.one` / `.other` sub-keys of that entry (English and Spanish share the simple 1-vs-other rule).
- **Fallback chain:** key present in active `es` dict → use it; missing in `es` → use `en`; English is the typed source so it cannot be missing → the function never throws.
- **Dev safety net:** if a key somehow resolves to nothing, return the raw key string and `console.warn` in `__DEV__` so the gap is visible rather than rendering blank.

`translate.ts` is a pure function (dictionary in, string out) with no React or storage dependency, which is what makes it unit-testable in isolation.

### Provider wiring

`LocaleProvider` holds `locale` state, exposes `t` (memoized over the active dict + English fallback) and `setLocale`, and accepts an optional `onLocaleChange` callback — the same shape as `ThemeProvider`'s `onModeChange`.

In `app/_layout.tsx`:

- Mount `LocaleProvider` inside `NativeThemed` (sibling to the theme tree), default locale `'en'`.
- `PrefLoader` additionally reads `getSetting(db,'locale')` on boot and calls `setLocale` when it is `'en'` or `'es'`.
- The persist callback calls `setSetting(db,'locale', l)`.

The Settings screen gains a language row (English / Español segmented control) wired to `setLocale`. Persistence failures are swallowed and warned, exactly like the theme preference.

### Layer 2 — content-ready schema

- **Table:** `content_translations (content_id TEXT, locale TEXT, overlay TEXT, PRIMARY KEY (content_id, locale))`. `overlay` is a JSON partial holding only the translated display fields, e.g. `{ "name": "...", "description": "..." }`. Added to schema init as `CREATE TABLE IF NOT EXISTS …` — non-breaking, no migration of existing `content_library` rows.
- **Resolver:** `getContentByIds(db, ids, locale)` and `searchContent(db, query, locale)` take the active locale. The resolver fetches the base `content_library` row and overlays the matching `content_translations` row when present: `{ ...base, ...overlay }`. No overlay row (the only case today) → base English is returned unchanged. Search continues to match base English names for now; Spanish search is a concern for when Spanish content actually exists.
- **Hook:** `useWfrpLibrary` becomes locale-aware and threads the active locale from `LocaleProvider` into the resolver calls. With no Spanish rows, output is identical to today.
- **Seeding:** `seedContentTranslations(db, locale, bundle)` is gated by a per-locale seed-version setting and reads `src/data/wfrp-content/<locale>/*.json` if that bundle exists. **No bundle ships now → it is a no-op.** `build-wfrp-content.mjs` documents the optional Spanish-bundle emit path for the future.

### Out of scope / untouched

- **User-entered data** — character names, custom skills/talents/notes, custom races — is never passed through `t()`. It is stored and displayed exactly as the user typed it.
- **Formatting:** the character card date switches to the active locale via `toLocaleDateString`. All other displayed numbers are plain integers with no currency or locale-specific grouping, so nothing else needs locale-aware formatting.

## Testing

- `translate.ts` unit tests (jest): interpolation substitution, plural `one`/`other` selection, `es → en` fallback for a missing key, raw-key passthrough for an absent key.
- Compile-time: an unknown `t()` key fails typecheck (enforced by CI).
- Resolver passthrough test: `getContentByIds` returns base English when no overlay row exists for the locale.

## Error handling

- Missing key: fall back to English, then to the raw key string; `__DEV__` warn. Never throws — the UI must always render.
- `setLocale` with an unrecognized value: ignored; the current locale stays.
- SQLite persistence failure on locale write: swallowed and warned, matching the theme preference behavior.

## Deliverable for this effort (architecture only)

1. `src/i18n/` engine: `types.ts`, `en.ts`, `es.ts`, `translate.ts`, `LocaleProvider.tsx`, `index.ts`.
2. Provider mounted in `app/_layout.tsx`; locale persisted via SQLite settings; Settings language toggle.
3. `content_translations` table + locale-threaded `getContentByIds` / `searchContent` + locale-aware `useWfrpLibrary` + no-op `seedContentTranslations`.
4. One reference UI namespace migrated end-to-end (Characters list screen) as the proven pattern.
5. Tests listed above.

Full extraction of the remaining ~146 strings and any Spanish authoring are explicitly **follow-on** work, tracked separately.
