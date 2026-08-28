# WFRP Spanish Book-Content Overlay (Names) — Design

- **Date:** 2026-06-24
- **Status:** Approved (design); implementation pending
- **Depends on:** i18n architecture (PR #21) and UI string extraction (PR #23). Builds on the existing `content_translations` overlay table and `seedContentTranslations`.

## Goal

Show the bundled WFRP book content (skills, talents, spells, prayers, trappings, careers, mutations) with **Spanish names** when the app locale is `es`, including in search. Descriptions stay English (shown only in the wiki popup). This completes the user-facing i18n: with locale = Español, autocomplete lists and pickers display and are searchable by Spanish names.

## Scope

- **Categories (7):** `skill`, `talent`, `spell`, `prayer`, `trapping`, `career`, `mutation` (~2,200 entries). Excluded: `creature_trait`, `quality`, `rune` (niche; not surfaced in the main pickers).
- **Field:** `name` only. Descriptions are **not** translated.
- **Source:** No official Spanish data exists. Names are **AI-authored** by the implementer (good general/term quality; not guaranteed to match the official Devir/Edge Spanish edition's exact wording).

## Data

- New files: `src/data/wfrp-content/es/<category>.json`, one per category, each an array of `{ id, name }` where `id` matches the English entry's book id and `name` is the Spanish name.
- `src/data/wfrp-content/es/index.ts` imports the 7 files and exports `WFRP_CONTENT_ES: { id: string; name: string }[]` (concatenated), plus a derived bundle `{ id, overlay: { name } }[]` for seeding.

## Schema change (enables Spanish search)

The overlay today is `content_translations(content_id, locale, overlay TEXT, PK(content_id, locale))`. The `overlay` JSON is not SQL-queryable, so search can't match translated names. Add a queryable column:

```sql
ALTER ... -- via CREATE TABLE IF NOT EXISTS in schema.ts:
content_translations (
  content_id TEXT NOT NULL,
  locale     TEXT NOT NULL,
  name       TEXT,            -- NEW: denormalized translated name for search
  overlay    TEXT NOT NULL,
  PRIMARY KEY (content_id, locale)
)
```

Because the table is created with `CREATE TABLE IF NOT EXISTS` and currently has **zero rows** in any deployed DB, adding the column to the create statement is safe — but existing installs already created the table without `name`. To cover them, schema init runs an idempotent guard: `ALTER TABLE content_translations ADD COLUMN name TEXT` wrapped to ignore the "duplicate column" error (the standard expo-sqlite migration pattern). New installs get it from the create statement; old installs get it via the guarded ALTER.

## Seeding

- `ES_CONTENT_SEED_VERSION` constant (e.g. `'es-1'`); bump when ES data changes.
- `seedContentTranslations(db, locale, bundle, version)` is extended so each row also writes the `name` column (from `overlay.name`). Signature stays `bundle: { id, overlay: ContentOverlay }[]`.
- New `seedWfrpContentTranslations(db)` builds the bundle from `WFRP_CONTENT_ES` and calls `seedContentTranslations(db, 'es', bundle, ES_CONTENT_SEED_VERSION)`.
- Called in `app/_layout.tsx` `PrefLoader`, right after `seedContentLibrary(db)`. Always runs (idempotent by version); the resolver only *applies* the overlay when active locale is `es`.

## Resolver / search

- `getContentByIds(db, ids, locale)` — unchanged; already overlays `{ ...base, ...overlay }`.
- `searchContent(db, category, query, limit, locale)` — change the WHERE to match the base English name **or** the translated name for the active locale, and ORDER BY the displayed name:
  ```sql
  LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
  WHERE c.category = ? AND (c.name LIKE ? COLLATE NOCASE OR t.name LIKE ? COLLATE NOCASE)
  ORDER BY COALESCE(t.name, c.name)
  ```
  For `locale = 'en'` there is no matching `t` row, so behavior is identical to today.

## Localize names everywhere

Thread the active locale (`useLocale().locale`) into the remaining content-resolver callers so Spanish names appear in all surfaces:
- `src/components/wfrp4e/CareerPicker.tsx`
- `src/components/wfrp4e/CareerAdvanceModal.tsx`

(`ContentPicker.tsx` already passes locale.) Note: a character's *stored* `currentCareer`/skill names are not retroactively translated — only freshly resolved/displayed lists localize. This is acceptable and expected.

## Production (subagents) + translation rules

One subagent per category reads `src/data/wfrp-content/<category>.json` and writes `src/data/wfrp-content/es/<category>.json` with the same ids and translated names. Rules:
- Idiomatic Spanish using a shared WFRP glossary (e.g. Melee = Combate cuerpo a cuerpo, Dodge = Esquivar, Stealth = Sigilo, Channelling = Canalización, Lore = Saber, Trade = Oficio, Ranged = A distancia, Perception = Percepción, Cool = Sangre fría, Endurance = Resistencia).
- Handle parenthetical specializations: translate both parts where generic ("Melee (Basic)" → "Combate cuerpo a cuerpo (Básico)"; "Trade (Cook)" → "Oficio (Cocinero)") but keep proper nouns inside parentheses ("Lore (Reikland)" → "Saber (Reikland)").
- Keep proper nouns untranslated: place names (Reikland, Altdorf), deity names (Sigmar, Ranald), character/faction names.
- Output strictly `{ id, name }` with ids unchanged from the source.

The controller reviews each category file and runs the cross-check test before committing.

## Testing

- Pure test (`src/data/wfrp-content/es/__tests__/`): for every category, each ES `id` exists in the matching EN category (no orphan/typo ids), `name` is a non-empty string, and there are no duplicate ids. (Coverage need not be 100% of EN ids — partial is allowed — but every ES id must resolve.)
- Existing `applyOverlay` test stays.
- `npm run typecheck` + `npm test` green.

## Verification

Web preview: set locale = Español, open the skill autocomplete and the spell/trapping/career pickers. Confirm (a) Spanish names render in the result rows, (b) typing Spanish text matches results (search works), and (c) no `[i18n] missing translation key` warnings and no console errors.

## Out of scope / follow-ups

- Descriptions remain English (wiki popup).
- `creature_trait`, `quality`, `rune` names remain English.
- Official Devir/Edge Spanish names can later replace the AI-authored ones by editing the `es/*.json` files and bumping `ES_CONTENT_SEED_VERSION`.
