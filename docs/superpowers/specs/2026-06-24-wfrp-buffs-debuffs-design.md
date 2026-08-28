# WFRP4e Buffs & Debuffs — Design

**Date:** 2026-06-24
**Status:** Approved (pending spec review)

## Problem

A WFRP character's characteristics frequently gain temporary modifiers — spell blessings, conditions, fatigue, item bonuses. Today the only way to model these is to hand-edit a characteristic's `other` value, which is a single anonymous number: you can't see *what* is modifying a stat, can't toggle an effect on/off, and can't remove one without remembering its magnitude. This feature adds named, toggleable buffs/debuffs that each target one characteristic and contribute to its total.

## Decisions (locked during brainstorming)

- **Manual base + buffs stack.** The existing hand-editable `other` value stays. A characteristic's effective `other` = manual `other` + sum of that characteristic's *active* buffs. Toggling or deleting a buff never touches the manual `other`.
- **One characteristic per buff.** A buff targets exactly one of the ten characteristics. To affect two stats, create two buffs. (YAGNI.)
- **Debuff = negative value.** A single signed `value` distinguishes buff (+) from debuff (−). The UI exposes a Buff/Debuff toggle + magnitude, but the model stores one signed number.
- **Active toggle.** Each buff has an `active` flag so a temporary effect can be flipped off without deleting it. Inactive buffs contribute 0.

## Data model

New type and a list on the character (`src/types/wfrp4e.ts`):

```ts
export type Buff = {
  id: string;
  name: string;                       // e.g. "Bless", "Fatigued"
  characteristic: CharacteristicKey;  // one target
  value: number;                      // signed: +N buff, −N debuff
  active: boolean;                    // toggle on/off without deleting
};

// Wfrp4eCharacter gains:
buffs: Buff[];
```

### Cascade — one helper, one edit

```ts
/** Sum of ACTIVE buffs targeting `key` (signed). Missing list → 0. */
export function buffTotal(char: Wfrp4eCharacter, key: CharacteristicKey): number {
  return (char.buffs ?? [])
    .filter(b => b.active && b.characteristic === key)
    .reduce((sum, b) => sum + b.value, 0);
}
```

`characteristicTotal` gains one term:

```ts
return roll + racial + other + advances + buffTotal(char, key);
```

Because `characteristicBonus`, `woundsMax`, `encumbranceMaxValue`, skill totals, and roll targets all derive from `characteristicTotal`, a buff automatically cascades to every dependent value (e.g. a `+10 Strength` buff raises SB, Max Wounds, encumbrance, melee damage, and the Strength test). No other wiring is required.

> **Note on the migration clamp:** `migrateWfrp4eCharacter` computes a wounds-max to clamp `wounds.current`. It reads characteristic parts directly (not via `characteristicTotal`), so it will *not* see buffs — this is fine and intentional: migration runs once on load and buffs are runtime modifiers, not a reason to re-clamp stored wounds. No change needed there.

### Migration & defaults

- `migrateWfrp4eCharacter`: `buffs: Array.isArray(raw.buffs) ? raw.buffs : []`. Bump `schemaVer 6 → 7`. Idempotent (already-migrated characters keep their `buffs`).
- `defaultWfrp4eCharacter`: `buffs: []`, `schemaVer: 7`.

## UI

Follows the canonical list-section pattern (`Talents.tsx`): a `Section` wrapper, rows, a dashed "Add" button, a slide-up add/edit modal, and a "Clear all" foot button.

### New `Buffs` section component

Mounted in `Wfrp4eSheet.tsx` immediately **after** `<Characteristics />` (it modifies characteristics; keep them adjacent).

**Row:** `Name` · target characteristic **chip** (abbrev, e.g. `S`) · signed value (**+N** green / **−N** red) · **active toggle** · delete (🗑). Tapping the name opens edit. An inactive row is dimmed and contributes 0.

**Add/Edit modal** (slide-up):
- **Name** — text input (placeholder e.g. "Bless", "Fatigued").
- **Characteristic** — a wrapped row of 10 tappable abbrev chips (WS/BS/S/T/I/Ag/Dex/Int/WP/Fel); tap selects, selected chip highlights.
- **Type & magnitude** — a segmented **Buff (+) / Debuff (−)** toggle plus a numeric magnitude input. On save, `value = (debuff ? −1 : +1) × magnitude`. On edit, the sign of the stored `value` seeds the toggle and `abs(value)` seeds the magnitude.
- **Save / Cancel.** Save is disabled until name is non-empty and a characteristic is selected.

**Section foot:** "Clear all" (with confirm), shown only when buffs exist — matches Talents.

### Annotation on the characteristics

So a buffed number isn't mysterious:

- **Main grid** (`Characteristics.tsx`): the displayed total already includes buffs (via `characteristicTotal`). Add a small **accent dot** in the corner of any cell whose characteristic has a non-zero active `buffTotal`.
- **Detail modal** (`CharacteristicsDetail.tsx`): for a row with non-zero `buffTotal`, show a subtext **"Buffs +10"** (green) / **"Buffs −10"** (red) beneath the row. The `Sum` already reflects buffs; the `Other` tile continues to edit only the manual portion (consistent with the read-only-Adv / manual-base-plus-buffs decisions).

## i18n

New `wfrp.buffs.*` keys in both `en.ts` and `es.ts`:
`title`, `addBuff`, `editBuff`, `namePlaceholder`, `characteristic`, `type`, `buff`, `debuff`, `magnitude`, `active`, `contribution` (e.g. `"Buffs {sign}{n}"` — or compose in code), `removeConfirm`, `clearAll`, `clearAllConfirm`, `empty`. Author Spanish (e.g. `title: "Mejoras y penalizaciones"`, `buff: "Mejora"`, `debuff: "Penalización"`). Typecheck enforces the ES overlay matches the EN key space.

## Testing

Pure-function unit tests in `src/types/__tests__/wfrp4e.test.ts`:
- `buffTotal`: sums only `active` buffs; only the matching `characteristic`; honors sign (buff + / debuff −); returns 0 for a missing/empty `buffs` array.
- `characteristicTotal`: includes active buffs; excludes inactive ones.
- One cascade assertion: a `+10` Toughness buff raises `characteristicBonus('t')` and therefore `woundsMax`.
- `migrateWfrp4eCharacter`: defaults `buffs` to `[]` when absent, preserves an existing `buffs` array, and is idempotent; `schemaVer` becomes 7.

(UI is verified manually in the web preview, per project convention — no component tests.)

## Files touched

| File | Change |
|---|---|
| `src/types/wfrp4e.ts` | `Buff` type, `buffs` field, `buffTotal`, `characteristicTotal` += buffs, migration default, `defaultWfrp4eCharacter`, `schemaVer 7` |
| `src/components/wfrp4e/Buffs.tsx` | **new** section component |
| `src/components/wfrp4e/Wfrp4eSheet.tsx` | mount `<Buffs />` after `<Characteristics />` |
| `src/components/wfrp4e/Characteristics.tsx` | accent dot on buffed cells |
| `src/components/wfrp4e/CharacteristicsDetail.tsx` | "Buffs ±N" subtext per row |
| `src/i18n/en.ts`, `src/i18n/es.ts` | `wfrp.buffs.*` keys |
| `src/types/__tests__/wfrp4e.test.ts` | `buffTotal` / total / cascade / migration tests |

## Out of scope (YAGNI)

- Buffs affecting non-characteristic stats (wounds modifier, movement, AP) directly — they already cascade through characteristics where relevant.
- Multi-characteristic buffs, durations/timers, or auto-expiry.
- Linking buffs to spells/talents in the content library.
