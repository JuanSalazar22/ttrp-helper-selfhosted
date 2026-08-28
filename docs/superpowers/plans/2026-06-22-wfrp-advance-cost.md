# WFRP Advance XP-Cost Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the WFRP 4e XP cost of the next advance for characteristics and skills, with a step control, without spending any XP.

**Architecture:** A pure `advanceCost(advances)` helper returns the band cost; the characteristics detail view adds a per-characteristic cost sub-row with `[−]`/`[+1]`, and the skills rows show the cost under their existing advance control.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · TypeScript (strict) · jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-22-wfrp-advance-cost-design.md`

---

## File Structure

- `src/types/wfrp4e.ts` — **modify**: add `advanceCost` helper (+ `ADVANCE_COST_BANDS`).
- `src/types/__tests__/wfrp4e.test.ts` — **modify**: add `advanceCost` boundary tests.
- `src/components/wfrp4e/CharacteristicsDetail.tsx` — **modify**: per-characteristic cost sub-row + step buttons.
- `src/components/wfrp4e/WfrpSkills.tsx` — **modify**: cost label under the advance control.

No data-shape or schema change. UI tasks verified with `tsc` + web preview (no RNTL tests).

---

## Task 1: `advanceCost` helper (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts`
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { advanceCost } from '../wfrp4e';

describe('advanceCost', () => {
  test('returns the band cost for the next advance', () => {
    expect(advanceCost(0)).toBe(25);
    expect(advanceCost(5)).toBe(25);
    expect(advanceCost(6)).toBe(30);
    expect(advanceCost(10)).toBe(30);
    expect(advanceCost(11)).toBe(40);
    expect(advanceCost(45)).toBe(190);
    expect(advanceCost(46)).toBe(230);
    expect(advanceCost(100)).toBe(230);
  });
  test('clamps negative input to the first band', () => {
    expect(advanceCost(-3)).toBe(25);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — `advanceCost` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/types/wfrp4e.ts`, add (after `woundsMax`, before `defaultWfrp4eCharacter`):

```ts
const ADVANCE_COST_BANDS: Array<{ max: number; cost: number }> = [
  { max: 5, cost: 25 },
  { max: 10, cost: 30 },
  { max: 15, cost: 40 },
  { max: 20, cost: 50 },
  { max: 25, cost: 70 },
  { max: 30, cost: 90 },
  { max: 35, cost: 120 },
  { max: 40, cost: 150 },
  { max: 45, cost: 190 },
];

/** XP cost of the NEXT advance, given how many advances are already bought. */
export function advanceCost(currentAdvances: number): number {
  const a = Math.max(0, currentAdvances);
  for (const band of ADVANCE_COST_BANDS) {
    if (a <= band.max) return band.cost;
  }
  return 230;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (all wfrp4e tests green).

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): advanceCost XP cost-band helper"
```

---

## Task 2: Characteristics detail — cost sub-row

**Files:**
- Modify: `src/components/wfrp4e/CharacteristicsDetail.tsx`

- [ ] **Step 1: Import `advanceCost`**

Change the import block:

```tsx
import {
  CHARACTERISTIC_ABBREV, CHARACTERISTIC_LABELS, characteristicTotal,
} from '@/types/wfrp4e';
```
to:
```tsx
import {
  CHARACTERISTIC_ABBREV, CHARACTERISTIC_LABELS, characteristicTotal, advanceCost,
} from '@/types/wfrp4e';
```

- [ ] **Step 2: Replace the per-characteristic row JSX**

Replace the entire `{KEYS.map(k => { ... })}` block body (the `return (<View key={k} …>…</View>)`)
with this version that wraps the existing row and adds the advance sub-row:

```tsx
          {KEYS.map(k => {
            const c = character.characteristics[k];
            const sum = characteristicTotal(character, k);
            return (
              <View key={k} style={[styles.rowWrap, { borderBottomColor: t.colors.border }]}>
                <View style={styles.row}>
                  <Text style={[styles.rowAbbrev, { color: t.colors.text }]}>{CHARACTERISTIC_ABBREV[k]}</Text>
                  <View style={styles.fields}>
                    <View style={styles.field}><EditableNumber size="sm" label="Roll" value={c.roll} onSave={v => setField(k, 'roll', v)} /></View>
                    <View style={styles.field}><EditableNumber size="sm" label="Racial" value={c.racial} onSave={v => setField(k, 'racial', v)} /></View>
                    <View style={styles.field}><EditableNumber size="sm" label="Other" value={c.other} onSave={v => setField(k, 'other', v)} /></View>
                    <View style={styles.field}><EditableNumber size="sm" label="Adv" value={c.advances} onSave={v => setField(k, 'advances', v)} /></View>
                  </View>
                  <View style={styles.sumBox}>
                    <Text style={[styles.sum, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{sum}</Text>
                  </View>
                </View>
                <View style={styles.advRow}>
                  <Text style={[styles.advCost, { color: t.colors.textMuted }]}>next advance · {advanceCost(c.advances)} XP</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, { borderColor: t.colors.border }]}
                    onPress={() => setField(k, 'advances', Math.max(0, c.advances - 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, { color: t.colors.textMuted }]}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepBtn, { borderColor: t.colors.accent }]}
                    onPress={() => setField(k, 'advances', c.advances + 1)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, { color: t.colors.accent }]}>+1</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
```

- [ ] **Step 3: Update styles**

In the `StyleSheet.create`, replace the `row:` line with the following (the row keeps its
fl/gap layout but loses its own bottom border, which moves to `rowWrap`), and add the new styles:

```ts
  rowWrap: { paddingVertical: 8, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  advRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  advCost: { fontSize: 11, fontWeight: '600' },
  stepBtn: { minWidth: 34, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stepBtnText: { fontSize: 13, fontWeight: '700' },
```

(Keep `rowAbbrev`, `fields`, `field`, `sumBox`, `sum`, and the other styles unchanged.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/CharacteristicsDetail.tsx
git commit -m "feat(wfrp): advance cost + step control in characteristics detail"
```

---

## Task 3: Skills — cost label under the advance control

**Files:**
- Modify: `src/components/wfrp4e/WfrpSkills.tsx`

- [ ] **Step 1: Import `advanceCost`**

Change:

```tsx
import { CHARACTERISTIC_ABBREV, characteristicTotal } from '@/types/wfrp4e';
```
to:
```tsx
import { CHARACTERISTIC_ABBREV, characteristicTotal, advanceCost } from '@/types/wfrp4e';
```

- [ ] **Step 2: Replace the advance value display**

Replace this line (inside the `advCtl` view):

```tsx
            <Text style={[styles.advVal, { color: t.colors.textMuted }]}>+{s.advances}</Text>
```
with:
```tsx
            <View style={styles.advVal}>
              <Text style={[styles.advValNum, { color: t.colors.textMuted }]}>+{s.advances}</Text>
              <Text style={[styles.advValCost, { color: t.colors.textMuted }]}>{advanceCost(s.advances)} XP</Text>
            </View>
```

- [ ] **Step 3: Update styles**

In the `StyleSheet.create`, replace the `advVal:` line:

```ts
  advVal: { fontSize: 12, fontWeight: '600', minWidth: 26, textAlign: 'center' },
```
with:
```ts
  advVal: { minWidth: 46, alignItems: 'center' },
  advValNum: { fontSize: 12, fontWeight: '600' },
  advValCost: { fontSize: 9, fontWeight: '600' },
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/WfrpSkills.tsx
git commit -m "feat(wfrp): show advance XP cost on skill rows"
```

---

## Task 4: Verify against acceptance criteria

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all jest tests pass.

- [ ] **Step 2: Web preview smoke test**

Start the web preview (`ttrp-web`). Open or create a WFRP character.

Confirm:
1. In the characteristics **Details** view, each row shows `next advance · 25 XP` (for a
   fresh characteristic), and tapping `[+1]` raises Adv + Sum and updates the cost when a
   band boundary is crossed (advances 5→6 shows the cost change from 25 to 30).
2. Add a skill; its row shows `25 XP` under `+0`; tapping `[+]` raises the count and the
   cost label tracks the bands.

Check `preview_console_logs` for errors. Capture a `preview_screenshot` of the detail view.

- [ ] **Step 3: Final commit (only if Step 2 required a fix)**

```bash
git add -A
git commit -m "fix(wfrp): advance cost review fixes"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 `advanceCost` helper → Task 1. ✓
- §2 characteristics detail cost sub-row + `[−]`/`[+1]` → Task 2. ✓
- §3 skills cost label → Task 3. ✓
- §4 out of scope (no XP pool/spending) → only display + step; no `xp` field touched. ✓
- §5 tests (boundaries + negative clamp) → Task 1. ✓
- Acceptance criteria → Task 4. ✓

**Type consistency:** `advanceCost(currentAdvances: number): number` is called identically
in both components. No data shape changes; `setField(k,'advances',…)` (Task 2) and
`setAdvances` (Task 3) are the existing handlers. Styles renamed only where introduced.

**Placeholder scan:** none — every code step has complete code.
