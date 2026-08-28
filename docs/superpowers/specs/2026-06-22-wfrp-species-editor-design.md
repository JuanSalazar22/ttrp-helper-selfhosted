# WFRP Homebrew Species Editor — Design

**Date:** 2026-06-22
**Backlog item:** #38
**Status:** Approved — implementation in progress
**Builds on:** #35 (characteristic `racial` component)

## Goal

Let a player set a character's **species name and its 10 racial characteristic
modifiers** in one editor, writing the modifiers straight into the `racial` component of
each characteristic (the "Racial" column added in #35).

## Licensing constraint (hard)

**No Cubicle 7 content is bundled.** There are NO preset species or official stat lines.
The editor ships blank — the player types their own homebrew species name and modifiers.
This keeps the app a homebrew framework, consistent with the rest of the project.

## Confirmed decisions

- **Per-character species editor** (not a reusable library): the values live on the one
  character; writes straight to its Racial row.
- Single entry point: the **Species** field already shown in the WFRP header becomes the
  trigger (tap → open the editor) instead of the current name-only text edit.
- Career name, rank (1–4), and status tier are already editable in the header and need no
  bundled data — out of scope here.
- The Racial cells remain directly editable in the characteristics detail view (#35) for
  fine-tuning; this editor is the bulk-set convenience.

## §1 Helper — `src/types/wfrp4e.ts`

```ts
export function applySpeciesPatch(
  character: Wfrp4eCharacter,
  species: string,
  racialByKey: Record<CharacteristicKey, number>,
): Partial<Wfrp4eCharacter> {
  const characteristics = { ...character.characteristics };
  for (const k of CHARACTERISTIC_KEYS) {
    characteristics[k] = { ...characteristics[k], racial: racialByKey[k] ?? 0 };
  }
  return { species, characteristics };
}
```

- Sets every characteristic's `racial` from the map (missing keys → 0).
- Preserves each characteristic's `roll`/`other`/`advances` (only `racial` changes).
- Returns a patch object suitable for `onChange`. No schema change; no migration.

## §2 New component — `src/components/wfrp4e/SpeciesEditor.tsx`

A full-screen modal modeled on `TextEditModal` (Cancel / title / Save header). Contents:

- A **Species name** `TextInput`.
- A 2-column grid of **10 modifier inputs**, one per characteristic, each labeled with its
  abbreviation (`CHARACTERISTIC_ABBREV`), `keyboardType="number-pad"` (matches
  `EditableNumber`; racial modifiers are typically positive).
- Initialized on `onShow` from the character: name ← `character.species`, each input ←
  `String(character.characteristics[k].racial)`.
- **Save**: parse each input with `parseInt` (NaN → 0), call
  `onChange(applySpeciesPatch(character, name.trim(), parsed))`, then `onClose`.

Props: `{ visible: boolean; character: Wfrp4eCharacter; onChange: (patch: Partial<Wfrp4eCharacter>) => void; onClose: () => void }`.

## §3 Header wiring — `src/components/wfrp4e/Wfrp4eHeader.tsx`

- Remove `'species'` from the `StrField` union / `TITLES` map (so `TextEditModal` handles
  only `name`, `currentCareer`, `height`).
- Add `const [speciesOpen, setSpeciesOpen] = useState(false);`.
- The species `TouchableOpacity` `onPress` becomes `() => setSpeciesOpen(true)`.
- Render `<SpeciesEditor visible={speciesOpen} character={character} onChange={onChange} onClose={() => setSpeciesOpen(false)} />`.

The displayed species text stays `{character.species || 'Species'}`.

## §4 Out of scope

- No preset/official species (licensing).
- No reusable species library across characters.
- Career/rank/status already editable in the header — unchanged.
- Auto-deriving wounds/bonuses from species: already automatic via #37 `woundsMax`
  (racial feeds `characteristicTotal` → bonuses), so nothing extra is needed.

## §5 Testing — `src/types/__tests__/wfrp4e.test.ts`

`applySpeciesPatch`:
- Sets `species` and each characteristic's `racial` from the map.
- Preserves `roll`/`other`/`advances` on each characteristic.
- Missing key in the map → that characteristic's `racial` becomes 0.

## Acceptance criteria

1. Tapping **Species** in the header opens the editor pre-filled with the current species
   name and racial modifiers.
2. Entering a name + modifiers and saving writes them to `species` and the `racial`
   column; the characteristics detail Sum reflects the new racial values, and the change
   persists.
3. Because racial feeds the totals, derived values (e.g. max wounds from #37) update
   accordingly.
4. `applySpeciesPatch` tests pass; `tsc` clean.
