# Talent Descriptions on Grant — Design

Race, origin, and career grants populate the `description` and `tests` fields on granted talents when the talent name matches a `content_library` entry. Custom talents (not in the library) keep empty descriptions. Existing characters are not backfilled.

## Decisions

| Area | Decision |
|---|---|
| Scope | All granted talents — race + origin + career (all three go through `mergeGrantedTalents`). |
| Lookup key | Exact name (case-insensitive) against `content_library` `category = 'talent'`. No fuzzy matching. |
| Backfill | None. Existing character talents with empty descriptions stay empty. Only new grants get filled. |
| Custom talents | If a race/origin `def.talents` name isn't in the library, the talent is still granted, description stays `''`. |
| `mergeGrantedTalents` signature | Changes from `string[]` to `Array<{name; description?; tests?}>`. Callers pre-resolve. |
| `applyRace` / `applyOrigin` | Add optional `talentLookup` param (Map name → enriched). Sync stays sync. Falls back to name-only when lookup absent (preserves current tests without db context). |

## Architecture

### `src/types/wfrp4e.ts`

```ts
export type GrantedTalent = { name: string; description?: string; tests?: string };

export function mergeGrantedTalents(
  existing: Wfrp4eCharacter['talents'],
  granted: GrantedTalent[],
  makeId: () => string,
): Wfrp4eCharacter['talents']
```

Insertion sets `description: g.description ?? ''` and `tests: g.tests` (undefined preserved).

`applyRace(char, def, makeId, roll2d10, talentLookup?)` — new optional 5th arg: `Map<string, GrantedTalent>` keyed by lowercased name. When present, builds the enriched grant array from `def.talents` using the lookup. When absent, falls back to `def.talents.map(name => ({ name }))` (empty descriptions — behavior identical to today for tests that don't pass a lookup).

`applyOrigin(char, def, makeId, talentLookup?)` — analogous.

### `src/db/queries.ts`

```ts
export async function getTalentsByNames(
  db: SQLiteDatabase,
  names: string[],
  locale: Locale = 'en'
): Promise<ContentRecord[]>
```

Uses `SELECT c.data, t.overlay FROM content_library c LEFT JOIN content_translations t … WHERE c.category = 'talent' AND lower(c.name) IN (…)`. Returns overlay-applied records for localized descriptions.

Callers build the lookup map: `new Map(records.map(r => [r.name.toLowerCase(), { name: r.name, description: r.description, tests: r.tests }]))`.

### `src/components/wfrp4e/SpeciesPicker.tsx`

`applyDef` and `handleCreate` become async. Each:

1. `records = await getTalentsByNames(db, def.talents ?? [], locale)`
2. Build `lookup` map
3. Call `applyRaceWithRandomTalents(character, def, lookup)` — helper also becomes async because random talent names need a second lookup after the roll

`applyRaceWithRandomTalents(char, def, lookup)`:
1. `patch = applySpecies(char, def, uuidv4, roll2d10, lookup)`
2. Roll random talent names via existing `rollRandomTalents`
3. Second lookup: `randomRecords = await getTalentsByNames(db, randomNames, locale)`
4. Build a combined lookup, merge random talents via `mergeGrantedTalents` with enriched items

Requires `useSQLiteContext` + `useLocale` at the top of the component.

### `src/components/wfrp4e/OriginPicker.tsx`

Same pattern: `applyDef` becomes async, fetches lookup, calls `applyOrigin(char, def, uuidv4, lookup)`.

### `src/components/wfrp4e/CareerPicker.tsx`

`applyCareerLevel` — already has `talentRecs: ContentRecord[]`. Stop discarding fields:

```ts
const grantedTalents: GrantedTalent[] = talentRecs.map(tl => ({
  name: tl.name,
  description: tl.description,
  tests: tl.tests,
}));
talents: mergeGrantedTalents(character.talents, grantedTalents, uuidv4),
```

That's the whole career fix — it's a 1-line transform change (drops the `.map(t => t.name)`).

### `src/components/wfrp4e/CareerAdvanceModal.tsx`

Uses `applyCareerLevel` — automatically benefits. Verify no direct `mergeGrantedTalents` calls with old signature.

## Tests

- **`mergeGrantedTalents`** — update existing tests to new signature. Add one test: passing `{ name, description, tests }` populates those fields.
- **`applySpecies` / `applyOrigin`** — add one test each that passes a lookup map and verifies descriptions are on the granted talents.
- **`getTalentsByNames`** — no SQLite unit-test harness exists in the project; verified manually via app.
- **`applyCareerLevel`** — no existing test; change is trivial 1-line transform, not adding.

Verify: `npm run typecheck` clean, `npm test` green.

## Out of scope

- Backfill of existing empty descriptions (user chose A: new grants only).
- Fuzzy name matching (`"Acute Sense - Taste"` → `"Acute Sense"` fallback). Data currently has exact entries for the specific forms; revisit only if it breaks in practice.
- UI changes to how descriptions are displayed. The existing `Talents` component already renders `description` for user-added talents; this just fills them at grant time.
- Custom-talent library integration (talents added via `SpeciesEditor` free-text stay non-book).
