# Computed Final Weapon Damage — Design

**Date:** 2026-08-30
**Status:** Approved design (brainstorming) → ready for implementation plan
**Topic:** Show the resolved weapon damage number (characteristic bonus + flat damage) next to a weapon's free-text damage formula.

## Context

Weapon damage on a WFRP4e character (`Wfrp4eCharacter.weapons[].damage`) is a free-text string — book weapons are seeded as `"SB+4"` style (`weaponFromRecord()` in `src/lib/wfrpTrappings.ts`), matching WFRP4e's own convention of writing damage as a characteristic bonus plus a flat number. The app already computes characteristic bonuses everywhere else on the sheet (`characteristicBonus()` in `src/types/wfrp4e.ts`), but never resolves a weapon's own formula against the character's actual stats — a player has to do that math by hand to know what a hit actually deals.

This idea surfaced while building the Hammergen import (2026-08-30): Hammergen only exports a bare damage number with no bonus-inclusion flag, so imported weapons are flagged for manual review. Showing the resolved number next to every weapon (not just imported ones) makes it easy to spot at a glance whether a weapon's damage already accounts for its bonus.

`src/types/wfrp4e.ts` is this app's home for pure, framework/i18n-independent derived-stat logic (`characteristicBonus`, `woundsMax`, `encumbranceMaxValue`, etc.) — this feature is another function of that same kind.

## Goals

- Next to every weapon's damage formula, show the resolved total computed from the character's *current* stats — live, not stored, so it stays correct as characteristics/advances/buffs change (and re-resolves per weapon if the formula itself is edited).
- Recognize any of the 10 characteristic-bonus abbreviations, in either English or Spanish spelling, case-insensitively — not just Strength Bonus.
- Support combining multiple characteristic terms and flat numbers in one formula (`SB+TB+4`), with standard arithmetic precedence and optional parentheses for grouping (`(SBx2)+TB+4`) — not just a single bonus plus a flat add.
- Never show a number that adds no information: a formula with no characteristic term anywhere in it, or one that fails to parse, shows nothing extra.

## Non-goals

- No live preview in the add/edit weapon form — only the collapsed row's subtitle changes.
- No subtraction, division, or decimal numbers — not requested, and nothing in this app's data needs them; adding them would be speculative.
- No change to how `damage` is stored, edited, imported, or exported — this only adds a computed, derived display value.

## Decisions

| Area | Decision |
|---|---|
| Where the logic lives | New file `src/components/wfrp4e/weaponDamageFormula.ts`, colocated with `Combat.tsx` — matching how `criticalWoundLookup.ts` sits next to `CriticalWounds.tsx`. This is a real small tokenizer + recursive-descent parser + evaluator (not a one-line regex anymore), so it earns its own file rather than growing `src/types/wfrp4e.ts` further. It imports `characteristicBonus`, `CharacteristicKey`, and `CHARACTERISTIC_KEYS` from `@/types/wfrp4e`. |
| Recognized abbreviations | The 20 fixed rulebook strings (10 characteristics × English/Spanish — `WSB/BSB/SB/TB/IB/AgB/DexB/IntB/WPB/FelB` and `BHA/BHP/BF/BR/BI/BAg/BDes/BInt/BV/BEm`), hardcoded in `weaponDamageFormula.ts` with a comment noting they must stay in sync with `wfrp.charBonus` in `src/i18n/en.ts` / `es.ts` if those ever change. Matched case-insensitively; mixing English and Spanish terms in one formula works too (nothing prevents it, and nothing needs to). |
| Grammar | `expr := term ('+' term)*` · `term := factor (('x'\|'X'\|'*') factor)*` · `factor := NUMBER \| ABBREV \| '(' expr ')'`. Standard precedence (multiplication binds tighter than addition), so `SBx2+TB+4` and `(SBx2)+TB+4` are equivalent — parentheses are only needed to override precedence. Repeating a characteristic (`SB+SB+4`) sums its bonus twice, which covers "double a bonus" without dedicated multiplier-on-a-characteristic syntax beyond `x`. |
| Tokenizer / `DexB` trap | `DexB` contains a literal `x`. The tokenizer always attempts the longest known-abbreviation match at the current position *before* falling back to treating a bare `x`/`X` as the multiply operator, so `DexB` is read as one token, never split into `De` × `B`. |
| Result when no characteristic term is present | Returns `null` — for a pure-numeric formula (`"6"`, `"4+2"`), *and* for anything that fails to parse (unmatched paren, unknown token, empty string). `null` always means "don't render the parenthetical," never an error state. |
| Live-ness | No new stored field. The evaluator calls the existing `characteristicBonus()` for each abbreviation term, which already folds in advances, manual "other" adjustments, and active buffs (including the synthetic Encumbered debuff) — so the resolved number is automatically consistent with everything else on the sheet, and re-resolves on every render (both when stats change and when the formula itself is edited), with zero sync logic to write. |
| UI | `Combat.tsx`'s weapon row subtitle changes from `` `${w.damage} · ${w.group}` `` to insert the resolved value in parens right after the formula when non-null: `"SB+4 (7) · Basic"`. The raw formula is never replaced or hidden. No i18n string needed. |

## File layout

```
src/components/wfrp4e/weaponDamageFormula.ts               # new — tokenizer + parser + evaluator, resolveWeaponDamage(char, formula)
src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts # new — unit tests
src/components/wfrp4e/Combat.tsx                            # weapon row subtitle includes the resolved value
```

## Testing / verification plan

- `resolveWeaponDamage()` is a pure function — real unit tests in `weaponDamageFormula.test.ts`: a plain `"SB+4"`, an ES abbreviation (`"BF+4"`), a bonus-alone formula (`"WPB"`), multi-term (`"SB+TB+4"`), precedence without parens (`"SBx2+TB+4"`) vs. the same with explicit parens (`"(SBx2)+TB+4"`) producing identical results, a repeated characteristic (`"SB+SB+4"`), the `DexB`-contains-`x` tokenizer trap, a bare/pure-numeric formula (→ `null`), and unparseable text / unmatched parens (→ `null`). Also case-insensitivity and stray whitespace throughout.
- Manual verification (per this project's existing convention): open a WFRP4e character with a book-sourced weapon (already `"SB+N"` shaped), confirm the resolved number matches hand-computed Strength Bonus + N and updates live when Strength changes; edit a weapon's formula to a multi-term expression and confirm it resolves correctly; edit to a bare number and confirm the parenthetical disappears; switch locale to Spanish and confirm a `"BF+N"` formula still resolves.
