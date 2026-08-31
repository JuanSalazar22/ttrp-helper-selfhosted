# Hover Tooltips for Icon-Only Buttons — Design

**Date:** 2026-08-31
**Status:** Approved — implementing directly (no separate plan document, per user instruction)
**Topic:** Give every icon-only button in the app a hover tooltip (web) explaining what it does, sourced from the same string as its screen-reader label.

## Context

An icon-only button (a `TouchableOpacity`/`Pressable` whose visible content is just a `lucide-react-native` icon, no adjacent text) gives a sighted mouse user on web no clue what it does until they click it. A full app-wide inventory found **40 such buttons across 22 files** — 15 already have an `accessibilityLabel` (for screen readers) that can be reused as-is; 25 have no label at all today, mostly `Trash2` delete icons.

## Goals

- Every icon-only button shows a hover tooltip on web explaining what it does.
- One string serves both purposes — `accessibilityLabel` (screen readers) and the hover tooltip — no duplicated copy to maintain.
- Where a button is missing `accessibilityLabel` today, add one, following each file's existing labeling convention (name-interpolated where an item name is in scope, e.g. `"Remove {name}"`; a generic key otherwise, e.g. modal-close `X` buttons).
- Bilingual: every new label gets real English and Spanish text, matching this app's existing i18n convention — no placeholders.

## Non-goals

- Icon+text buttons (`+ Add Weapon`, etc.) — already self-explanatory, out of scope.
- A custom-styled tooltip component — the plain browser-native tooltip (from an HTML `title` attribute) is enough; no positioning/timing/dismiss logic to build.
- Any change to button behavior — this is purely additive labeling.
- Native iOS/Android — hover doesn't exist as a native mobile interaction; the mechanism is guarded to web only and is a no-op elsewhere.

## Decisions

| Area | Decision |
|---|---|
| Mechanism | New `src/lib/a11y.ts` exports `hoverTitle(label: string)`, returning `Platform.OS === 'web' ? { title: label } : {}`. Spread onto a button's props alongside `accessibilityLabel={label}` — the browser renders the native `title` attribute as a hover tooltip; native platforms never see the prop. Matches this codebase's established `Platform.OS === 'web' ? {...} : {}` conditional-prop pattern (already used for `onWheel` in `PortraitCropper.tsx`). |
| Where a label already exists | Reuse it verbatim for `hoverTitle` — no new i18n keys, no new strings. |
| Where a label is missing | Add a new `accessibilityLabel`, then apply `hoverTitle` to that same value. Name-interpolated (`"Remove {name}"`) when an item name is available at that call site (matches `characters.deleteA11y`'s existing pattern); a generic key (e.g. `common.close`) for context-free buttons. New keys added to both `en.ts` and `es.ts` with real translations. |
| Scope | All 40 buttons found in the inventory, across: `app/(tabs)/index.tsx`, `app/character/[id].tsx`, `src/components/ui/AccountSheet.tsx`, `src/components/ui/CharacterPortrait.tsx`, `src/components/dnd5e/{Inventory,Spellcasting,Attacks}.tsx`, `src/components/wfrp4e/{WfrpSkills,OriginPicker,Trappings,ContentPicker,WikiModal,CriticalWounds,CareerPicker,CorruptionSin,Combat,CharacteristicsDetail,Talents,SpeciesPicker,Buffs,GrantedListsFields,Magic}.tsx`. |

## Testing / verification plan

- `hoverTitle()` is a pure function — trivial to unit test (returns `{title: x}` on web, `{}` otherwise), covered in `src/lib/__tests__/a11y.test.ts`.
- Manual verification (per this project's convention — no RN Testing Library component tests): open the web build, hover a sample of buttons across different files (a `Trash2` delete icon, a modal-close `X`, the header's account/import icons) and confirm the browser tooltip appears with sensible text; switch locale to Spanish and confirm the tooltip text follows.
- Full `npm test` + `npx tsc --noEmit` after all files are touched.
