# WFRP Species & Origin — Library-Backed (rework of #38) — Design

**Date:** 2026-06-22
**Backlog item:** #38 (rework — supersedes the species-only editor)
**Status:** Approved (Phase 1) — implementation in progress
**Builds on:** #35 (characteristic `racial`), #38 v1 (`SpeciesEditor`, `applySpeciesPatch`)

## Why

The first cut conflated **species** with **place of birth**. In WFRP 4e:
- **Species** (Human, Dwarf, Halfling, High Elf, Wood Elf, Gnome…) carries the
  **characteristic modifiers** (the `racial` column) and, later, species skills/talents.
- **Origin / place of birth** (e.g. *Reiklander* is a Human regional origin, **not** a
  species) is separate; in WFRP it grants a bonus skill/talent — **not** characteristic
  changes.

This rework splits the two and makes each a **library-backed picker**: a dropdown of
entries you've defined, plus "create new". Nothing official is bundled — the library ships
empty and grows as you add entries (no Cubicle 7 content; the app stays homebrew).

## Phasing

- **Phase 1 (this spec):** species ⇄ origin split; species carries characteristic
  modifiers; both are library-backed dropdowns with create-new; libraries persist.
- **Phase 2 (separate, later):** species/origin grant skills & talents (added to the
  character's Skills/Talents sections). Out of scope here.

## §1 Data model — `src/types/wfrp4e.ts`

- Add `origin: string` to `Wfrp4eCharacter` (kept alongside existing `species: string`).
- Bump `schemaVer` 3 → 4.
- `migrateWfrp4eCharacter`: also set `origin: raw.origin ?? ''` and `schemaVer: 4`
  (idempotent; existing characters get `origin: ''`).
- `defaultWfrp4eCharacter`: `origin: ''`, `schemaVer: 4`.
- New exported library types:
  ```ts
  export type WfrpSpeciesDef = { name: string; modifiers: Record<CharacteristicKey, number> };
  export type WfrpOriginDef = { name: string };
  ```
- New pure helper (reused for both libraries):
  ```ts
  export function upsertByName<T extends { name: string }>(list: T[], item: T): T[] {
    const i = list.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase());
    if (i === -1) return [...list, item];
    const next = [...list];
    next[i] = item;
    return next;
  }
  ```
- `applySpeciesPatch(character, species, racialByKey)` already exists (sets `species` +
  writes each `racial`) — unchanged, reused.

## §2 Library storage — `src/hooks/useWfrpLibrary.ts` (new)

A hook backed by the existing `settings` key/value table (`getSetting`/`setSetting`),
which works on native and web.

- Keys: `wfrp_species_library`, `wfrp_origin_library` → JSON arrays.
- Loads both on mount; exposes `{ species, origins, addSpecies, addOrigin }`.
- `addSpecies(def)` / `addOrigin(def)` upsert by name (via `upsertByName`) and persist the
  JSON back. They update local state immediately so the dropdown reflects the new entry.

```ts
export function useWfrpLibrary() {
  const db = useSQLiteContext();
  const [species, setSpecies] = useState<WfrpSpeciesDef[]>([]);
  const [origins, setOrigins] = useState<WfrpOriginDef[]>([]);

  useEffect(() => {
    let alive = true;
    getSetting(db, 'wfrp_species_library').then(v => { if (alive && v) setSpecies(JSON.parse(v)); });
    getSetting(db, 'wfrp_origin_library').then(v => { if (alive && v) setOrigins(JSON.parse(v)); });
    return () => { alive = false; };
  }, [db]);

  const addSpecies = useCallback((def: WfrpSpeciesDef) => {
    setSpecies(prev => { const next = upsertByName(prev, def); setSetting(db, 'wfrp_species_library', JSON.stringify(next)); return next; });
  }, [db]);

  const addOrigin = useCallback((def: WfrpOriginDef) => {
    setOrigins(prev => { const next = upsertByName(prev, def); setSetting(db, 'wfrp_origin_library', JSON.stringify(next)); return next; });
  }, [db]);

  return { species, origins, addSpecies, addOrigin };
}
```

## §3 Components

### §3.1 `SpeciesEditor.tsx` (rework the existing #38 v1 component)

Change it from "patch the character directly" to a reusable **create/edit form** that
returns a definition. Props become:
```ts
type Props = {
  visible: boolean;
  initialName?: string;
  initialModifiers?: Record<CharacteristicKey, number>;
  onSubmit: (def: WfrpSpeciesDef) => void;   // caller adds to library + applies
  onClose: () => void;
};
```
Same UI (name + 10 modifier inputs). On Save it calls `onSubmit({ name: name.trim(), modifiers })` then `onClose`. The re-sync-on-`visible` effect now seeds from `initialName`/`initialModifiers` (default name `''`, modifiers all `0`).

### §3.2 `SpeciesPicker.tsx` (new)

Modal opened from the header. Uses `useWfrpLibrary`.
- Lists each `species` from the library; tapping one applies it:
  `onChange(applySpeciesPatch(character, def.name, def.modifiers))` then closes.
- A "Create new species…" row opens `SpeciesEditor`; on submit:
  `addSpecies(def)`, then `onChange(applySpeciesPatch(character, def.name, def.modifiers))`,
  then close both.
- An "Edit current" affordance is **not** required for Phase 1 (you can re-create with the
  same name to overwrite — `upsertByName`).

Props: `{ visible, character, onChange, onClose }`.

### §3.3 `OriginPicker.tsx` (new)

Modal opened from the header. Uses `useWfrpLibrary`.
- Lists each `origin` from the library; tapping one sets `onChange({ origin: def.name })`
  then closes.
- A "Create new origin…" row reveals a single name `TextInput` + Add; on add:
  `addOrigin({ name })`, `onChange({ origin: name })`, close.

Props: `{ visible, character, onChange, onClose }`.

## §4 Header wiring — `src/components/wfrp4e/Wfrp4eHeader.tsx`

- Replace the species `SpeciesEditor` (from #38 v1) with `SpeciesPicker`:
  species tap → `setSpeciesPickerOpen(true)`.
- Add an **Origin** tap target in the meta row showing `{character.origin || 'Origin'}` →
  `setOriginPickerOpen(true)`; render `OriginPicker`.
- Meta row order: `species · origin · career` + the Rank pill.

## §5 Testing — `src/types/__tests__/wfrp4e.test.ts`

- `upsertByName`: appends a new item; replaces an existing one case-insensitively by name;
  does not mutate the input array.
- `migrateWfrp4eCharacter`: sets `origin` to `''` when absent, preserves an existing
  `origin`, and sets `schemaVer` 4.

## §6 Out of scope (Phase 2 / other)

- Species/origin granting **skills & talents** (Phase 2).
- Origins carrying characteristic modifiers (book-accurate: they don't).
- Any bundled official 4e species/origins (licensing — user fills the library).
- Career/rank/status: already editable in the header.

## Acceptance criteria

1. A WFRP character has independent **Species** and **Origin** fields in the header.
2. Tapping Species opens a picker listing previously-created species + "create new"; picking
   one applies its name + racial modifiers; creating one saves it to the library so it
   appears next time (on this and other characters).
3. Tapping Origin opens a picker listing previously-created origins + "create new"; picking
   sets the character's origin; created origins persist in the library.
4. Existing characters load with `origin: ''` (migration) and keep their species/racial.
5. `upsertByName` + migration tests pass; `tsc` clean.
