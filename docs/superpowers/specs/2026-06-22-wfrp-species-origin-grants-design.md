# WFRP Species/Origin Granted Skills & Talents (#38 Phase 2) — Design

**Date:** 2026-06-22
**Backlog item:** #38 Phase 2
**Status:** Approved — implementation in progress
**Builds on:** #38 Phase 1 (species/origin split, library, pickers) — same branch `feat/wfrp-species-editor`.

## Goal

Let a species or origin definition **grant skills and talents**. When you apply a species
or origin to a character, its granted skills are added to the Skills section and its
granted talents to the Talents section (skipping any already present). Still no bundled
content — the player defines the grants.

## §1 Types + apply helpers — `src/types/wfrp4e.ts`

- New type:
  ```ts
  export type GrantedSkill = { name: string; characteristic: CharacteristicKey };
  ```
- Extend the library defs (fields required; all constructors updated this PR):
  ```ts
  export type WfrpSpeciesDef = {
    name: string;
    modifiers: Record<CharacteristicKey, number>;
    skills: GrantedSkill[];
    talents: string[];
  };
  export type WfrpOriginDef = {
    name: string;
    skills: GrantedSkill[];
    talents: string[];
  };
  ```
- Merge helpers (pure; `makeId` injected so they're deterministic in tests). Dedup by
  name, case-insensitive. New skills start at `advances: 0`, `isAdvanced: false`; new
  talents at `timesTaken: 1`, `description: ''`.
  ```ts
  export function mergeGrantedSkills(
    existing: Wfrp4eCharacter['skills'],
    granted: GrantedSkill[],
    makeId: () => string,
  ): Wfrp4eCharacter['skills'] {
    const out = [...existing];
    for (const g of granted) {
      const name = g.name.trim();
      if (name && !out.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        out.push({ id: makeId(), name, characteristic: g.characteristic, advances: 0, isAdvanced: false });
      }
    }
    return out;
  }

  export function mergeGrantedTalents(
    existing: Wfrp4eCharacter['talents'],
    granted: string[],
    makeId: () => string,
  ): Wfrp4eCharacter['talents'] {
    const out = [...existing];
    for (const raw of granted) {
      const name = raw.trim();
      if (name && !out.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        out.push({ id: makeId(), name, timesTaken: 1, description: '' });
      }
    }
    return out;
  }
  ```
- Apply helpers (reuse `applySpeciesPatch`; default `?? []` keeps Phase 1 library entries
  that lack grants working):
  ```ts
  export function applySpecies(
    character: Wfrp4eCharacter, def: WfrpSpeciesDef, makeId: () => string,
  ): Partial<Wfrp4eCharacter> {
    return {
      ...applySpeciesPatch(character, def.name, def.modifiers),
      skills: mergeGrantedSkills(character.skills, def.skills ?? [], makeId),
      talents: mergeGrantedTalents(character.talents, def.talents ?? [], makeId),
    };
  }

  export function applyOrigin(
    character: Wfrp4eCharacter, def: WfrpOriginDef, makeId: () => string,
  ): Partial<Wfrp4eCharacter> {
    return {
      origin: def.name,
      skills: mergeGrantedSkills(character.skills, def.skills ?? [], makeId),
      talents: mergeGrantedTalents(character.talents, def.talents ?? [], makeId),
    };
  }
  ```

No schema/migration change (skills/talents already exist on the character; grants live in
the settings-backed library defs).

## §2 Shared editor — `src/components/wfrp4e/GrantedListsFields.tsx` (new)

A presentational sub-component used by the species and origin editors:
```ts
type Value = { skills: GrantedSkill[]; talents: string[] };
type Props = { value: Value; onChange: (next: Value) => void };
```
- "Granted skills": lists each `{name} ({CHAR})` with a remove control; an add row with a
  name input, a tap-to-cycle characteristic chip (cycles the 10 keys), and an Add button.
- "Granted talents": lists each name with remove; an add row (name input + Add).

## §3 `SpeciesEditor.tsx` — add grants

- New props `initialSkills?: GrantedSkill[]`, `initialTalents?: string[]` (default `[]`).
- Local `granted` state seeded from those (and re-synced on `visible`).
- Render `<GrantedListsFields value={granted} onChange={setGranted} />` below the modifier grid.
- `onSubmit` now returns the full def: `{ name, modifiers, skills: granted.skills, talents: granted.talents }`.

## §4 `OriginEditor.tsx` (new) + `OriginPicker.tsx`

- New `OriginEditor` full-screen modal (mirrors `SpeciesEditor` minus the modifier grid):
  name input + `GrantedListsFields`. Props `{ visible, initialName?, initialSkills?, initialTalents?, onSubmit: (def: WfrpOriginDef) => void, onClose }`.
- `OriginPicker`: replace the inline name input with a "Create new origin…" button that
  opens `OriginEditor`; on submit `addOrigin(def)` + apply. Selecting an existing origin
  and creating both apply via `applyOrigin(character, def, uuidv4)`.

## §5 `SpeciesPicker.tsx` — apply grants

- `applyDef` and `handleCreate` use `applySpecies(character, def, uuidv4)` (was
  `applySpeciesPatch`), so picking/creating a species also adds its granted skills/talents.

## §6 Out of scope

- No bundled official species/origins (licensing — user fills the library).
- No "remove previously-granted items when switching species" (applying only adds; the
  user removes unwanted skills/talents in their sections). Keep simple.
- Career/rank/status unchanged.

## §7 Testing — `src/types/__tests__/wfrp4e.test.ts`

- `mergeGrantedSkills`: adds a new skill (id from makeId, advances 0, given characteristic);
  skips a name already present (case-insensitive); doesn't mutate input.
- `mergeGrantedTalents`: adds new (timesTaken 1); skips existing; trims/ignores blanks.
- `applySpecies`: patch has species, racial set, and granted skills/talents merged.
- `applyOrigin`: patch has origin + merged skills/talents (no characteristic change).

## Acceptance criteria

1. The species editor and a new origin editor let you add granted skills (name +
   characteristic) and talents (name).
2. Applying a species adds its racial modifiers **and** its granted skills/talents to the
   character; applying an origin adds its granted skills/talents.
3. Re-applying does not duplicate skills/talents already present (dedup by name).
4. Library defs (with grants) persist; Phase 1 entries without grants still apply fine.
5. `mergeGranted*` + `applySpecies`/`applyOrigin` tests pass; `tsc` clean.
