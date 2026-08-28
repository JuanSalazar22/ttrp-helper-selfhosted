# WFRP 4e — Configurable Race system

Date: 2026-06-23
System: wfrp4e

Refactor the ad-hoc "species" (racial modifiers + grants) into a centralized,
configurable **Race** that fully determines a character's starting attributes and
derived stats, supports custom races via configuration, and auto-applies on selection.
Adding a race never requires touching character-creation logic.

Source data: `json_book_information/races_starting_attributes.json` (Human, Dwarf,
Halfling, Elf).

## Decisions (from user)

- **Max Wounds** stored as coefficients `{ sb, tb, wpb }` (no formula-string eval).
  Human/Dwarf/Elf = `{1,2,1}`, Halfling = `{0,2,1}`.
- **Extend** the existing `WfrpSpeciesDef` into the richer `WfrpRaceDef` (one concept),
  keeping granted skills/talents. Relabel "Species" → "Race" in the UI.
- On race apply, **auto-roll 2d10** into each attribute's `roll` and set `racial` = the
  race's `+X`; the player can re-roll/edit afterward.

## Data model

### `WfrpRaceDef` (replaces `WfrpSpeciesDef`)
```ts
type WfrpRaceDef = {
  name: string;
  description?: string;
  attributes: Record<CharacteristicKey, number>; // racial +X; 2d10 implied
  woundsCoeffs: { sb: number; tb: number; wpb: number };
  fate: number;
  resilience: number;
  extraPoints: number;   // points the player distributes between Fate & Resilience
  movement: number;
  skills: GrantedSkill[];
  talents: string[];
};
```

### Base races — `src/data/wfrp-races.ts`
`export const BASE_RACES: WfrpRaceDef[]` built from the JSON (the `+X` parsed out of each
`"2d10+X"`). Always available in the picker. Custom races live in the settings library
(`useWfrpLibrary`) and are shown alongside. **Character-creation logic is generic over
`WfrpRaceDef`**, so new races (built-in or custom) need no code changes.

### `Wfrp4eCharacter` additions (schemaVer 5 → 6)
- `movement: number` (migrate default `4`)
- `extraPoints: number` (migrate default `0`)
- `woundsCoeffs: { sb: number; tb: number; wpb: number }` (migrate default `{1,2,1}` —
  preserves existing characters' wounds math)

Migration is idempotent, applied on load (`migrateWfrp4eCharacter`).

## Behavior

### `woundsMax(char)`
Changes from the hardcoded `SB + 2·TB + WPB + modifier` to:
```
woundsMax = coeffs.sb·SB + coeffs.tb·TB + coeffs.wpb·WPB + wounds.modifier
```
where `coeffs = char.woundsCoeffs`. Default `{1,2,1}` reproduces the old formula.

### `applyRace(char, def, roll2d10)` (expands `applySpecies`)
Returns a `Partial<Wfrp4eCharacter>`:
- **attributes:** for each key, `roll = roll2d10()`, `racial = def.attributes[key] ?? 0`;
  `other`/`advances` preserved.
- **woundsCoeffs:** `def.woundsCoeffs`.
- **fate:** `{ current: def.fate, max: def.fate }`; **fortune:** same.
- **resilience:** `{ current: def.resilience, max: def.resilience }`; **resolve:** same.
- **movement, extraPoints, species (name)** set.
- **skills/talents:** merge grants (unchanged `mergeGrantedSkills`/`mergeGrantedTalents`).

`species` field keeps storing the chosen race name (no field rename, only UI label).
Backward read: accept legacy `def.modifiers` as `attributes` if `attributes` absent.

## UI

- **RaceEditor** (was `SpeciesEditor`): name + description, 10 attribute `+X` fields,
  3 wounds-coeff fields, fate / resilience / extraPoints / movement, plus the existing
  granted skills/talents editor (`GrantedListsFields`). Saving a custom race upserts it
  into the library.
- **RacePicker** (was `SpeciesPicker`): lists `BASE_RACES` then custom library races;
  selecting one calls `applyRace`. "Create custom" opens RaceEditor.
- **Header:** the Species slot relabeled **Race**; opens RacePicker.
- **Resources:** add a **Movement** readout — `M` / Walk (`M×2`) / Run (`M×4`) — and an
  **Extra points: N** hint (distribute between Fate & Resilience).

## Testing

- Pure logic (jest): `woundsMax` with custom coeffs (Halfling drops SB); `applyRace`
  sets racial from `attributes`, rolls into `roll`, sets fate/resilience/movement/
  extraPoints/woundsCoeffs, merges grants; migration to schemaVer 6 defaults; `BASE_RACES`
  parsed values match the JSON (e.g. Dwarf WP +40, Elf I +40, Halfling wounds `{0,2,1}`).
- UI (web preview): pick each base race → attributes, fate, resilience, movement, max
  wounds update; Halfling max wounds excludes SB; create + edit a custom race; persistence
  across reload.

## schemaVer

5 → **6** (adds `movement`, `extraPoints`, `woundsCoeffs`).
