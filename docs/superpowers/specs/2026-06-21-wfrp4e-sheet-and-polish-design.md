# WFRP 4e Character Sheet + Polish — Design

**Date:** 2026-06-21
**Phase:** 4 (WFRP 4e sheet) + partial Phase 5 (polish, paywall excluded)
**Branch:** `feat/wfrp4e-sheet`
**Status:** Approved

## Goal

Bring the WFRP 4e character sheet to view/edit parity with the existing D&D 5e
sheet, plus a focused polish pass. Ship free (no paywall) for demo and testing.
Competitor reference: hammergen.net.

## Constraints (from PROJECT_BRIEF.md)

- Local-only, offline-first. No backend, no auth, no sync.
- No bundled Cubicle 7 content. WFRP ships as a blank framework; users enter their
  own talents/skills/careers/spells. Any descriptive text is user-entered.
- No paywall in this build — free for demo/testing.
- Side-project pace; no CI/CD.

## Current state (verified)

- `useCharacter` / `patch` (debounced save) and the db queries are already
  system-agnostic (`EditableCharacter = Dnd5eCharacter | Wfrp4eCharacter`).
- `defaultWfrp4eCharacter()` exists; `CreateCharacterModal` already offers WFRP.
- **Data trap:** `app/character/[id].tsx` is dnd5e-only and renders
  "Character not found." for any non-dnd5e system. Creating a WFRP character today
  produces an unopenable record. Fixed by §1.
- Dice engine (`src/dice/engine.ts`) is d20-only (`RollResult` carries
  `mode/isCrit/isFumble`). WFRP needs a separate d100 roll-under path.

## §1 Architecture — sheet routing

Refactor `app/character/[id].tsx` into a thin loader: load via `useCharacter`,
render the back-bar + "Saving…" indicator, then branch on `data.system`:

- Extract the current D&D body into `src/components/dnd5e/Dnd5eSheet.tsx`
  (`{ character, onChange, onRoll, onRollExpression }`).
- Add `src/components/wfrp4e/Wfrp4eSheet.tsx` with the same prop shape.
- `[id].tsx` becomes: loading → error screen → `switch (data.system)`.

This removes the data trap. `useCharacter`, `patch`, and db queries are unchanged.

Rejected: inline `system` conditionals inside `[id].tsx` (fat file, poor isolation).

## §2 WFRP components

New dir `src/components/wfrp4e/`, single long scroll, sections collapsible.
Each component takes `character` + `onChange={patch}` (+ roll callbacks where it
rolls), mirroring the dnd5e component granularity. Reuse existing primitives:
`Section`, `StatBox`, `EditableNumber`, `Stepper`, `TextEditModal`, and the
add/remove-row pattern from `Inventory`/`Attacks`.

| Component | Contents |
|---|---|
| `Wfrp4eHeader` | name, species, current career + rank, status (tier/standing), age, height |
| `Characteristics` | 10-stat grid (WS BS S T I Ag Dex Int WP Fel). Total = base+advances (large, tap → test). base + advances editable |
| `Resources` | Wounds (prominent), Fate/Fortune, Resilience/Resolve — steppers + spend buttons |
| `WfrpSkills` | rows: name · linked-char abbrev · total (charTotal+advances) · advances edit · tap → test. Add/remove. Basic/Advanced flag |
| `Talents` | rows: name · timesTaken · description (free text). Add/remove. (description feeds the next-phase wiki popup) |
| `Combat` | Weapons (name, group, damage e.g. `SB+4`, reach/range, qualities, enc) + Armour (name, locations, AP, enc) + ArmourPoints (head/body/arms/legs) |
| `Trappings` | item rows (name/enc/qty) + Encumbrance (carried vs max) + Wealth (brass/silver/gold) |
| `Magic` | Spells (name/lore/CN/range/target/duration/effect) + Prayers. Collapses when empty |
| `CorruptionSin` | Corruption (current/threshold), Sin, Mutations list |
| `StorySection` | Ambitions (short/long), Party ambition, Psychology, Notes |

## §3 WFRP dice — core + difficulty

New pure function `rollWfrpTest(target, { difficulty, label })` in `src/dice/`:

- Roll d100, result 1–100 (percentile dice; "00" + "0" reads as 100).
- `effectiveTarget = target + difficulty`.
- `success = roll <= effectiveTarget`.
- `SL = floor(effectiveTarget / 10) − floor(roll / 10)`.
- Doubles (11, 22, … 99, and 100) → crit on success, fumble on failure.
- Difficulty modifiers: Very Easy +60, Easy +40, Average +20, Challenging 0,
  Difficult −10, Hard −20, Very Hard −30. Default = Challenging (0).

Types & UI:
- New `WfrpRollResult` type (separate from the d20 `RollResult`):
  `{ roll, target, effectiveTarget, difficulty, sl, success, isCrit, isFumble, label, timestamp }`.
- New `WfrpRollModal` (or a branch in `RollModal`) showing roll vs target, SL,
  and a success/crit/fumble badge, with the difficulty picker.
- `useRoll` gains a `rollTest(target, label)` entry point.
- Reuse the generic `roll_history` table (label/expression/result/breakdown JSON).

Out of scope this phase: opposed-test mode (fast-follow).

## §4 Polish

- **Export / import** — `src/lib/transfer.ts`. Export: serialize character to JSON,
  write to cache file, `Sharing.shareAsync`. Import: `DocumentPicker` → parse →
  validate `system` + `schemaVer` → insert as a new row (fresh uuid).
  Entry points: export from the sheet back-bar; import from the character list.
- **Settings tab** — `app/(tabs)/settings.tsx`. Theme mode system/light/dark
  (persisted in the `settings` table), haptics on/off, About/version. Requires a
  small theme-provider refactor so `useTheme` reads the stored override instead of
  OS-only `useColorScheme`.
- **Empty / loading / error states** — character-list empty state
  ("No characters yet" + CTA), a real sheet error screen, reuse loading spinner.

## §5 Data model

No schema migration. WFRP type is otherwise complete. Add one additive, optional
field `skills[].description?: string` now, so the next-phase wiki popup has a place
to read from. Existing characters remain valid (field absent = undefined).

## §6 Testing

No test runner exists today. The WFRP dice math is pure and user-facing (a wrong
SL means a wrong game outcome), so add a minimal `jest-expo` runner covering
`src/dice` only:

- roll-under success/failure boundaries
- SL computation (incl. negative SL on failure)
- crit/fumble doubles detection (11, 22, … 99, 100)
- difficulty shift applied before comparison

No UI/component tests this phase.

## Acceptance criteria

1. Creating a WFRP character and opening it renders a full, editable sheet
   (no "Character not found").
2. All WFRP type fields are viewable and editable; edits persist via `patch`.
3. Tapping a characteristic or skill rolls a d100 test showing roll, SL, and
   success/crit/fumble, honoring the selected difficulty.
4. A character can be exported to JSON and re-imported as a new record.
5. Settings tab toggles theme (system/light/dark) and haptics; choices persist.
6. Character list shows an empty state; sheet shows a proper error screen.
7. `src/dice` tests pass.

## Deferred (explicitly NOT this phase)

- Wiki popup: tap a talent/skill → description popup (user-entered text only).
  Tracked as next-phase. Reuse across systems later.
- Onboarding flow (3 screens).
- Opposed-test dice mode.
- Paywall / RevenueCat / free-tier gating.

## Affected / new files

- `app/character/[id].tsx` (refactor to loader + switch)
- `app/(tabs)/settings.tsx` (new), `app/(tabs)/_layout.tsx` (add tab)
- `src/components/dnd5e/Dnd5eSheet.tsx` (extract)
- `src/components/wfrp4e/*` (new: sheet + ~9 section components)
- `src/dice/engine.ts`, `src/dice/types.ts` (WFRP roll path)
- `src/components/ui/WfrpRollModal.tsx` (new) or `RollModal.tsx` (branch)
- `src/hooks/useRoll.ts` (add `rollTest`), `src/hooks/useTheme.ts` (settings-backed)
- `src/lib/transfer.ts` (new)
- `src/types/wfrp4e.ts` (additive `skills[].description?`)
- test setup for `src/dice` (`jest-expo` + config)
