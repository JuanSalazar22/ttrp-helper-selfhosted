# WFRP 4e — Experience tracker, advance calculator, and book-content autocomplete

Date: 2026-06-22
System: wfrp4e

Five linked changes, ordered by dependency. Phases A–C are self-contained logic + UI;
Phases D–E are the content pipeline (seed the book JSON into SQLite, then drive
autocomplete and schema-accurate custom editors from it).

## Decisions (from user)

- The `json_book_information/*.json` content is cleared for use (user has permission;
  not monetised). It ships in the app **and** the public web demo. The earlier
  "no Cubicle 7 content in the public build" rule is **lifted** for this project.
- Content is **seeded into SQLite tables**, not lazy-loaded JSON assets.

---

## Phase A — Experience tracker (current / spent / total)

### Data model
Add to `Wfrp4eCharacter`:
```ts
experience: { total: number; spent: number };
```
- `total` — all XP the character has ever earned (player-entered).
- `spent` — running accumulator the advance calculator increments when advances are bought.
- `current` (a.k.a. "unspent") is **derived**, never stored:
  `experienceCurrent(c) = c.experience.total - c.experience.spent`.

Helper: `export function experienceCurrent(c: Wfrp4eCharacter): number`.

### Migration (schemaVer 4 → 5)
`migrateWfrp4eCharacter` adds `experience: { total: raw.experience?.total ?? 0, spent: raw.experience?.spent ?? 0 }`.
Idempotent. Bump `schemaVer` literal to `5` (type + default + migrate + tests).

### UI
New `Experience` Section card on the WFRP sheet (top of `StorySection`, or its own
section above Story). Three stat boxes: **Total** (editable number), **Spent**
(editable number — manual correction allowed), **Current** (computed, read-only,
coloured red when negative). Editing Total or Spent flows through `onChange`.

---

## Phase B — Advance cost rules (pure logic + tests)

WFRP4e Core, "Cost of Advances". The cost per advance depends on how many advances
of that thing are **already bought**, and differs by kind:

| Advances bought | Characteristic | Skill |
|-----------------|---------------|-------|
| 0–5             | 25            | 10    |
| 6–10            | 30            | 15    |
| 11–15           | 40            | 20    |
| 16–20           | 50            | 30    |
| 21–25           | 70            | 40    |
| 26–30           | 90            | 60    |
| 31–35           | 120           | 80    |
| 36–40           | 150           | 110   |
| 41–45           | 190           | 140   |
| 46+             | 230           | 180   |

Talents do **not** use this table. Buying the *N*-th rank of a talent costs
`N × 100` XP (rank 1 = 100, rank 2 = 200, …). Max rank = bonus of the talent's
associated characteristic (not enforced as a hard block — see Phase C).

### API (replace the current single `advanceCost`)
```ts
type AdvanceKind = 'characteristic' | 'skill';
// cost of the single NEXT advance given how many are already bought
advanceCost(kind: AdvanceKind, currentAdvances: number): number;
// total cost to go from `from` advances to `to` advances (to >= from)
advancesCostRange(kind: AdvanceKind, from: number, to: number): number;
// cost to buy talent ranks from `fromRank` to `toRank`
talentCostRange(fromRank: number, toRank: number): number;
```
The existing call sites (`CharacteristicsDetail`, `WfrpSkills`) pass the kind.
Keep the function tested in `wfrp4e.test.ts` (band boundaries, range sums, talent triangular sum).

---

## Phase C — "Make Advances" calculator popup

Replaces the inline `−`/`+1` stepper in the detail/skill rows. A **Make Advances**
button opens a popup scoped to one characteristic / skill / talent.

Flow:
1. Popup opens at **delta 0**, seeded with the row's current advances (or talent ranks).
2. `−` / `+` adjust the delta. Live readout: target advances, and **running XP cost**
   = `advancesCostRange(kind, current, current + delta)` (or `talentCostRange`).
3. **Save**:
   - If `cost ≤ experienceCurrent` → apply: set advances to `current + delta`,
     `experience.spent += cost`. Close.
   - If `cost > experienceCurrent` → show inline warning
     "Costs N XP — exceeds your unspent (M). Continue anyway?" with **Continue anyway**
     (applies, spent goes up, current may go negative) and **Cancel**.
4. Negative delta (refund) is allowed and **subtracts** the same banded cost from `spent`
   (so buy/sell round-trips are XP-neutral). Cannot reduce below 0 advances.

Web note: use `window.confirm` fallback only if a native `Alert` is needed; prefer an
in-popup warning row (no Alert) so it works identically on web and native.

Applies in three places: `CharacteristicsDetail` (characteristics), `WfrpSkills`
(skill advances), `Talents` (talent ranks / timesTaken).

---

## Phase D — Seed book content into SQLite + autocomplete

### Source → normalized records
Ten files in `json_book_information/`, all Foundry-style `{ data: [{ id, object }] }`.
A build-time transform (`scripts/build-wfrp-content.mjs`) flattens each into trimmed
records and writes bundled seed assets under `src/data/wfrp-content/<category>.json`.

Enum decode (already verified against the data):
- skill/talent `attribute`: `1=ws 2=bs 3=s 4=t 5=i 6=ag 7=dex 8=int 9=wp 10=fel` (11 = misc/none).
- skill `type`: `0 = Basic`, `1 = Advanced` → `isAdvanced`.

Per-category trimmed shape keeps: `id, name, attribute?(→characteristic key), isAdvanced?,
description, source page, plus category-specific fields` (spell: cn/range/target/duration/
classification; trapping: enc/price/availability/melee|ranged|armour/qualities; quality/flaw:
type/applicableTo; talent: maxRank/tests/modifiers). Drop `ownerId/canEdit/shared/displayZero`
and all-zero modifier blocks.

### DB
New table:
```sql
CREATE TABLE IF NOT EXISTS content_library (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,   -- 'skill'|'talent'|'spell'|'prayer'|'career'|'trapping'|'quality'|'mutation'|'creature_trait'|'rune'
  name TEXT NOT NULL,
  attribute INTEGER,        -- nullable; characteristic enum for skills/talents
  data TEXT NOT NULL        -- JSON: full trimmed record
);
CREATE INDEX IF NOT EXISTS idx_content_cat_name ON content_library(category, name);
```
Seed on first launch, gated by settings key `content_seed_version` (bump to re-seed).
Seeding inserts in batched transactions from the bundled JSON. `queries.ts` gets
`seedContentLibrary()`, `searchContent(category, query, limit)`.

### Autocomplete UI
Each add-flow (skill, talent, spell, prayer, trapping, quality, mutation) gains a
searchable picker backed by `searchContent`. Selecting a row prefills the custom
editor's fields; the user can edit before saving onto the character. A "Create custom"
path stays available with the same form.

---

## Phase E — Custom editors match real schema

Extend the per-thing add/edit forms so a custom entry has the same fields the book
records carry (so book-sourced and custom entries are interchangeable):
- **Skill**: name, characteristic, isAdvanced, description. (mostly exists)
- **Talent**: name, maxRank, tests, description. (add maxRank, tests)
- **Spell**: name, lore, cn, range, target, duration, effect. (mostly exists)
- **Prayer**: name, god, range, target, duration, effect. (exists)
- **Trapping/weapon/armour**: name, enc, qty, price/availability, and weapon/armour
  sub-fields where relevant. (extend Trappings/Combat)

Out of scope for this pass: careers as a full picker (already have career text + rank);
runes and creature_traits seeded but not yet surfaced in a picker.

---

## Testing

- Pure logic (`wfrp4e.ts`): cost tables, range sums, talent triangular sum,
  `experienceCurrent`, migration to schemaVer 5 — jest.
- Transform script: spot-check record counts and a few known mappings
  (Athletics→ag, Channelling→wp, Secret Signs isAdvanced).
- UI: web preview — XP card math, Make-Advances apply + overspend warning, autocomplete
  prefill, persistence across reload.

## schemaVer

4 → **5** (adds `experience`). Migration idempotent, applied on load.
