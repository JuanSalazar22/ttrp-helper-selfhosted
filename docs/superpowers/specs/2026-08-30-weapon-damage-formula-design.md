# Computed Final Weapon Damage — Design

**Date:** 2026-08-30
**Status:** Approved design (brainstorming) → ready for implementation plan
**Topic:** Show the resolved weapon damage number (characteristic bonus + flat damage) next to a weapon's free-text damage formula.

## Context

Weapon damage on a WFRP4e character (`Wfrp4eCharacter.weapons[].damage`) is a free-text string — book weapons are seeded as `"SB+4"` style (`weaponFromRecord()` in `src/lib/wfrpTrappings.ts`), matching WFRP4e's own convention of writing damage as a characteristic bonus plus a flat number. The app already computes characteristic bonuses everywhere else on the sheet (`characteristicBonus()` in `src/types/wfrp4e.ts`), but never resolves a weapon's own formula against the character's actual stats — a player has to do that math by hand to know what a hit actually deals.

This idea surfaced while building the Hammergen import (2026-08-30): Hammergen only exports a bare damage number with no bonus-inclusion flag, so imported weapons are flagged for manual review. Showing the resolved number next to every weapon (not just imported ones) makes it easy to spot at a glance whether a weapon's damage already accounts for its bonus.

`src/types/wfrp4e.ts` is this app's home for pure, framework/i18n-independent derived-stat logic (`characteristicBonus`, `woundsMax`, `encumbranceMaxValue`, etc.) — this feature is another function of that same kind.

## Goals

- Next to every weapon's damage formula, show the resolved total (characteristic bonus + flat number) computed from the character's *current* stats — live, not stored, so it stays correct as characteristics/advances/buffs change.
- Recognize any of the 10 characteristic-bonus abbreviations, in either English or Spanish spelling, case-insensitively — not just Strength Bonus — since a formula could reasonably use any of them (a homebrew/reskinned weapon keyed off Willpower, for instance).
- Never show a number that adds no information: a bare numeric formula (no bonus) or unparseable text shows nothing extra.

## Non-goals

- No live preview in the add/edit weapon form — only the collapsed row's subtitle changes.
- No support for multipliers (`2×SB+4`) or multi-term formulas (`SB+TB`) — WFRP4e's own book data and the Hammergen import never produce these; adding parsing for forms nothing generates would be speculative.
- No change to how `damage` is stored, edited, imported, or exported — this only adds a computed, derived display value.

## Decisions

| Area | Decision |
|---|---|
| Where the logic lives | `resolveWeaponDamage(char, damage)` in `src/types/wfrp4e.ts`, alongside `characteristicBonus()`. That file is intentionally i18n-independent (no `@/i18n` import anywhere in it today), so the 20 recognized abbreviation strings (10 characteristics × English/Spanish) are hardcoded there directly, with a comment noting they must stay in sync with `wfrp.charBonus` in `src/i18n/en.ts` / `es.ts` if those ever change. These are fixed rulebook terms (Devir's official Spanish WFRP4e abbreviations), not arbitrary UI copy, so drift risk is low. |
| Grammar | `^\s*(ABBREV)\s*(?:\+\s*(\d+))?\s*$`, case-insensitive. `ABBREV` is any of the 20 known strings. The `+N` part is optional (a bonus-alone formula like `"SB"` is valid, matching real WFRP4e weapons like unarmed/fist attacks). Anything else (a bare number, prose, a typo, empty string) does not match. |
| Result when no bonus term is present | Returns `null` for a non-matching formula (including a bare number like `"6"`) — not because it's invalid, but because there's nothing new to show: the number the player already sees *is* the final number. `null` means "don't render the parenthetical," never an error state. |
| Live-ness | No new stored field. `resolveWeaponDamage` calls the existing `characteristicBonus()`, which already folds in advances, manual "other" adjustments, and active buffs (including the synthetic Encumbered debuff) — so the resolved number is automatically consistent with everything else on the sheet, with zero sync logic to write. |
| UI | `Combat.tsx`'s weapon row subtitle changes from `` `${w.damage} · ${w.group}` `` to insert the resolved value in parens right after the formula when non-null: `"SB+4 (7) · Basic"`. The raw formula is never replaced or hidden — the parenthetical is purely additive. No i18n string needed (parentheses read fine in both locales). |

## File layout (modified only — no new files)

```
src/types/wfrp4e.ts                    # + resolveWeaponDamage()
src/types/__tests__/wfrp4e.test.ts     # + unit tests for resolveWeaponDamage()
src/components/wfrp4e/Combat.tsx       # weapon row subtitle includes the resolved value
```

## Testing / verification plan

- `resolveWeaponDamage()` is a pure function — real unit tests in `src/types/__tests__/wfrp4e.test.ts`: a plain `"SB+4"` match against a character with known Strength, an ES abbreviation (`"BF+4"`), a bonus-alone formula (`"WPB"`) proving the non-Strength scope works, a bare number (`"6"` → `null`), and unparseable text (→ `null`). Also case-insensitivity (`"sb+4"`) and stray whitespace (`"SB + 4"`).
- Manual verification (per this project's existing convention): open a WFRP4e character with a book-sourced weapon (already `"SB+N"` shaped), confirm the resolved number appears and matches hand-computed Strength Bonus + N; edit a weapon's damage to a bare number and confirm the parenthetical disappears; switch locale to Spanish and confirm a `"BF+N"` formula still resolves.
