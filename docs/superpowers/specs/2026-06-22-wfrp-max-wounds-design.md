# WFRP Max Wounds — Auto-Calculated — Design

**Date:** 2026-06-22
**Backlog item:** #37
**Status:** Approved — implementation in progress
**Builds on:** #35 (four-part characteristic breakdown + `characteristicTotal`)

## Goal

Stop storing a hand-typed `wounds.max`. Compute it from characteristics using the
standard WFRP formula plus a manual modifier:

```
max = SB + 2×TB + WPB + modifier
```

where each *Bonus* is the tens digit of that characteristic's total:
`bonus(key) = Math.floor(characteristicTotal(char, key) / 10)`. SB ← Strength (`s`),
TB ← Toughness (`t`), WPB ← Willpower (`wp`). Size, Hardy, and other adjustments fold
into the manual `modifier`.

## Confirmed decisions

- **Migration resets the modifier to 0.** An existing character's old hand-set
  `wounds.max` is discarded; `max` immediately becomes the pure formula. (The user
  chose this over preserving the old number.)
- `current` is clamped to the new computed max on migration (so it never exceeds max).
- New characters start `{ current: 0, modifier: 0 }` — consistent with #35's all-zero
  characteristics (max is 0 until stats are entered, then it grows automatically).
- `max` is **not stored** — it is always derived via a `woundsMax(char)` helper, so it
  updates live when S/T/WP change. Only `current` and `modifier` are persisted.

## §1 Data model + migration — `src/types/wfrp4e.ts`

- Change the wounds field:
  ```ts
  wounds: { current: number; modifier: number };
  ```
  (was `{ current: number; max: number }`). `fate`/`fortune`/`resilience`/`resolve`
  keep their `{ current, max }` shape — only `wounds` changes.
- Add a `characteristicBonus` + `woundsMax` helper:
  ```ts
  export function characteristicBonus(char: Wfrp4eCharacter, key: CharacteristicKey): number {
    return Math.floor(characteristicTotal(char, key) / 10);
  }

  export function woundsMax(char: Wfrp4eCharacter): number {
    const sb = characteristicBonus(char, 's');
    const tb = characteristicBonus(char, 't');
    const wpb = characteristicBonus(char, 'wp');
    return sb + 2 * tb + wpb + char.wounds.modifier;
  }
  ```
- Bump `schemaVer` 2 → 3.
- Extend `migrateWfrp4eCharacter` (it already normalizes characteristics): after the
  characteristics are built, normalize wounds too. Old shape has `max` and no
  `modifier`; new shape has `modifier`.
  - If `raw.wounds.modifier` is a number → already migrated; keep
    `{ current, modifier }`, but still clamp `current` to the recomputed max.
  - Else (old `{ current, max }`) → `{ current: <clamped>, modifier: 0 }`.
  - The clamp uses the migrated character's own stats:
    `current = Math.min(raw.wounds?.current ?? 0, woundsMaxWithModifier(migratedChar, modifier))`.
    Implementation note: compute the bonuses inline from the freshly-built
    `characteristics` (don't call `woundsMax` on a half-built object); see the plan.
  - Set `schemaVer = 3`.
- `defaultWfrp4eCharacter`: `wounds: { current: 0, modifier: 0 }`, `schemaVer: 3`.

Migration remains applied on load in `useCharacter.ts` (unchanged — it already calls
`migrateWfrp4eCharacter` for `system === 'wfrp4e'`).

## §2 UI — `src/components/wfrp4e/Resources.tsx`

- Compute `const max = woundsMax(character);` once.
- The Wounds `Stepper` uses `max={max}` (was `character.wounds.max`).
- `setWounds(next)` stays `{ ...character.wounds, current: next }` (modifier preserved).
- Replace the old "Max wounds" row (which edited `wounds.max` via `EditableNumber`) with:
  - a **read-only** Max display showing the computed `max`,
  - an editable **Modifier** field (`EditableNumber`, allows negative) that patches
    `wounds.modifier` and clamps `current` down to the new max:
    ```ts
    onSave={(m) => onChange({ wounds: { modifier: m, current: Math.min(character.wounds.current, woundsMax({ ...character, wounds: { ...character.wounds, modifier: m } })) } })}
    ```
  - a small breakdown line: `SB {sb} + 2×TB {tb} + WPB {wpb} + mod {modifier}`.

No other section reads `wounds.max`.

## §3 Testing — `src/types/__tests__/wfrp4e.test.ts`

Add jest cases (pure functions only):
- `characteristicBonus` = floor(total/10): e.g. total 37 → 3, total 9 → 0.
- `woundsMax`: S=35 (SB 3), T=42 (TB 4), WP=28 (WPB 2), modifier 1 → 3 + 8 + 2 + 1 = 14.
- `migrateWfrp4eCharacter` wounds: old `{ current: 12, max: 99 }` with S/T/WP giving
  max 14 → `{ current: 12, modifier: 0 }` and `woundsMax` = 14 (old max 99 discarded);
  idempotent on an already-`{current,modifier}` character.

## §4 Out of scope

- Size-based formula variants (Small uses 2×SB, Large/Enormous multipliers) — handled
  via the manual modifier for now.
- Auto-applying Hardy (+TB per level) — manual modifier.
- Raising `current` automatically when max grows — current only ever clamps *down*.

## Acceptance criteria

1. Opening an existing WFRP character shows Max = SB + 2×TB + WPB (+0), not the old
   stored value; `current` is clamped to that max.
2. Editing S, T, or WP (in the characteristics detail) updates Max live.
3. Editing the Modifier changes Max and persists; current clamps down if needed.
4. New characters start 0 current / 0 modifier; max grows as stats are entered.
5. `characteristicBonus`, `woundsMax`, and the wounds-migration tests pass; `tsc` clean.
