# WFRP Characteristics Detail View + Breakdown Model — Design

**Date:** 2026-06-21
**Backlog item:** #35 (keystone for #36 advances XP calculator, #37 max-wounds calc, #38 race/career/rank)
**Status:** Approved — implementation NOT started

## Goal

Replace the single `{ base, advances }` characteristic value with a four-part
breakdown — **Roll · Racial · Other · Advances** — surfaced in a dedicated
detail view. The main Characteristics grid shows only the total; a "Details"
button opens an editable breakdown that mirrors the reference screenshot
(Rolls / Racial / Other / Adv / Sum). This is the foundation the advances XP
calculator, calculated max wounds, and race/career application all build on.

## Confirmed decisions

- Detail layout is **transposed for mobile**: one row per characteristic (not the
  wide 10-column desktop table). Same data, phone-first.
- **Generate rolls** button is in scope (2d10 per characteristic into the Roll row).
- Migration: existing `base` → `roll`; `racial`/`other` = 0; totals preserved.
- New characters start all-zero (populated later via Generate rolls / race select #38).
- Roll, Racial, Other, Adv are all manually editable in this task.

## §1 Data model + migration

In `src/types/wfrp4e.ts`:

- Change the characteristic shape:
  ```ts
  characteristics: Record<CharacteristicKey, {
    roll: number;
    racial: number;
    other: number;
    advances: number;
  }>;
  ```
- `characteristicTotal(char, key)` returns `roll + racial + other + advances`
  (signature unchanged → `WfrpSkills`, `Resources`, and any other consumers need
  no edits).
- Bump `schemaVer` 1 → 2.
- Add `migrateWfrp4eCharacter(raw): Wfrp4eCharacter`:
  - For each characteristic still in the old shape (`base` present, `roll` absent):
    `{ roll: base ?? 0, racial: 0, other: 0, advances: advances ?? 0 }`.
  - Idempotent: a character already in the new shape passes through unchanged.
  - Sets `schemaVer = 2`.
- `defaultWfrp4eCharacter`: characteristics default to
  `{ roll: 0, racial: 0, other: 0, advances: 0 }`.

Migration is applied on load in `src/hooks/useCharacter.ts` (after `JSON.parse`,
for `system === 'wfrp4e'`), so viewing/editing any existing character normalizes
it; the new shape persists on the next `patch` save. Import and duplicate paths
funnel through the same load, so they are covered.

## §2 Main grid — `src/components/wfrp4e/Characteristics.tsx`

- Each cell: characteristic abbreviation + **total only** (remove the small
  "+adv" line). Tapping the total still rolls the test (unchanged).
- Add a **"Details"** button on the section header that opens the detail modal.
- Remove the old inline base/advances edit modal — all editing moves to the
  detail view.

## §3 Detail view — `src/components/wfrp4e/CharacteristicsDetail.tsx` (new)

A full-screen modal. One row per characteristic, four tap-to-edit number fields
plus a live total:

```
WS    Roll [11]  Racial [20]  Other [0]  Adv [0]   =  31
BS    Roll [20]  Racial [20]  Other [0]  Adv [0]   =  40
…(all 10: WS BS S T I Ag Dex Int WP Fel)
```

- Each field edits its component via the existing numeric-input pattern
  (`EditableNumber` or the inline edit used elsewhere); changes call `onChange`
  (patch) and the Sum recomputes immediately.
- **Generate rolls** button at the top: rolls 2d10 for each characteristic and
  writes the results into the Roll row. Because it overwrites existing rolls, it
  asks for confirmation first (`Alert.alert`). Reuses `roll('2d10')` from
  `src/dice/engine.ts`.
- Editing any single Roll value by hand still works after generating.

## §4 Affected files

- `src/types/wfrp4e.ts` — shape, `characteristicTotal`, `migrateWfrp4eCharacter`,
  `defaultWfrp4eCharacter`, `schemaVer`.
- `src/components/wfrp4e/Characteristics.tsx` — total-only grid + Details button.
- `src/components/wfrp4e/CharacteristicsDetail.tsx` — new detail modal.
- `src/hooks/useCharacter.ts` — run migration on load for WFRP characters.
- `src/dice/__tests__/` — tests (see §5).

## §5 Testing

Jest (pure functions only):
- `characteristicTotal` sums roll + racial + other + advances.
- `migrateWfrp4eCharacter`: old `{ base, advances }` → new four-part shape with
  preserved total; idempotent on an already-migrated character; sets schemaVer 2.

## §6 Out of scope (kept as separate backlog items)

- **#36** Advances XP-cost calculator — here the Adv field is a plain editable
  number; #36 adds the +1 control that shows the WFRP cost-band price.
- **#37** Max wounds calculated from characteristics + modifier.
- **#38** Race/career/rank on create — will auto-fill the Racial row from the
  species stat line; Racial stays manually editable until then.

## Acceptance criteria

1. Opening any existing WFRP character still shows the same characteristic totals
   (migration preserved them).
2. The main grid shows only totals and a Details button; tap-to-roll still works.
3. The detail view edits Roll/Racial/Other/Adv per characteristic; the Sum and the
   main grid update and persist.
4. "Generate rolls" sets 2d10 into every Roll (after confirm).
5. `characteristicTotal` and `migrateWfrp4eCharacter` tests pass; `tsc` clean.
