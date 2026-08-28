# UI Readability & Hierarchy Audit — Design

**Date:** 2026-06-24
**Status:** Approved (design phase)
**Scope:** Whole app (sheets, list, dice, settings, modals)
**Goal:** Improve readability and visual hierarchy. Keep the fantasy parchment/charcoal identity; design tokens are tunable.
**Approach:** Token-first, then sweep (fix the root cause in tokens, then route components through it).

---

## 1. Problem

The app has a real token system (`src/tokens/colors.ts`, `spacing.ts`, `typography.ts`) but readability suffers from two root causes:

1. **`textMuted` fails contrast and is overused.** Light `#8B6E5A` on parchment `#F5EDD6` ≈ 3.1:1 — below WCAG AA (4.5:1). It carries *signposts* (section headers) and *labels* (field captions) that should read as secondary, not tertiary.
2. **Typography tokens are defined but never used.** Grep: **0** files reference `t.fontSize`/`t.textStyle`; **286** inline `fontSize: N` literals. Hierarchy is ad-hoc per component, so section headers — the main navigational signposts — end up the *smallest and lowest-contrast* text on screen (hierarchy inverted).

Colors are otherwise well-tokenized: only **5 stray hex literals** across 3 files (`#22c55e` ×2 in `dice.tsx`; the remaining 3 in `RollModal.tsx`/`WfrpRollModal.tsx`). So a contrast fix in `colors.ts` propagates almost everywhere for free.

### Audit findings (ranked)

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | `textMuted` ~3.1:1, fails AA; used for subtitles/labels/values app-wide | StatBox label, card subtitle, settings values, every `sectionLabel` | High |
| 2 | Section labels = smallest (11px) + lowest-contrast (muted) text, yet they are the primary signposts → hierarchy inverted | `Section`, dice, settings | High |
| 3 | Die labels `d{n}` muted, though dice are the screen's primary actions | `dice.tsx` | Med |
| 4 | Characteristics grid abbrev 10px muted; "Details" action text muted (reads disabled) | `Characteristics.tsx` | Med |
| 5 | StatBox label 10px uppercase muted — near-illegible | `StatBox.tsx` | Med |
| 6 | 5 stray hex bypass tokens | `dice.tsx`, `RollModal.tsx`, `WfrpRollModal.tsx` | Low |
| 7 | Interactive text reads as static (header fields, rollable totals, Details) | sheet header, Characteristics | Med (UX-adjacent) |

---

## 2. Token changes (Section 1)

### 2.1 Contrast

Bump `textMuted` so even genuinely tertiary text clears AA. Exact hexes validated against background during implementation (target ≥4.5:1 body / ≥3:1 large·UI).

| Token | Light now | Light → | Dark now | Dark → |
|---|---|---|---|---|
| `textMuted` | `#8B6E5A` (~3.1:1) | `#7A5C45` (~4.6:1) | `#8B7355` | `#A38A6A` |

No other color token changes value. `textSecondary` (`#5C3D2E` light) already clears AA and becomes the home for reclassified labels.

### 2.2 Semantic text roles

Add named presets to `textStyle` in `typography.ts`, built on existing `fontSize`/`fontWeight`. Components reference these instead of hardcoding size + color.

| Role | Use | Today | Becomes |
|---|---|---|---|
| `sectionHeader` | `Section`/settings/dice signposts | 11 upper, muted | 12 upper, semibold, **textSecondary** |
| `fieldLabel` | StatBox + field captions | 10–11 upper, muted | 11 upper, **textSecondary** |
| `meta` | timestamps, version, hints | muted | **muted (bumped)** — only place muted survives |
| `cardTitle` | char names, row titles | hardcoded 17–18 serif | tokenized, look unchanged |
| `value` | stat numbers | hardcoded serif bold | tokenized, look unchanged |

**Core rule:** muted is for genuinely tertiary information only. Signposts and labels graduate to `textSecondary`. This single reclassification is most of the readability win.

Color tokens are values; text roles describe size/weight/casing. A role preset references a color token by name in the consuming component (RN `StyleSheet` can't embed theme colors statically), so components apply `{ ...t.textStyle.sectionHeader, color: t.colors.textSecondary }`.

### 2.3 Spacing/scale

Spacing token *values* are fine and unchanged. The work is routing components through the type scale (Section 3), not re-rhythming the grid.

---

## 3. The sweep (Section 2)

Not a mass tokenization of all 286 `fontSize` literals — that is churn with regression risk and ~no readability gain. The sweep is surgical:

### 3.1 Token edits (source of truth)
- `colors.ts`: apply 2.1 contrast bump; replace the 5 stray hex with tokens (`#22c55e` → `colors.success`).
- `typography.ts`: add the 2.2 role presets.

### 3.2 Primitive adoption
Route the *shared* primitives through roles so fixes propagate without touching every screen:
- `Section` header → `sectionHeader` (textSecondary, 11→12).
- `StatBox` label → `fieldLabel` (textSecondary, 10→11).

These mount on every screen; two files move most labels.

### 3.3 Color reclassification sweep
Grep every `textMuted` usage in `src/components` and `app`. For each, decide:
- **signpost / label → `textSecondary`** (section labels, field captions, die labels, "Details").
- **true tertiary → stays `textMuted`** (timestamps, version, placeholders, separators/dots, hints).

Mechanical, reviewable, file-by-file. Covers screens that don't go through the primitives (dice/settings inline labels, list card subtitle).

### Out of scope
Mass-tokenizing the 286 `fontSize` literals. Only touch a size when a screen's hierarchy pass (Section 4) demands it.

---

## 4. Per-surface hierarchy pass (Section 3)

Changes beyond the global token fix.

| Surface | Change |
|---|---|
| **Char list** | Card subtitle muted→secondary (via 3.3). System badge + card hierarchy unchanged. |
| **WFRP / D&D sheets** | `sectionHeader` contrast bump is the locator fix for the long scroll; keep 24px rhythm. Characteristics grid abbrev 10px muted → `fieldLabel`. "Details" button text muted→secondary (it's a real action). |
| **Dice** | Die labels `d{n}` muted→text/secondary (primary actions shouldn't be muted). 2 stray hex → `success` token. Section labels →secondary. |
| **Settings** | Section labels →secondary. Version value stays `meta`. |
| **Modals** (Roll, WfrpRoll, others) | Audit each for the same muted-label issue + stray hex → tokens. Ensure the roll **result** is the visual peak of the modal. |

### 4.1 Interactive affordance language (in scope)

Tappable text currently reads as static. Two subtle, consistent affordance classes; exact pixel treatment tuned in browser preview:

- **Editable inline text** (header name/species/origin/career; inline text fields) → hairline "fillable line" underline, accent at ~35% alpha. Reads as a blank to fill; fits the parchment aesthetic.
- **Rollable stat** (characteristic totals, skill totals) → small die glyph adjacent to, or accent tint on, the value to signal "tap to roll."

Applied consistently wherever an `onPress` wraps text that otherwise looks static.

---

## 5. Verification & rollout (Section 4)

### Verification
- `npm run typecheck` and `npm test` (pure-function suites; tokens/UI have no snapshot tests) stay green.
- Browser preview (web, port 8082, launch config `ttrp-web`): before/after screenshots for **each surface × light/dark × EN/ES**. Spot-check ES — longer strings stress the bumped sizes.
- Contrast: confirm `textMuted`/`textSecondary` hit **≥4.5:1** (body) / **≥3:1** (large·UI) against both backgrounds.

### Phasing — 2 PRs
1. **Systemic:** `colors.ts` contrast + `typography.ts` roles + `Section`/`StatBox` adoption + `textMuted`→`textSecondary` reclassification + 3 stray hex. Small, global. Verify every screen still renders.
2. **Per-surface:** sheet/dice/list hierarchy tweaks + affordance language (4.1). Larger, screen-by-screen with screenshots.

Split PR2 if the diff balloons.

### Non-goals
- No aesthetic refresh (new accent, redesigned cards) — identity stays.
- No new features, no behavior changes.
- No mass `fontSize` tokenization beyond what hierarchy requires.
