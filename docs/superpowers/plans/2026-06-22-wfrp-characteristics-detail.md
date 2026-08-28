# WFRP Characteristics Detail View + Breakdown Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace each WFRP characteristic's `{ base, advances }` with a four-part breakdown `{ roll, racial, other, advances }`, surface it in a dedicated detail modal, and migrate existing characters in place.

**Architecture:** The data shape and the `characteristicTotal` helper live in `src/types/wfrp4e.ts`; a pure `migrateWfrp4eCharacter` upgrades old saves and is applied on load in `useCharacter`. The main `Characteristics` grid shows totals only and opens a new full-screen `CharacteristicsDetail` modal where each part is edited via the existing `EditableNumber` primitive, plus a "Generate rolls" action that writes 2d10 into every Roll.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · TypeScript (strict) · jest-expo · `@/dice/engine` `roll()` · `@/components/ui/EditableNumber` · `react-native-safe-area-context`.

**Spec:** `docs/superpowers/specs/2026-06-21-wfrp-characteristics-detail-design.md`

---

## File Structure

- `src/types/wfrp4e.ts` — **modify**: characteristic shape, `schemaVer` literal `1`→`2`, `characteristicTotal`, `defaultWfrp4eCharacter`, new `migrateWfrp4eCharacter`.
- `src/types/__tests__/wfrp4e.test.ts` — **create**: jest tests for `characteristicTotal` + `migrateWfrp4eCharacter`.
- `src/hooks/useCharacter.ts` — **modify**: run migration on load for `system === 'wfrp4e'`.
- `src/components/wfrp4e/CharacteristicsDetail.tsx` — **create**: full-screen breakdown modal + Generate rolls.
- `src/components/wfrp4e/Characteristics.tsx` — **modify**: total-only grid, remove old inline edit modal, add Details button that opens `CharacteristicsDetail`.

Verification note: this project unit-tests **pure logic only** (see `src/dice/__tests__`). There is no React Native Testing Library setup, so UI tasks (Tasks 4–5) are verified with `npx tsc --noEmit` and the web preview, not component unit tests. Do not add RNTL tests.

---

## Task 1: New characteristic shape + `characteristicTotal` (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts:18` (shape), `:5` (`schemaVer`), `:124-130` (`characteristicTotal`), `:132-175` (`defaultWfrp4eCharacter`)
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { characteristicTotal, defaultWfrp4eCharacter } from '../wfrp4e';
import type { Wfrp4eCharacter } from '../wfrp4e';

describe('characteristicTotal', () => {
  test('sums roll + racial + other + advances', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.ws = { roll: 11, racial: 20, other: 1, advances: 5 };
    expect(characteristicTotal(char, 'ws')).toBe(37);
  });

  test('defaultWfrp4eCharacter starts every characteristic at zero', () => {
    const char = defaultWfrp4eCharacter('Test');
    for (const k of Object.keys(char.characteristics) as Array<keyof Wfrp4eCharacter['characteristics']>) {
      expect(char.characteristics[k]).toEqual({ roll: 0, racial: 0, other: 0, advances: 0 });
      expect(characteristicTotal(char, k)).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — current `characteristicTotal` destructures `{ base, advances }`, so `base` is `undefined` and the sum is `NaN`; `defaultWfrp4eCharacter` produces `{ base: 30, advances: 0 }`.

- [ ] **Step 3: Change the characteristic shape and `schemaVer`**

In `src/types/wfrp4e.ts`, change the `schemaVer` field (line 5) from:

```ts
  schemaVer: 1;
```
to:
```ts
  schemaVer: 2;
```

Change the characteristics field (line 18) from:

```ts
  characteristics: Record<CharacteristicKey, { base: number; advances: number }>;
```
to:
```ts
  characteristics: Record<CharacteristicKey, {
    roll: number;
    racial: number;
    other: number;
    advances: number;
  }>;
```

- [ ] **Step 4: Update `characteristicTotal`**

Replace the body (lines 124-130):

```ts
export function characteristicTotal(
  char: Wfrp4eCharacter,
  key: CharacteristicKey
): number {
  const { base, advances } = char.characteristics[key];
  return base + advances;
}
```
with:
```ts
export function characteristicTotal(
  char: Wfrp4eCharacter,
  key: CharacteristicKey
): number {
  const { roll, racial, other, advances } = char.characteristics[key];
  return roll + racial + other + advances;
}
```

- [ ] **Step 5: Update `defaultWfrp4eCharacter`**

In `defaultWfrp4eCharacter`, change the characteristics seed (lines 133-138) from:

```ts
  const characteristics = Object.fromEntries(
    (['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as CharacteristicKey[]).map(k => [
      k,
      { base: 30, advances: 0 },
    ])
  ) as Wfrp4eCharacter['characteristics'];
```
to:
```ts
  const characteristics = Object.fromEntries(
    (['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as CharacteristicKey[]).map(k => [
      k,
      { roll: 0, racial: 0, other: 0, advances: 0 },
    ])
  ) as Wfrp4eCharacter['characteristics'];
```

Then change the returned object's `schemaVer` (line 143) from `schemaVer: 1,` to `schemaVer: 2,`.

> Note: new characters now start all-zero (per spec §"Confirmed decisions"). The Generate-rolls button (Task 4) and future race select (#38) populate them.

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): four-part characteristic breakdown model"
```

---

## Task 2: `migrateWfrp4eCharacter` (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts` (add exported function)
- Test: `src/types/__tests__/wfrp4e.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { migrateWfrp4eCharacter } from '../wfrp4e';

describe('migrateWfrp4eCharacter', () => {
  test('maps old base -> roll, zeros racial/other, keeps advances, preserves total', () => {
    const old: any = {
      system: 'wfrp4e',
      schemaVer: 1,
      characteristics: {
        ws: { base: 31, advances: 5 },
        bs: { base: 40, advances: 0 },
        s: { base: 30, advances: 0 }, t: { base: 30, advances: 0 },
        i: { base: 30, advances: 0 }, ag: { base: 30, advances: 0 },
        dex: { base: 30, advances: 0 }, int: { base: 30, advances: 0 },
        wp: { base: 30, advances: 0 }, fel: { base: 30, advances: 0 },
      },
    };
    const migrated = migrateWfrp4eCharacter(old);
    expect(migrated.characteristics.ws).toEqual({ roll: 31, racial: 0, other: 0, advances: 5 });
    expect(characteristicTotal(migrated, 'ws')).toBe(36); // same as old 31 + 5
    expect(migrated.schemaVer).toBe(2);
  });

  test('is idempotent on an already-migrated character', () => {
    const current = defaultWfrp4eCharacter('Test');
    current.characteristics.ws = { roll: 11, racial: 20, other: 0, advances: 3 };
    const migrated = migrateWfrp4eCharacter(current);
    expect(migrated.characteristics.ws).toEqual({ roll: 11, racial: 20, other: 0, advances: 3 });
    expect(migrated.schemaVer).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — `migrateWfrp4eCharacter` is not exported (`is not a function`).

- [ ] **Step 3: Implement `migrateWfrp4eCharacter`**

Add to `src/types/wfrp4e.ts` (after `characteristicTotal`, before `defaultWfrp4eCharacter`):

```ts
const CHARACTERISTIC_KEYS: CharacteristicKey[] = [
  'ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel',
];

/**
 * Normalizes a stored WFRP character to the four-part characteristic shape.
 * Old shape `{ base, advances }` becomes `{ roll: base, racial: 0, other: 0, advances }`
 * (total preserved). Already-migrated characters pass through unchanged. Idempotent.
 */
export function migrateWfrp4eCharacter(raw: any): Wfrp4eCharacter {
  const characteristics = Object.fromEntries(
    CHARACTERISTIC_KEYS.map(k => {
      const c = raw?.characteristics?.[k] ?? {};
      if (typeof c.roll === 'number') {
        // already new shape
        return [k, {
          roll: c.roll,
          racial: c.racial ?? 0,
          other: c.other ?? 0,
          advances: c.advances ?? 0,
        }];
      }
      // old shape: base -> roll
      return [k, {
        roll: c.base ?? 0,
        racial: 0,
        other: 0,
        advances: c.advances ?? 0,
      }];
    })
  ) as Wfrp4eCharacter['characteristics'];

  return { ...raw, characteristics, schemaVer: 2 } as Wfrp4eCharacter;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): migrateWfrp4eCharacter base->roll upgrade"
```

---

## Task 3: Apply migration on load in `useCharacter`

**Files:**
- Modify: `src/hooks/useCharacter.ts:1-32`

- [ ] **Step 1: Import the migration**

In `src/hooks/useCharacter.ts`, change the WFRP type import (line 6) from:

```ts
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
```
to:
```ts
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { migrateWfrp4eCharacter } from '@/types/wfrp4e';
```

- [ ] **Step 2: Run migration when parsing the row**

Replace the load block (lines 23-30):

```ts
    getCharacter(db, id).then(r => {
      if (cancelled) return;
      setRow(r);
      const parsed = r ? (JSON.parse(r.data) as EditableCharacter) : null;
      setData(parsed);
      latestData.current = parsed;
      setLoading(false);
    });
```
with:
```ts
    getCharacter(db, id).then(r => {
      if (cancelled) return;
      setRow(r);
      let parsed = r ? (JSON.parse(r.data) as EditableCharacter) : null;
      if (parsed && parsed.system === 'wfrp4e') {
        parsed = migrateWfrp4eCharacter(parsed);
      }
      setData(parsed);
      latestData.current = parsed;
      setLoading(false);
    });
```

> The migrated object persists on the next `patch` save (debounced) or on `flush`. Import and duplicate paths funnel through this same load, so they are covered.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCharacter.ts
git commit -m "feat(wfrp): migrate characteristics on character load"
```

---

## Task 4: `CharacteristicsDetail` full-screen modal

**Files:**
- Create: `src/components/wfrp4e/CharacteristicsDetail.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/wfrp4e/CharacteristicsDetail.tsx`:

```tsx
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { roll } from '@/dice/engine';
import {
  CHARACTERISTIC_ABBREV, CHARACTERISTIC_LABELS, characteristicTotal,
} from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
type Field = 'roll' | 'racial' | 'other' | 'advances';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

export function CharacteristicsDetail({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();

  function setField(key: CharacteristicKey, field: Field, value: number) {
    onChange({
      characteristics: {
        ...character.characteristics,
        [key]: { ...character.characteristics[key], [field]: value },
      },
    });
  }

  function generateRolls() {
    Alert.alert(
      'Generate rolls?',
      'This overwrites the Roll value for all 10 characteristics with a fresh 2d10.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'destructive',
          onPress: () => {
            const next = { ...character.characteristics };
            for (const k of KEYS) {
              next[k] = { ...next[k], roll: roll('2d10').total };
            }
            onChange({ characteristics: next });
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>Characteristics</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, { borderColor: t.colors.accent }]}
          onPress={generateRolls}
          activeOpacity={0.7}
        >
          <Text style={[styles.generateText, { color: t.colors.accent }]}>Generate rolls (2d10)</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.list}>
          {KEYS.map(k => {
            const c = character.characteristics[k];
            const sum = characteristicTotal(character, k);
            return (
              <View key={k} style={[styles.row, { borderBottomColor: t.colors.border }]}>
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
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700' },
  generateBtn: {
    marginHorizontal: 16, marginTop: 12, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, alignItems: 'center',
  },
  generateText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  rowAbbrev: { width: 36, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  fields: { flex: 1, flexDirection: 'row', gap: 4 },
  field: { flex: 1 },
  sumBox: { width: 40, alignItems: 'center' },
  sum: { fontSize: 22, fontWeight: '700' },
});
```

> `EditableNumber` already renders a tappable box (value + label) that opens its own number-pad modal and calls `onSave` — reusing it gives consistent editing across the sheet. `roll('2d10').total` returns 2–20 (see `src/dice/engine.ts`). Lucide's `X` icon is the same family used elsewhere in the sheet.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The component is not yet mounted; Task 5 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/components/wfrp4e/CharacteristicsDetail.tsx
git commit -m "feat(wfrp): characteristics detail modal + generate rolls"
```

---

## Task 5: Main grid — total-only + Details button

**Files:**
- Modify: `src/components/wfrp4e/Characteristics.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/wfrp4e/Characteristics.tsx` with:

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Section } from '@/components/ui/Section';
import { CharacteristicsDetail } from '@/components/wfrp4e/CharacteristicsDetail';
import {
  CHARACTERISTIC_ABBREV, CHARACTERISTIC_LABELS, characteristicTotal,
} from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onRoll: (target: number, label: string) => void;
};

export function Characteristics({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <Section title="Characteristics">
      <View style={styles.grid}>
        {KEYS.map(k => {
          const total = characteristicTotal(character, k);
          return (
            <View key={k} style={[styles.cell, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
              <Text style={[styles.abbrev, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[k]}</Text>
              <TouchableOpacity onPress={() => onRoll(total, CHARACTERISTIC_LABELS[k])} activeOpacity={0.6}>
                <Text style={[styles.total, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{total}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.detailsBtn, { borderColor: t.colors.border }]}
        onPress={() => setDetailOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.detailsText, { color: t.colors.textMuted }]}>Details</Text>
      </TouchableOpacity>

      <CharacteristicsDetail
        visible={detailOpen}
        character={character}
        onChange={onChange}
        onClose={() => setDetailOpen(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '18.5%', borderRadius: 8, borderWidth: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  abbrev: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  total: { fontSize: 24, fontWeight: '700' },
  detailsBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  detailsText: { fontSize: 14, fontWeight: '600' },
});
```

> Removed: the inline base/advances `Modal` and its `editKey`/`baseDraft`/`advDraft` state and `openEdit`/`save` handlers (all editing now lives in the detail modal), and the per-cell `+adv` line (cells show the total only). Tap-to-roll on the total is unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full jest suite**

Run: `npm test`
Expected: PASS — the 8 dice tests plus the 4 new `wfrp4e` type tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/Characteristics.tsx
git commit -m "feat(wfrp): total-only grid with Details button"
```

---

## Task 6: Verify against acceptance criteria

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all jest tests pass (dice + wfrp4e types).

- [ ] **Step 2: Web preview smoke test**

Start the web preview (`preview_start` if not running). Open an existing WFRP character.

Confirm against the spec's acceptance criteria:
1. The characteristics grid shows the same totals as before the change (migration preserved them) and a **Details** button is present.
2. Tapping a total still opens the roll flow.
3. Tapping **Details** opens the full-screen breakdown; editing Roll / Racial / Other / Adv updates that row's Sum and the main grid; the change persists across a page reload.
4. **Generate rolls** asks for confirmation, then fills every Roll with a 2d10 (2–20) value.

Check `preview_console_logs` for errors after each interaction. Capture a `preview_screenshot` of the detail view to share as proof.

- [ ] **Step 3: Final commit (only if Step 2 required a fix)**

```bash
git add -A
git commit -m "fix(wfrp): characteristics detail review fixes"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 data model + migration → Tasks 1, 2; migration-on-load → Task 3. ✓
- §2 main grid total-only + Details button, remove old inline modal → Task 5. ✓
- §3 detail modal (transposed rows, editable Roll/Racial/Other/Adv, live Sum) + Generate rolls (2d10, confirm) → Task 4. ✓
- §4 affected files → all covered (`wfrp4e.ts`, `Characteristics.tsx`, `CharacteristicsDetail.tsx`, `useCharacter.ts`, tests). ✓
- §5 testing (`characteristicTotal`, `migrateWfrp4eCharacter`, idempotent, schemaVer 2) → Tasks 1, 2. ✓
- §6 out of scope (#36/#37/#38) → Adv is a plain editable number here; no XP cost, no max-wounds, no race auto-fill. ✓
- Acceptance criteria → Task 6. ✓

**Type consistency:** characteristic field names (`roll`/`racial`/`other`/`advances`) are identical across the type, migration, detail modal, and tests. `characteristicTotal` signature is unchanged, so `WfrpSkills`/`Resources` consumers need no edits (verified: only `wfrp4e.ts` and `Characteristics.tsx` read `.base`). `schemaVer` literal is `2` in the type, `defaultWfrp4eCharacter`, and `migrateWfrp4eCharacter`.

**Placeholder scan:** none — every code step contains complete code.
