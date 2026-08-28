# UI Readability & Hierarchy Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise readability and visual hierarchy across the app by fixing token contrast, introducing semantic text roles, and reclassifying mis-leveled labels — without changing the fantasy identity or any behavior.

**Architecture:** Token-first. One contrast edit in `colors.ts` lifts WCAG AA for all 263 `textMuted` usages at once. Add three semantic text-role presets to `typography.ts`. Route shared primitives (`Section`, `StatBox`) through them so fixes propagate. Then a per-surface pass reclassifies signpost/label text from muted→secondary and adds an interactive-affordance language. Two PRs: systemic, then per-surface.

**Tech Stack:** Expo / React Native (SDK 56), TypeScript strict, `StyleSheet`, jest-expo (pure-function tests), lucide-react-native icons. Verify: `npm run typecheck`, `npm test`, browser preview (web, port 8082, launch config `ttrp-web`).

**Spec:** `docs/superpowers/specs/2026-06-24-ui-readability-audit-design.md`

---

## File map

| File | Change |
|---|---|
| `src/tokens/colors.ts` | Modify — bump `textMuted` (light `#74543C`, dark `#A38A6A`) |
| `src/tokens/__tests__/colors.test.ts` | Create — WCAG contrast assertions |
| `src/tokens/typography.ts` | Modify — add `sectionHeader`, `fieldLabel` roles (color-free, importable into `StyleSheet`) |
| `src/tokens/__tests__/typography.test.ts` | Create — role-preset shape assertions |
| `src/components/ui/Section.tsx` | Modify — header spreads `sectionHeader` (keep accent), 11→12 |
| `src/components/ui/StatBox.tsx` | Modify — label spreads `fieldLabel` + `textSecondary` |
| `src/components/ui/RollModal.tsx` | Modify — 2 stray `#22c55e` → `success`; result emphasis |
| `src/components/ui/WfrpRollModal.tsx` | Modify — 1 stray `#22c55e` → `success` |
| `src/components/ui/DeleteCharacterModal.tsx` | Modify — stray `#fff` → `accentText` |
| `app/(tabs)/dice.tsx` | Modify — stray `#22c55e` → `success`; die labels + section labels →secondary |
| `app/(tabs)/settings.tsx` | Modify — section labels muted→secondary |
| `app/(tabs)/index.tsx` | Modify — card subtitle muted→secondary |
| `src/components/wfrp4e/Characteristics.tsx` | Modify — abbrev → `fieldLabel`/secondary; Details→secondary; rollable die affordance |
| `src/components/wfrp4e/Wfrp4eHeader.tsx` | Modify — editable-text underline affordance |
| `src/components/dnd5e/CharacterHeader.tsx` | Modify — editable-text underline affordance (parity) |
| Dense components (Task 8 checklist) | Modify — field-label captions muted→secondary |

---

## PR 1 — Systemic

### Task 1: Contrast token fix (TDD)

**Files:**
- Test: `src/tokens/__tests__/colors.test.ts` (create)
- Modify: `src/tokens/colors.ts`

Background: `textMuted` carries field captions and labels app-wide. Current values fail WCAG AA on the worst-case surface (light `#8B6E5A` = 3.59:1 on `backgroundSecondary`; dark `#8B7355` = 3.41:1 on `card`). Targets: ≥4.5:1 against `background`, `card`, and `backgroundSecondary` in both modes.

- [ ] **Step 1: Write the failing test**

Create `src/tokens/__tests__/colors.test.ts`:

```ts
import { light, dark } from '../colors';

// WCAG 2.1 relative-luminance contrast ratio for two #rrggbb hexes.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe('token contrast (WCAG AA, normal text)', () => {
  for (const [name, scheme] of [['light', light], ['dark', dark]] as const) {
    const surfaces = [scheme.background, scheme.card, scheme.backgroundSecondary];
    it(`${name}: textMuted clears AA on every surface`, () => {
      for (const surf of surfaces) {
        expect(ratio(scheme.textMuted, surf)).toBeGreaterThanOrEqual(AA);
      }
    });
    it(`${name}: textSecondary clears AA on every surface`, () => {
      for (const surf of surfaces) {
        expect(ratio(scheme.textSecondary, surf)).toBeGreaterThanOrEqual(AA);
      }
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- colors`
Expected: FAIL — `light: textMuted clears AA` (3.59 < 4.5) and `dark: textMuted clears AA` (3.41 < 4.5). The `textSecondary` cases should already PASS.

- [ ] **Step 3: Apply the fix**

In `src/tokens/colors.ts`, change `textMuted` in both schemes. Light is currently `textMuted: palette.inkLight` (line ~37); dark is `textMuted: '#8B7355'` (line ~55). Set explicit values:

```ts
// in `light`:
  textMuted: '#74543C',
// in `dark`:
  textMuted: '#A38A6A',
```

Leave `palette.inkLight` and `tabBarInactive` untouched (out of scope). Do not change any other token.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- colors`
Expected: PASS (light worst-case 5.22, dark worst-case 4.67).

- [ ] **Step 5: Commit**

```bash
git add src/tokens/colors.ts src/tokens/__tests__/colors.test.ts
git commit -m "fix(ui): bump textMuted to clear WCAG AA on all surfaces"
```

---

### Task 2: Semantic text-role presets (TDD)

**Files:**
- Test: `src/tokens/__tests__/typography.test.ts` (create)
- Modify: `src/tokens/typography.ts`

Add two role presets. Colors are NOT baked in — `textStyle` is color-free and static, so it imports cleanly into `StyleSheet.create`; consumers spread the preset and apply `color` separately via `t.colors`. Only define roles this plan actually consumes (YAGNI): `sectionHeader`, `fieldLabel`. (The spec also floated `meta`/`cardTitle`/`value`; nothing here would consume them, so they are deferred to avoid dead tokens.)

- [ ] **Step 1: Write the failing test**

Create `src/tokens/__tests__/typography.test.ts`:

```ts
import { textStyle } from '../typography';

describe('semantic text roles', () => {
  it('sectionHeader: 12px uppercase bold', () => {
    expect(textStyle.sectionHeader.fontSize).toBe(12);
    expect(textStyle.sectionHeader.textTransform).toBe('uppercase');
    expect(textStyle.sectionHeader.fontWeight).toBe('700');
  });
  it('fieldLabel: 11px uppercase', () => {
    expect(textStyle.fieldLabel.fontSize).toBe(11);
    expect(textStyle.fieldLabel.textTransform).toBe('uppercase');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- typography`
Expected: FAIL — `Cannot read properties of undefined (reading 'fontSize')`.

- [ ] **Step 3: Add the presets**

In `src/tokens/typography.ts`, inside the `textStyle` object (after `statLabel`), add:

```ts
  sectionHeader: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- typography`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tokens/typography.ts src/tokens/__tests__/typography.test.ts
git commit -m "feat(ui): add sectionHeader/fieldLabel/meta text roles"
```

---

### Task 3: Route shared primitives through roles

**Files:**
- Modify: `src/components/ui/Section.tsx`
- Modify: `src/components/ui/StatBox.tsx`

These mount on every screen; fixing two files moves most labels.

- [ ] **Step 1: Update `Section.tsx`**

The header is already accent-colored + underlined (a strong signpost) — keep the accent, adopt the role so size goes 11→12 and tracking is consistent. Add the import at the top:

```ts
import { textStyle } from '@/tokens/typography';
```

Replace the `title` style block in the `StyleSheet` with a spread of the preset:

```ts
  title: { ...textStyle.sectionHeader },
```

(Color stays `t.colors.accent`, already applied inline in the JSX.)

- [ ] **Step 2: Update `StatBox.tsx`**

Label is currently `textMuted` at a dynamic 10/11px. Adopt `fieldLabel` (fixed 11) + secondary color. Add the import:

```ts
import { textStyle } from '@/tokens/typography';
```

Remove the `labelSize` constant (line ~15). In the label `<Text>` (line ~32), drop the inline `fontSize: labelSize`, spread the preset, and switch the color:

```tsx
      <Text style={[styles.label, textStyle.fieldLabel, { color: t.colors.textSecondary }]}>
        {label}
      </Text>
```

Then delete the now-redundant `fontSize`/`fontWeight`/`letterSpacing`/`textTransform` keys from the static `label` style block (they come from the preset); keep `textAlign: 'center'`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in preview**

Start preview (web, port 8082). Open a WFRP sheet. Confirm `Section` headers read at 12px and any `StatBox` tiles (e.g. D&D combat stats) show labels in the darker secondary ink. Screenshot light + dark.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Section.tsx src/components/ui/StatBox.tsx
git commit -m "feat(ui): route Section/StatBox through text roles"
```

---

### Task 4: Replace stray hex with tokens

**Files:**
- Modify: `src/components/ui/RollModal.tsx` (lines 70, 77)
- Modify: `src/components/ui/WfrpRollModal.tsx` (line 48)
- Modify: `app/(tabs)/dice.tsx` (line 116)
- Modify: `src/components/ui/DeleteCharacterModal.tsx` (line 54)

The 5 stray literals. `#22c55e` is a "crit/success" green → use `t.colors.success`. `#fff` is button text on the danger fill → use `t.colors.accentText` (white in both modes).

- [ ] **Step 1: RollModal.tsx**

Line 70: `const totalColor = isCrit ? t.colors.success : isFumble ? t.colors.danger : t.colors.text;`
Line 77 border: `borderColor: isCrit ? t.colors.success : isFumble ? t.colors.danger : t.colors.border`

- [ ] **Step 2: WfrpRollModal.tsx**

Line 48: `const headColor = crit ? t.colors.success : fumble ? t.colors.danger`  (keep the rest of the ternary unchanged).

- [ ] **Step 3: dice.tsx**

Line 116: `<Text style={[styles.stepBtnText, { color: t.colors.success }]}>+</Text>`

- [ ] **Step 4: DeleteCharacterModal.tsx**

Line 54: `<Text style={[styles.btnText, { color: matches ? t.colors.accentText : t.colors.textMuted }]}>{tr('common.delete')}</Text>`

- [ ] **Step 5: Typecheck + verify**

Run: `npm run typecheck` → no errors.
Preview: roll a crit on the dice screen and on a WFRP characteristic; confirm the crit green now matches the theme `success` (slightly deeper in dark mode). Screenshot.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/RollModal.tsx src/components/ui/WfrpRollModal.tsx app/\(tabs\)/dice.tsx src/components/ui/DeleteCharacterModal.tsx
git commit -m "refactor(ui): replace stray hex with theme tokens"
```

PR 1 boundary: open PR with Tasks 1–4. Verify every screen still renders (list, both sheets, dice, settings, modals) in light + dark before merge.

---

## PR 2 — Per-surface hierarchy & affordance

### Task 5: Screen-level label reclassification (dice, settings, list)

**Files:**
- Modify: `app/(tabs)/dice.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/index.tsx`

Decision rule used throughout PR 2: **a label/caption/signpost or a primary action's text → `textSecondary`; genuinely tertiary text (timestamps, version, placeholders, separators) stays `textMuted`.**

- [ ] **Step 1: dice.tsx — primary actions + labels**

Add `import { textStyle } from '@/tokens/typography';`. Die buttons are the screen's primary actions but their `d{n}` labels are muted — in `DiceButton` (line ~29), change the non-d20 color `t.colors.textMuted` → `t.colors.text`. Section labels: replace the static `sectionLabel` style block with `sectionLabel: { ...textStyle.sectionHeader }`, and change each usage's color (lines 97/123/133) `t.colors.textMuted` → `t.colors.textSecondary`. The non-d20 mode-button text (line ~50) inactive color `t.colors.textMuted` → `t.colors.textSecondary`.

- [ ] **Step 2: settings.tsx — section labels**

Add `import { textStyle } from '@/tokens/typography';`. Replace the static `section` style block with `section: { ...textStyle.sectionHeader, marginTop: 20, marginBottom: 8 }` (keep the margins). Change each of the four `styles.section` label colors (lines 52, 66, 80, 86) `t.colors.textMuted` → `t.colors.textSecondary`. The version value (line 89) stays `textMuted` (true tertiary).

- [ ] **Step 3: index.tsx — card subtitle**

`charSub` color (line 54) `t.colors.textMuted` → `t.colors.textSecondary`. The `updatedText` timestamp (line 57) stays `textMuted`.

- [ ] **Step 4: Typecheck + verify**

Run: `npm run typecheck` → no errors.
Preview each screen, light + dark, EN + ES. Confirm die labels read with full weight, section labels are clearly legible, list subtitles darker than timestamps. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/dice.tsx app/\(tabs\)/settings.tsx app/\(tabs\)/index.tsx
git commit -m "feat(ui): reclassify screen labels muted->secondary"
```

---

### Task 6: Characteristics grid — labels + rollable affordance

**Files:**
- Modify: `src/components/wfrp4e/Characteristics.tsx`
- Modify: `src/components/wfrp4e/WfrpSkills.tsx` (apply same rollable affordance)

- [ ] **Step 1: Reclassify abbrev + Details**

In `Characteristics.tsx`: add `import { textStyle } from '@/tokens/typography';`. Replace the static `abbrev` style block with `abbrev: { ...textStyle.fieldLabel }` (this takes it 10→11) and change its color (line 34) `t.colors.textMuted` → `t.colors.textSecondary`. The `detailsText` color (line 48) `t.colors.textMuted` → `t.colors.textSecondary` (it is a real action, not disabled).

- [ ] **Step 2: Add rollable die affordance**

The total is tappable to roll but looks static. Add a small die glyph mirroring the existing `buffDot` pattern. Import at top:

```ts
import { Dices } from 'lucide-react-native';
```

Inside the cell `<View>`, after the `<TouchableOpacity>` wrapping `total`, add a corner glyph:

```tsx
            <Dices size={9} color={t.colors.textMuted} style={styles.rollHint} />
```

Add the style:

```ts
  rollHint: { position: 'absolute', bottom: 4, alignSelf: 'center', opacity: 0.7 },
```

- [ ] **Step 3: Apply the same hint to WfrpSkills rollable rows**

In `WfrpSkills.tsx`, locate the skill-total element wrapped in the `onRoll` `TouchableOpacity`. Add the same `Dices` import and place an 11px `Dices` glyph (color `t.colors.textMuted`, `opacity: 0.6`) immediately left of the total value so each rollable skill carries the identical signal. (If the row layout has no spare horizontal room, place it as a leading element with `marginRight: 4`.)

- [ ] **Step 4: Typecheck + verify**

Run: `npm run typecheck` → no errors.
Preview a WFRP sheet. Confirm: abbrevs legible, "Details" reads as actionable, every rollable number shows the die glyph, tapping still opens the roll modal. Screenshot light + dark.

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/Characteristics.tsx src/components/wfrp4e/WfrpSkills.tsx
git commit -m "feat(ui): clarify characteristic labels and rollable affordance"
```

---

### Task 7: Editable-text affordance (sheet headers)

**Files:**
- Modify: `src/components/wfrp4e/Wfrp4eHeader.tsx`
- Modify: `src/components/dnd5e/CharacterHeader.tsx` (parity)

Tappable header fields (name, species, origin, career) look like static text. Give them a hairline "fillable line" underline — accent at ~35% alpha via the codebase's `hex + alpha-suffix` idiom (`+ '59'` ≈ 0x59/255 ≈ 35%).

- [ ] **Step 1: Wfrp4eHeader.tsx — name underline**

On the `name` `<Text>` (line ~47), add underline styling. Change the inline style array to include:

```tsx
        <Text
          style={[styles.name, styles.editable, { color: t.colors.text, borderBottomColor: t.colors.accent + '59', fontFamily: t.fontFamily.serif }]}
          numberOfLines={1}
        >
```

- [ ] **Step 2: Wfrp4eHeader.tsx — meta fields underline**

For each editable meta `<Text>` (species line ~54, origin line ~60, career line ~66), add `styles.editable` and `borderBottomColor: t.colors.accent + '59'` to its style array. Do NOT underline the `·` separators or the rank/tier pills (pills already signal interactivity via their border).

- [ ] **Step 3: Add the shared style**

In the `Wfrp4eHeader` `StyleSheet`, add:

```ts
  editable: { borderBottomWidth: 1, alignSelf: 'flex-start', paddingBottom: 1 },
```

- [ ] **Step 4: D&D parity**

In `CharacterHeader.tsx`, apply the same `editable` style + `borderBottomColor: t.colors.accent + '59'` to its tappable name/class/race text fields (whichever `<Text>` elements are wrapped in an edit `TouchableOpacity`). Add the identical `editable` style entry to that file's `StyleSheet`.

- [ ] **Step 5: Typecheck + verify**

Run: `npm run typecheck` → no errors.
Preview both sheet headers. Confirm each editable field shows a subtle accent underline, separators/pills do not, tapping still opens the editor. Screenshot light + dark.

- [ ] **Step 6: Commit**

```bash
git add src/components/wfrp4e/Wfrp4eHeader.tsx src/components/dnd5e/CharacterHeader.tsx
git commit -m "feat(ui): add fillable-line affordance to editable header fields"
```

---

### Task 8: Dense-component field-label pass

**Files (apply the rule per file):**
`src/components/wfrp4e/Magic.tsx`, `Combat.tsx`, `Trappings.tsx`, `SpeciesEditor.tsx`, `WfrpSkills.tsx`, `Talents.tsx`, `Resources.tsx`, `CorruptionSin.tsx`, `GrantedListsFields.tsx`, `CareerAdvanceModal.tsx`, `AdvanceCalculatorModal.tsx`, `ContentPicker.tsx`; `src/components/dnd5e/Spellcasting.tsx`, `Inventory.tsx`, `Attacks.tsx`, `CombatStats.tsx`, `FeaturesSection.tsx`, `Skills.tsx`, `ProficiencyRow.tsx`.

This is a mechanical reclassification, not a redesign. Do not change sizes or layout. For each `t.colors.textMuted` usage, apply the **decision rule** (from Task 5):

**→ change to `textSecondary`** when the text is a field caption / column header / row label / unit tag that names a value. Example pattern (uppercase caption above/beside a value):

```tsx
// before
<Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>{tr('wfrp.magic.range')}</Text>
// after
<Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.range')}</Text>
```

**→ leave as `textMuted`** when the text is genuinely tertiary:
- placeholder props: `placeholderTextColor={t.colors.textMuted}` — leave.
- empty-state / hint sentences (e.g. "No spells yet") — leave.
- separators, dots, and decorative glyphs — leave.
- inline icons used as adornments — leave.

Worked tertiary example (unchanged):

```tsx
<TextInput placeholderTextColor={t.colors.textMuted} ... />   // stays muted
```

- [ ] **Step 1: Sweep file-by-file**

For each file above, open it, locate every `textMuted`, and apply the rule. Keep a tally of changed vs left-muted per file in the commit body.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify the densest screens**

Preview: open a WFRP sheet with spells (Magic), the Combat section, and a D&D sheet with Spellcasting + Inventory. Confirm captions are clearly legible and empty-state/placeholder text is still visibly de-emphasized (hierarchy preserved). Screenshot Magic + Combat + Spellcasting, light + dark.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e src/components/dnd5e
git commit -m "feat(ui): reclassify field-label captions across sheet sections"
```

---

### Task 9: Modal label + result emphasis pass

**Files:**
- Modify: `src/components/ui/RollModal.tsx`
- Modify: `src/components/ui/WfrpRollModal.tsx`
- Review (apply rule if needed): `src/components/ui/CreateCharacterModal.tsx`, `TextEditModal.tsx`, `EditableNumber.tsx`, `Stepper.tsx`, `wfrp4e/WikiModal.tsx`, `wfrp4e/CareerAdvanceModal.tsx`

- [ ] **Step 1: Roll modals — labels vs result**

In `RollModal.tsx` and `WfrpRollModal.tsx`, apply the Task 5 decision rule to the remaining `textMuted` labels (the `label`/`vs`/`modifier`/`pipDie` captions that name parts of the result → `textSecondary`; keep dropped-die values and the `pipVal` dimming logic as-is — those encode state). Confirm the final total / SL result is the largest, highest-contrast element (`t.colors.text` or `success`/`danger`) — it must remain the visual peak. No size changes unless the result is not already the largest; if it isn't, leave a note rather than restyling.

- [ ] **Step 2: Remaining modals — rule pass**

For each Review file, apply the same muted→secondary rule to caption/label text; leave placeholders, hints, and cancel-button text muted.

- [ ] **Step 3: Typecheck + verify**

Run: `npm run typecheck` → no errors.
Preview: trigger a d20 roll, a WFRP opposed/standard roll, the create-character modal, and a text-edit modal. Confirm labels are legible and the roll result clearly dominates. Screenshot the two roll modals, light + dark.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui src/components/wfrp4e/WikiModal.tsx src/components/wfrp4e/CareerAdvanceModal.tsx
git commit -m "feat(ui): tidy modal label hierarchy and result emphasis"
```

PR 2 boundary: open PR with Tasks 5–9. Full regression sweep — every surface, light + dark, EN + ES — with before/after screenshots attached. Split into two PRs (5–7 / 8–9) if the diff grows unwieldy.

---

## Final verification (before merging PR 2)

- [ ] `npm run typecheck` — clean.
- [ ] `npm test` — green (includes new `colors`/`typography` suites).
- [ ] Contrast: spot-check that no remaining body label uses raw `textMuted` on `backgroundSecondary` below AA (the token fix guarantees ≥4.5, but confirm no new hardcoded colors were introduced).
- [ ] Visual: list, WFRP sheet, D&D sheet, dice, settings, roll modals — all readable in light + dark, EN + ES, no layout breaks from the 11→12 header bump.

## Non-goals (do not do)

- No aesthetic refresh (new accent, redesigned cards).
- No behavior changes.
- No mass tokenization of the 286 `fontSize` literals beyond the role adoptions above.
- No touching `palette.inkLight` / `tabBarInactive`.
