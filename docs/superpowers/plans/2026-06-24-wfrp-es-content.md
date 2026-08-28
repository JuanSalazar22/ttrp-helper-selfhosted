# WFRP Spanish Book-Content Overlay (Names) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show WFRP book content (skill/talent/spell/prayer/trapping/career/mutation) with Spanish names — in lists, autocomplete, and search — when the app locale is `es`.

**Architecture:** Per-category `es/<category>.json` name files seed into the existing `content_translations` overlay table. A new queryable `name` column makes Spanish search work. The resolver already overlays names by locale; we extend search and thread locale into the two remaining callers. Spanish names are AI-authored.

**Tech Stack:** TypeScript (strict), expo-sqlite, jest-expo, Expo Router.

**Spec:** `docs/superpowers/specs/2026-06-24-wfrp-es-content-overlay-design.md`

**Verify commands:** typecheck `npm run typecheck` (NOT bare `tsc` — it overflows the stack); tests `npm test`.

---

## File Structure

**New:**
- `src/data/wfrp-content/es/skill.json`, `talent.json`, `spell.json`, `prayer.json`, `trapping.json`, `career.json`, `mutation.json` — each `[{ id, name }]`, Spanish names keyed by the English book ids.
- `src/data/wfrp-content/es/index.ts` — imports the 7 files, exports `WFRP_CONTENT_ES` and `ES_CONTENT_SEED_VERSION`.
- `src/data/wfrp-content/es/__tests__/es-content.test.ts` — cross-check test.

**Modified:**
- `src/db/schema.ts` — add `name` column to `content_translations` (create stmt + guarded ALTER).
- `src/db/queries.ts` — `seedContentTranslations` writes `name`; new `seedWfrpContentTranslations`; `searchContent` matches translated name.
- `app/_layout.tsx` — call `seedWfrpContentTranslations` in `PrefLoader`.
- `src/components/wfrp4e/CareerPicker.tsx`, `src/components/wfrp4e/CareerAdvanceModal.tsx` — thread active locale into resolver calls.

---

## Task 1: Add `name` column to `content_translations`

**Files:** Modify `src/db/schema.ts`

- [ ] **Step 1: Add the column to the create statement**

In `src/db/schema.ts`, replace the `content_translations` create block:

```sql
    CREATE TABLE IF NOT EXISTS content_translations (
      content_id TEXT NOT NULL,
      locale     TEXT NOT NULL,
      overlay    TEXT NOT NULL,
      PRIMARY KEY (content_id, locale)
    );
```

with (adds `name`):

```sql
    CREATE TABLE IF NOT EXISTS content_translations (
      content_id TEXT NOT NULL,
      locale     TEXT NOT NULL,
      name       TEXT,
      overlay    TEXT NOT NULL,
      PRIMARY KEY (content_id, locale)
    );
```

- [ ] **Step 2: Add a guarded ALTER for installs created before the column existed**

In `src/db/schema.ts`, immediately AFTER the closing `` ` `` and `);` of the `db.execAsync(\`…\`)` call (just before the function's closing `}`), add:

```ts
  // content_translations.name was added later; backfill the column on older installs.
  // (The table is created above with the column for new installs; this covers upgrades.)
  try {
    await db.execAsync('ALTER TABLE content_translations ADD COLUMN name TEXT;');
  } catch {
    // Column already exists — ignore the "duplicate column name" error.
  }
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(content): add name column to content_translations for searchable ES names"
```

---

## Task 2: Seed writes the `name` column; search matches translated names

**Files:** Modify `src/db/queries.ts`

- [ ] **Step 1: Write `name` in `seedContentTranslations`**

In `src/db/queries.ts`, in `seedContentTranslations`, change the prepared statement and its execution to also store `name` (taken from `overlay.name`):

```ts
  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO content_translations (content_id, locale, name, overlay)
     VALUES ($id, $locale, $name, $overlay)`
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const row of bundle) {
        await stmt.executeAsync({
          $id: row.id,
          $locale: locale,
          $name: (row.overlay.name as string | undefined) ?? null,
          $overlay: JSON.stringify(row.overlay),
        });
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
```

- [ ] **Step 2: Match translated name in `searchContent`**

In `src/db/queries.ts`, change the `searchContent` query + params so it matches the English base name OR the active-locale translated name, ordered by the displayed name:

```ts
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.category = ? AND (c.name LIKE ? COLLATE NOCASE OR t.name LIKE ? COLLATE NOCASE)
      ORDER BY COALESCE(t.name, c.name) LIMIT ?`,
    [locale, category, q, q, limit]
  );
```

(`getContentByIds` is unchanged — it already overlays via the `overlay` column. For `locale='en'` there is no matching `t` row, so `t.name` is NULL and the `OR` clause never matches — behavior is identical to today.)

- [ ] **Step 3: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS (65 tests).

- [ ] **Step 4: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat(content): seed translated name + match it in searchContent"
```

---

## Task 3: Translate each category's names (7 data files)

**Files:** Create `src/data/wfrp-content/es/<category>.json` for each of: `skill`, `talent`, `spell`, `prayer`, `trapping`, `career`, `mutation`.

> **For the controller:** dispatch ONE subagent per category (parallel-safe — different files, no shared edits). Each subagent does the steps below for its single category. Review each file, then commit all 7 together after Task 4's test passes.

- [ ] **Step 1 (per category): Read the English source**

Read `src/data/wfrp-content/<category>.json`. Each entry is `{ "id": "...", "name": "...", ... }`. You only need `id` and `name`.

- [ ] **Step 2 (per category): Write the Spanish file**

Create `src/data/wfrp-content/es/<category>.json` as a JSON array of `{ "id", "name" }` with the **same ids** as the source and the Spanish translation of each `name`. Include every entry. Example shape:

```json
[
  { "id": "5caddb56a48cc24ecc4eca90", "name": "Signos Secretos" }
]
```

**Translation rules:**
- Idiomatic Spanish. Use the WFRP glossary: Melee = Combate cuerpo a cuerpo, Ranged = A distancia, Dodge = Esquivar, Stealth = Sigilo, Perception = Percepción, Channelling = Canalización, Lore = Saber, Trade = Oficio, Cool = Sangre fría, Endurance = Resistencia, Athletics = Atletismo, Charm = Encanto, Intimidate = Intimidar, Leadership = Liderazgo, Ride = Montar, Row = Remar, Sail = Navegar, Swim = Nadar, Heal = Sanar, Pray = Rezar, Bribery = Soborno, Gamble = Apostar, Haggle = Regatear, Evaluate = Evaluar, Track = Rastrear, Climb = Trepar, Drive = Conducir, Consume Alcohol = Beber alcohol, Gossip = Cotillear, Entertain = Entretener, Set Trap = Poner trampas.
- Parenthetical specializations: translate the generic part, keep proper nouns. "Melee (Basic)" → "Combate cuerpo a cuerpo (Básico)"; "Trade (Cook)" → "Oficio (Cocinero)"; "Lore (Reikland)" → "Saber (Reikland)"; "Ranged (Bow)" → "A distancia (Arco)".
- Keep proper nouns untranslated: place names (Reikland, Altdorf, Nuln…), deity names (Sigmar, Ranald, Shallya, Morr…), faction/character names.
- Spells/prayers: translate the descriptive name; keep deity/proper names. Trappings: translate common-noun item names; keep brand/proper names.
- Output ONLY `{ id, name }` per entry; ids must match the source exactly; do not reorder is fine.

- [ ] **Step 3 (per category): Validate the file parses**

Run: `node -e "const a=require('./src/data/wfrp-content/es/<category>.json'); console.log('<category>', a.length, 'first:', JSON.stringify(a[0]))"`
Expected: prints the count and a `{id,name}` sample; no JSON error.

(Commit happens in Task 4 after the cross-check test passes.)

---

## Task 4: ES index + cross-check test

**Files:**
- Create: `src/data/wfrp-content/es/index.ts`
- Create: `src/data/wfrp-content/es/__tests__/es-content.test.ts`

- [ ] **Step 1: Create the ES index**

`src/data/wfrp-content/es/index.ts`:

```ts
// Spanish name overlays for bundled WFRP book content. Seeded into content_translations
// (locale 'es') on launch. Bump ES_CONTENT_SEED_VERSION whenever any es/*.json changes.
import skill from './skill.json';
import talent from './talent.json';
import spell from './spell.json';
import prayer from './prayer.json';
import trapping from './trapping.json';
import career from './career.json';
import mutation from './mutation.json';

export const ES_CONTENT_SEED_VERSION = 'es-3';

export type EsName = { id: string; name: string };

export const WFRP_CONTENT_ES: EsName[] = [
  ...(skill as EsName[]),
  ...(talent as EsName[]),
  ...(spell as EsName[]),
  ...(prayer as EsName[]),
  ...(trapping as EsName[]),
  ...(career as EsName[]),
  ...(mutation as EsName[]),
];
```

- [ ] **Step 2: Write the cross-check test**

`src/data/wfrp-content/es/__tests__/es-content.test.ts`:

```ts
import { CONTENT_SOURCES, type ContentCategory } from '@/data/wfrp-content';
import esSkill from '../skill.json';
import esTalent from '../talent.json';
import esSpell from '../spell.json';
import esPrayer from '../prayer.json';
import esTrapping from '../trapping.json';
import esCareer from '../career.json';
import esMutation from '../mutation.json';

type EsName = { id: string; name: string };

const ES: Partial<Record<ContentCategory, EsName[]>> = {
  skill: esSkill as EsName[],
  talent: esTalent as EsName[],
  spell: esSpell as EsName[],
  prayer: esPrayer as EsName[],
  trapping: esTrapping as EsName[],
  career: esCareer as EsName[],
  mutation: esMutation as EsName[],
};

describe('Spanish content overlay', () => {
  for (const cat of Object.keys(ES) as ContentCategory[]) {
    const rows = ES[cat]!;
    const enIds = new Set(CONTENT_SOURCES[cat].map(r => r.id));

    test(`${cat}: every ES id resolves to an English entry`, () => {
      const orphans = rows.filter(r => !enIds.has(r.id)).map(r => r.id);
      expect(orphans).toEqual([]);
    });

    test(`${cat}: every name is a non-empty string`, () => {
      const bad = rows.filter(r => typeof r.name !== 'string' || r.name.trim() === '');
      expect(bad).toEqual([]);
    });

    test(`${cat}: no duplicate ids`, () => {
      expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
    });
  }
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- es-content`
Expected: PASS (21 tests — 3 per category × 7). If any `orphans` fail, fix the offending id in that category's `es/<category>.json` to match the English source.

- [ ] **Step 4: Verify full typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit the data + index + test**

```bash
git add src/data/wfrp-content/es
git commit -m "feat(content): Spanish name overlays for 7 WFRP content categories"
```

---

## Task 5: Seed the ES overlay on launch

**Files:**
- Modify: `src/db/queries.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add `seedWfrpContentTranslations` in `queries.ts`**

Add the import near the top of `src/db/queries.ts` (next to the existing `@/data/wfrp-content` import):

```ts
import { WFRP_CONTENT_ES, ES_CONTENT_SEED_VERSION } from '@/data/wfrp-content/es';
```

Add this function at the end of the content-library section (after `seedContentTranslations`):

```ts
/** Seed the bundled Spanish name overlays. Idempotent (gated by ES_CONTENT_SEED_VERSION). */
export async function seedWfrpContentTranslations(db: SQLite.SQLiteDatabase): Promise<void> {
  const bundle = WFRP_CONTENT_ES.map((r) => ({ id: r.id, overlay: { name: r.name } }));
  await seedContentTranslations(db, 'es', bundle, ES_CONTENT_SEED_VERSION);
}
```

- [ ] **Step 2: Call it on launch**

In `app/_layout.tsx`, update the import:

```ts
import { getSetting, setSetting, seedContentLibrary, seedWfrpContentTranslations } from '@/db/queries';
```

In `PrefLoader`, after the `seedContentLibrary` line, add a second guarded seed:

```ts
      try { await seedContentLibrary(db); } catch (e) { console.warn('content seed failed', e); }
      try { await seedWfrpContentTranslations(db); } catch (e) { console.warn('es content seed failed', e); }
```

- [ ] **Step 3: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries.ts app/_layout.tsx
git commit -m "feat(content): seed Spanish name overlays on launch"
```

---

## Task 6: Thread active locale into the Career resolver callers

**Files:**
- Modify: `src/components/wfrp4e/CareerPicker.tsx`
- Modify: `src/components/wfrp4e/CareerAdvanceModal.tsx`

- [ ] **Step 1: CareerPicker**

In `src/components/wfrp4e/CareerPicker.tsx`, add the import:

```ts
import { useLocale } from '@/i18n';
```

Inside the component body (near the other hooks), add:

```ts
  const { locale } = useLocale();
```

Change the two `getContentByIds` calls (currently `getContentByIds(db, level.skills ?? [])` and `getContentByIds(db, level.talents ?? [])`) to pass the locale:

```ts
    getContentByIds(db, level.skills ?? [], locale),
    getContentByIds(db, level.talents ?? [], locale),
```

- [ ] **Step 2: CareerAdvanceModal**

In `src/components/wfrp4e/CareerAdvanceModal.tsx`, add the import:

```ts
import { useLocale } from '@/i18n';
```

Inside the component (next to `const t = useTheme();`), add:

```ts
  const { locale } = useLocale();
```

Change the `searchContent` call (currently `searchContent(db, 'career', character.currentCareer, 10)`) to:

```ts
      const matches = await searchContent(db, 'career', character.currentCareer, 10, locale);
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/CareerPicker.tsx src/components/wfrp4e/CareerAdvanceModal.tsx
git commit -m "feat(content): localize career grant/skill/talent names (thread locale)"
```

---

## Task 7: Verification

**Files:** none.

- [ ] **Step 1: Full check**

Run: `npm run typecheck && npm test`
Expected: PASS — includes the 21 `es-content` cross-check tests.

- [ ] **Step 2: Preview smoke test (Spanish content)**

Start the preview. In Settings set locale = **Español**. Create or open a WFRP character. Open the **Skills** "Search the book" autocomplete:
- Type a Spanish skill word (e.g. "Sigilo" or "Combate") → results appear (proves Spanish search works).
- Confirm result rows show Spanish names.
Repeat for the spell/trapping autocomplete and the Career picker. Check `preview_console_logs` (level warn/error): no `[i18n] missing translation key` warnings and no errors.

- [ ] **Step 3: Confirm clean tree**

Run: `git status`
Expected: clean.

---

## Self-Review

**Spec coverage:**
- §Scope (7 categories, names only, AI-authored) → Task 3. ✓
- §Data (es/<category>.json `{id,name}` + es/index.ts) → Tasks 3, 4. ✓
- §Schema change (name column + guarded ALTER) → Task 1. ✓
- §Seeding (write name, seedWfrpContentTranslations, ES_CONTENT_SEED_VERSION, _layout) → Tasks 2, 4, 5. ✓
- §Resolver/search (match base OR translated name, ORDER BY COALESCE) → Task 2. ✓
- §Localize everywhere (CareerPicker, CareerAdvanceModal) → Task 6. ✓
- §Testing (ids resolve, names non-empty, no dup ids) → Task 4. ✓
- §Verification (Spanish search + render + no warnings) → Task 7. ✓

**Placeholder scan:** No TBD/TODO. Task 3 is a data-production procedure (rules + glossary + exact format), not a literal data dump — appropriate for ~2,200 generated rows; ids are constrained by the source and validated by Task 4's test.

**Type consistency:** `EsName = { id: string; name: string }`, `WFRP_CONTENT_ES`, `ES_CONTENT_SEED_VERSION`, `seedWfrpContentTranslations(db)` used consistently across Tasks 4–5. `seedContentTranslations(db, locale, bundle, version)` signature unchanged; `bundle` items are `{ id, overlay: { name } }` consistent with the existing `{ id, overlay: ContentOverlay }` type. `searchContent`/`getContentByIds` keep their existing `locale` parameter. ✓
