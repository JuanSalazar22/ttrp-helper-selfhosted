# UI/UX Audit Fixes — Design

**Date:** 2026-08-31
**Status:** Draft — pending review
**Topic:** Fix the contrast, accessibility-labeling, touch-target, and motion issues found by a full-app UI/UX audit (run against WCAG AA and mobile HIG/Material touch-target guidelines, since the app is React Native/Expo rather than a web page).

## Context

A pass over `src/tokens/colors.ts` and every screen/component was done using computed WCAG relative-luminance contrast ratios (not eyeballing) plus a grep-and-read sweep for missing `accessibilityLabel`s, small tap targets, and unguarded animations. Findings split into five groups below. The codebase already contains the *correct* pattern for two of the bug classes ([DeleteCharacterModal.tsx:54](../../../src/components/ui/DeleteCharacterModal.tsx:54) for disabled-button text, [CharacteristicsDetail.tsx:76](../../../src/components/wfrp4e/CharacteristicsDetail.tsx:76) for labeled icon buttons) — the fix is largely "apply the pattern that already exists elsewhere, consistently."

## Goals

- Every text/background color pair used for text meets WCAG AA (4.5:1 normal text, 3:1 for ≥18px/≥14px-bold).
- Disabled primary buttons never render unreadable text.
- Icon-only buttons have `accessibilityLabel`s (screen reader + doubles as web hover tooltip via the existing `hoverTitle()` helper, per [2026-08-31-hover-tooltips-design.md](2026-08-31-hover-tooltips-design.md), where that button is in-scope for that effort — this spec covers the labels themselves).
- Interactive elements meet a ~44×44pt minimum tap target (Apple HIG) / ~48×48dp (Material).
- Custom `reanimated` animations respect the user's reduce-motion setting.
- No visual regression to the parchment/crimson/gold theme — fixes are targeted token/value changes, not a redesign.

## Non-goals

- No redesign of the color palette or visual language — the existing theme is intentionally distinctive and stays.
- No new design system / component library adoption.
- No change to app navigation, information architecture, or feature scope.
- `ErrorState.tsx` icon color and the `JSON.parse` memoization note are tracked here as minor/optional cleanup, not required for this spec to be considered done.

## Decisions

| Area | Finding | Decision |
|---|---|---|
| Gold status pill text | [Wfrp4eHeader.tsx:86-88](../../../src/components/wfrp4e/Wfrp4eHeader.tsx:86) renders `light.gold` (`#C9A84C`) text on `light.background` (`#F5EDD6`) = **1.96:1**. | Add a separate darker `goldText` token for light mode (existing `dark.gold` already uses the lighter `goldLight` and is unaffected). Target ≥4.5:1 against parchment — e.g. a darkened gold around `#8A6D1F`–`#96741E` range, picked and verified by the contrast script before landing. Apply to both the rank pill ([Wfrp4eHeader.tsx:84](../../../src/components/wfrp4e/Wfrp4eHeader.tsx:84), which uses `t.colors.accent` and is already fine) and the status pill (line 86-88). Also check the other `.gold`-as-text call sites found in the sweep — [Inventory.tsx:70](../../../src/components/dnd5e/Inventory.tsx:70), [CombatStats.tsx:72](../../../src/components/dnd5e/CombatStats.tsx:72) — and switch them to the new token; leave `Stepper.tsx:38`'s `barColor` alone (non-text, unaffected). |
| Dark-mode accent-as-text | `dark.accent` (`#C0392B`) used as text color on `dark.background`/`dark.card` = **3.31:1**, below AA at the small sizes it's used at (~87 call sites via `t.colors.accent` as `color:`). | Add a dedicated `accentText`-for-labels token distinct from the existing `accentText` (which is white-on-accent-background, for buttons, and stays as-is). New token e.g. `dark.link` (or reuse/rename to make the split obvious): a lighter red that clears 4.5:1 on `#1A1612`, picked via the contrast script. Because this token is used broadly as inline `color: t.colors.accent`, do this as a single token-level fix in dark mode rather than touching every call site individually: `dark.accent` itself is only used as background elsewhere (buttons/borders, which are fine at 3.31:1 for non-text UI per WCAG's 3:1 non-text threshold), so the safer move is introducing a new `accentTextOnBg` token used specifically at the ~87 text call sites, migrated file by file since `t.colors.accent` is currently overloaded for both button-background and label-text roles. Confirm no light-mode regression (light.accent is 7.95:1, unaffected since only `dark.*` changes). |
| Disabled primary buttons | Background swaps to `t.colors.border` while text stays hardcoded `t.colors.accentText` (white) → ~1.58:1. Repeats in [dice.tsx:147-152](../../../app/(tabs)/dice.tsx:147), [CreateCharacterModal.tsx:113-115](../../../src/components/ui/CreateCharacterModal.tsx:113), [AdvanceCalculatorModal.tsx:124-129](../../../src/components/wfrp4e/AdvanceCalculatorModal.tsx:124), [Buffs.tsx:238-239](../../../src/components/wfrp4e/Buffs.tsx:238). | Apply the existing correct pattern from [DeleteCharacterModal.tsx:54](../../../src/components/ui/DeleteCharacterModal.tsx:54) to all four: text color becomes a ternary — `t.colors.accentText` when enabled, `t.colors.textMuted` when disabled — matching the same condition already driving the background color in each file. Mechanical, one-line change per file. |
| Tab bar inactive labels | `tabBarInactive`/`tabBar` ≈ 3.4–3.6:1 in both themes ([_layout.tsx:20-21](../../../app/(tabs)/_layout.tsx:20)), below AA for the 11px bold label. | Darken (light) / lighten (dark) `tabBarInactive` in [colors.ts](../../../src/tokens/colors.ts) until ≥4.5:1 against `tabBar`, verified with the contrast script. Small token change, no layout impact. |
| Icon-only close buttons missing labels | `X` close buttons with no `accessibilityLabel` in [AccountSheet.tsx:326](../../../src/components/ui/AccountSheet.tsx:326), [CareerPicker.tsx:145](../../../src/components/wfrp4e/CareerPicker.tsx:145), [ContentPicker.tsx:65](../../../src/components/wfrp4e/ContentPicker.tsx:65), [OriginPicker.tsx:55](../../../src/components/wfrp4e/OriginPicker.tsx:55), [SpeciesPicker.tsx:101](../../../src/components/wfrp4e/SpeciesPicker.tsx:101), [WikiModal.tsx:30](../../../src/components/wfrp4e/WikiModal.tsx:30), [Buffs.tsx:219](../../../src/components/wfrp4e/Buffs.tsx:219), [GrantedListsFields.tsx:50,71](../../../src/components/wfrp4e/GrantedListsFields.tsx:50), [TagEditor.tsx:48](../../../src/components/ui/TagEditor.tsx:48). | Add `accessibilityLabel={tr('common.close')}` (existing i18n key, already used by [CharacteristicsDetail.tsx:76](../../../src/components/wfrp4e/CharacteristicsDetail.tsx:76)) to every listed button — copy that file's exact pattern (`hitSlop={12}` included, see Touch targets row below). No new i18n keys needed for this group. |
| Header icon buttons on character list | On [index.tsx](../../../app/(tabs)/index.tsx), the Hammergen-import button has a label (`characters.importHammergenA11y`) but the Upload button, account/avatar button, and "+" create button next to it don't. | Add `accessibilityLabel`s to the Upload, avatar, and create buttons, following the same naming convention as the existing `characters.*A11y` keys. Add corresponding `en.ts`/`es.ts` entries (e.g. `characters.uploadA11y`, `characters.accountA11y`, `characters.createA11y`), matching this app's bilingual i18n convention. |
| Card row action buttons too small | `cardAction: { padding: 2 }` around a 16px icon (duplicate/delete on each character card, [index.tsx](../../../app/(tabs)/index.tsx)) — well under the 44pt minimum, and the two buttons sit close together. | Increase `padding` to bring the effective tap target to ~44×44pt (e.g. `padding: 12` around the 16px icon = 40px box, or pair a smaller padding with `hitSlop`). Keep visual icon size unchanged — only the tappable area grows. Delete already requires typed confirmation, so this is about precision/comfort, not safety. |
| WFRP status/rank pills too small | [Wfrp4eHeader.tsx:143](../../../src/components/wfrp4e/Wfrp4eHeader.tsx:143) `pill: { paddingVertical: 2, ... }` → ~17px tall tap target that opens an edit modal. | Increase `paddingVertical` (and add `hitSlop` if the visual size shouldn't grow further) to reach ~44pt tall, consistent with the card-action fix above. |
| Unguarded motion | None of [RollModal.tsx](../../../src/components/ui/RollModal.tsx), [WfrpRollModal.tsx](../../../src/components/ui/WfrpRollModal.tsx), [PortraitCropper.tsx](../../../src/components/ui/PortraitCropper.tsx), [CrumbleOverlay.tsx](../../../src/components/ui/CrumbleOverlay.tsx) check `AccessibilityInfo.isReduceMotionEnabled()`. | Add a small shared hook, `src/hooks/useReducedMotion.ts`, wrapping `AccessibilityInfo.isReduceMotionEnabled()` + its change-event listener, returning a boolean. In each of the four components, when `true`: skip/shorten the `withTiming`/`withDelay` animations (jump straight to end state) rather than removing the effect entirely — dice rolls and crop preview still need to *resolve*, just without the flourish. `CrumbleOverlay` specifically: render the shattered end-state immediately instead of animating shards outward. |

## Non-goals detail: what stays as-is

- `light.accent` (7.95:1) and `dark.goldLight`-on-`charcoalMid` (9.47:1) — already passing, untouched.
- `Stepper.tsx`/`EditableNumber.tsx` buttons — have visible text labels (`"+5"`, `"Cancel"`, `"Save"`), which RN's accessibility tree reads automatically; no `accessibilityLabel` needed there.
- The other ~29 of 49 `TouchableOpacity`/`Pressable` files with zero `accessibilityLabel` — reviewed and confirmed low-risk (all wrap visible text content), not touched by this spec.

## Testing / verification plan

- Extend (or reuse) the contrast-ratio Node script used during the audit as a one-off check for each new/changed token pair before committing the color value — not shipped as a permanent script unless useful for future token additions.
- After the token and component changes, manually verify in both light and dark mode: status pill legible, rank pill legible, dark-mode labels (e.g. a `Section.tsx` header, an "equipped" tag) legible, tab bar inactive labels legible.
- Manually trigger each of the four disabled-button states (empty name in Create Character, no career-advance changes, empty custom dice expression, empty buff name) and confirm the label is visible (muted, not white-on-light).
- VoiceOver/TalkBack spot check (or Expo's accessibility inspector) on the newly labeled close buttons and header icons.
- Tap-target check: use the RN inspector or a physical device to confirm card-action and status/rank-pill tap areas are comfortably hittable.
- Enable "Reduce Motion" in the OS accessibility settings and confirm dice rolls, portrait cropping, and the crumble/shatter effect still complete correctly with reduced/no animation.
- Full `npm test` + `npx tsc --noEmit` after all files are touched.
