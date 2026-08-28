# WFRP Max Wounds (Auto-Calculated) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-typed `wounds.max` with a value computed from characteristics (`SB + 2×TB + WPB + modifier`), persisting only `current` and `modifier`.

**Architecture:** A `woundsMax(char)` helper derives the max from `characteristicTotal`-based bonuses; `Resources.tsx` renders it read-only with an editable modifier. `migrateWfrp4eCharacter` (already applied on load) converts old `{current,max}` wounds to `{current,modifier:0}`, clamping current.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · TypeScript (strict) · jest-expo · `@/components/ui/EditableNumber` · `@/components/ui/Stepper`.

**Spec:** `docs/superpowers/specs/2026-06-22-wfrp-max-wounds-design.md`

---

## File Structure

- `src/types/wfrp4e.ts` — **modify**: `wounds` shape, `characteristicBonus` + `woundsMax` helpers, `schemaVer` 2→3, `migrateWfrp4eCharacter` wounds normalization, `defaultWfrp4eCharacter`.
- `src/types/__tests__/wfrp4e.test.ts` — **modify**: add bonus/woundsMax/migration tests.
- `src/components/wfrp4e/Resources.tsx` — **modify**: computed max + modifier field + breakdown.

`src/hooks/useCharacter.ts` needs **no change** — it already calls `migrateWfrp4eCharacter` for WFRP characters on load.

Verification note: pure logic is unit-tested; the `Resources.tsx` UI is verified with `tsc` + the web preview (Task 4). No RNTL tests (project has none).

---

## Task 1: wounds shape + `woundsMax` helper (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts`
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { characteristicBonus, woundsMax } from '../wfrp4e';

describe('characteristicBonus', () => {
  test('is the tens digit of the characteristic total', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 2 }; // total 37
    char.characteristics.t = { roll: 9, racial: 0, other: 0, advances: 0 };  // total 9
    expect(characteristicBonus(char, 's')).toBe(3);
    expect(characteristicBonus(char, 't')).toBe(0);
  });
});

describe('woundsMax', () => {
  test('SB + 2*TB + WPB + modifier', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    char.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    char.characteristics.wp = { roll: 28, racial: 0, other: 0, advances: 0 }; // WPB 2
    char.wounds = { current: 0, modifier: 1 };
    expect(woundsMax(char)).toBe(3 + 2 * 4 + 2 + 1); // 14
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — `characteristicBonus`/`woundsMax` are not exported; also `char.wounds = { current, modifier }` is a type error under the old `{current,max}` shape (jest/babel ignores types so it runs, but the functions are undefined → throws).

- [ ] **Step 3: Change the wounds shape and `schemaVer` in the type**

In `src/types/wfrp4e.ts`, change the type's `schemaVer: 2;` → `schemaVer: 3;`.

Change the wounds field from:
```ts
  wounds: { current: number; max: number };
```
to:
```ts
  wounds: { current: number; modifier: number };
```
(Leave `fate`, `fortune`, `resilience`, `resolve` as `{ current: number; max: number }`.)

- [ ] **Step 4: Add the helpers**

In `src/types/wfrp4e.ts`, add after `characteristicTotal`:

```ts
export function characteristicBonus(
  char: Wfrp4eCharacter,
  key: CharacteristicKey
): number {
  return Math.floor(characteristicTotal(char, key) / 10);
}

export function woundsMax(char: Wfrp4eCharacter): number {
  const sb = characteristicBonus(char, 's');
  const tb = characteristicBonus(char, 't');
  const wpb = characteristicBonus(char, 'wp');
  return sb + 2 * tb + wpb + char.wounds.modifier;
}
```

- [ ] **Step 5: Update `defaultWfrp4eCharacter`**

In `defaultWfrp4eCharacter`, change `schemaVer: 2,` → `schemaVer: 3,` and change
`wounds: { current: 10, max: 10 },` → `wounds: { current: 0, modifier: 0 },`.

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (the new bonus + woundsMax tests, plus the existing #35 tests).

Note: `npx tsc --noEmit` will still report an error in `Resources.tsx` (reads `wounds.max`) — that's the out-of-scope consumer fixed in Task 3. Do not edit it here.

- [ ] **Step 7: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): woundsMax helper + characteristicBonus"
```

---

## Task 2: migrate wounds in `migrateWfrp4eCharacter` (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts` (`migrateWfrp4eCharacter`)
- Test: `src/types/__tests__/wfrp4e.test.ts`

The current function body is:

```ts
export function migrateWfrp4eCharacter(raw: any): Wfrp4eCharacter {
  const characteristics = Object.fromEntries(
    CHARACTERISTIC_KEYS.map(k => {
      const c = raw?.characteristics?.[k] ?? {};
      if (typeof c.roll === 'number') {
        return [k, { roll: c.roll, racial: c.racial ?? 0, other: c.other ?? 0, advances: c.advances ?? 0 }];
      }
      return [k, { roll: c.base ?? 0, racial: 0, other: 0, advances: c.advances ?? 0 }];
    })
  ) as Wfrp4eCharacter['characteristics'];

  return { ...raw, characteristics, schemaVer: 2 } as Wfrp4eCharacter;
}
```

- [ ] **Step 1: Write the failing test**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
describe('migrateWfrp4eCharacter wounds', () => {
  test('old {current,max} -> {current,modifier:0}, current clamped, max recomputed', () => {
    const old: any = {
      system: 'wfrp4e',
      schemaVer: 2,
      characteristics: {
        ws: { roll: 0, racial: 0, other: 0, advances: 0 },
        bs: { roll: 0, racial: 0, other: 0, advances: 0 },
        s: { roll: 35, racial: 0, other: 0, advances: 0 },  // SB 3
        t: { roll: 42, racial: 0, other: 0, advances: 0 },  // TB 4
        i: { roll: 0, racial: 0, other: 0, advances: 0 },
        ag: { roll: 0, racial: 0, other: 0, advances: 0 },
        dex: { roll: 0, racial: 0, other: 0, advances: 0 },
        int: { roll: 0, racial: 0, other: 0, advances: 0 },
        wp: { roll: 28, racial: 0, other: 0, advances: 0 }, // WPB 2
        fel: { roll: 0, racial: 0, other: 0, advances: 0 },
      },
      wounds: { current: 12, max: 99 },
    };
    const migrated = migrateWfrp4eCharacter(old);
    expect(migrated.wounds).toEqual({ current: 12, modifier: 0 });
    expect(woundsMax(migrated)).toBe(13); // 3 + 2*4 + 2 + 0, old max 99 discarded
    expect(migrated.schemaVer).toBe(3);
  });

  test('clamps current down to the recomputed max', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 2,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 25, max: 25 },
    };
    const migrated = migrateWfrp4eCharacter(old); // all stats 0 -> max 0
    expect(woundsMax(migrated)).toBe(0);
    expect(migrated.wounds.current).toBe(0);
  });

  test('idempotent on an already-migrated character', () => {
    const current = defaultWfrp4eCharacter('Test');
    current.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 }; // TB 3 -> max 6
    current.wounds = { current: 4, modifier: 0 };
    const migrated = migrateWfrp4eCharacter(current);
    expect(migrated.wounds).toEqual({ current: 4, modifier: 0 });
    expect(migrated.schemaVer).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — migration still returns old wounds untouched with `schemaVer: 2`.

- [ ] **Step 3: Extend the migration**

Replace the `return` line of `migrateWfrp4eCharacter` with wounds normalization:

```ts
  const bonus = (k: CharacteristicKey) => {
    const c = characteristics[k];
    return Math.floor((c.roll + c.racial + c.other + c.advances) / 10);
  };
  const modifier = typeof raw?.wounds?.modifier === 'number' ? raw.wounds.modifier : 0;
  const computedMax = bonus('s') + 2 * bonus('t') + bonus('wp') + modifier;
  const current = Math.max(0, Math.min(raw?.wounds?.current ?? 0, computedMax));
  const wounds = { current, modifier };

  return { ...raw, characteristics, wounds, schemaVer: 3 } as Wfrp4eCharacter;
```

(Delete the old `return { ...raw, characteristics, schemaVer: 2 } as Wfrp4eCharacter;` line.)

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (all wfrp4e tests, including #35's, still green).

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): migrate wounds to {current,modifier} shape"
```

---

## Task 3: Resources UI — computed max + modifier

**Files:**
- Modify: `src/components/wfrp4e/Resources.tsx`

- [ ] **Step 1: Import `woundsMax` + bonuses and rewrite the wounds rows**

In `src/components/wfrp4e/Resources.tsx`, change the type import line:

```ts
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
```
to:
```ts
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { woundsMax, characteristicBonus } from '@/types/wfrp4e';
```

Inside the component, after `const t = useTheme();`, add:

```ts
  const max = woundsMax(character);
  const sb = characteristicBonus(character, 's');
  const tb = characteristicBonus(character, 't');
  const wpb = characteristicBonus(character, 'wp');

  function setModifier(m: number) {
    const nextMax = sb + 2 * tb + wpb + m;
    onChange({
      wounds: {
        modifier: m,
        current: Math.max(0, Math.min(character.wounds.current, nextMax)),
      },
    });
  }
```

Change the Stepper's `max` prop from `max={character.wounds.max}` to `max={max}`.

Replace the existing "Max wounds" row (the `<View style={styles.maxRow}>…</View>` block that
renders the `Max wounds` label and an `EditableNumber` editing `wounds.max`) with:

```tsx
      <View style={styles.maxRow}>
        <View>
          <Text style={[styles.maxLabel, { color: t.colors.textMuted }]}>Max wounds</Text>
          <Text style={[styles.breakdown, { color: t.colors.textMuted }]}>
            SB {sb} + 2×TB {tb} + WPB {wpb} + mod {character.wounds.modifier}
          </Text>
        </View>
        <View style={styles.maxRight}>
          <View style={styles.maxValueBox}>
            <Text style={[styles.maxValue, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{max}</Text>
            <Text style={[styles.maxValueLabel, { color: t.colors.textMuted }]}>Max</Text>
          </View>
          <EditableNumber
            value={character.wounds.modifier}
            label="Mod"
            size="sm"
            onSave={setModifier}
          />
        </View>
      </View>
```

- [ ] **Step 2: Update styles**

In the `StyleSheet.create` block, replace the `maxRow` style and add the new ones:

```ts
  maxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  maxLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdown: { fontSize: 11, marginTop: 2 },
  maxRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  maxValueBox: { alignItems: 'center' },
  maxValue: { fontSize: 22, fontWeight: '700' },
  maxValueLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
```

(Keep all the existing `pairGrid`/`pairBox`/etc. styles unchanged.)

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit`
Expected: CLEAN (zero errors — the `wounds.max` reference is gone).

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/Resources.tsx
git commit -m "feat(wfrp): auto-calculated max wounds with modifier"
```

---

## Task 4: Verify against acceptance criteria

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all jest tests pass.

- [ ] **Step 2: Web preview smoke test**

Start the web preview (config `ttrp-web`). Open or create a WFRP character.

Confirm against the spec's acceptance criteria:
1. Max wounds shows `SB + 2×TB + WPB + mod` (0 for a blank character), not a stored value.
2. Setting S/T/WP in the characteristics detail (use Generate rolls) raises Max live.
3. Editing the Modifier changes Max and persists across reload; current clamps down if Max drops below it.
4. The Wounds stepper will not raise current above the computed Max.

Use `preview_console_logs` to confirm no errors. Capture a `preview_screenshot` of the Resources section.

- [ ] **Step 3: Final commit (only if Step 2 required a fix)**

```bash
git add -A
git commit -m "fix(wfrp): max wounds review fixes"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 wounds shape, `characteristicBonus`/`woundsMax`, schemaVer 3, migration reset-to-0 + clamp, default → Tasks 1, 2. ✓
- §2 Resources computed max + read-only display + modifier + breakdown → Task 3. ✓
- §3 tests (bonus, woundsMax, migration incl. clamp + idempotent) → Tasks 1, 2. ✓
- §4 out of scope (size variants, Hardy auto, auto-raise current) → not implemented; modifier-only. ✓
- Acceptance criteria → Task 4. ✓

**Type consistency:** `wounds` is `{ current, modifier }` everywhere; `woundsMax`/`characteristicBonus` signatures match between definition (Task 1), migration (inline bonus, Task 2), and `Resources.tsx` (Task 3). `schemaVer` literal is `3` in the type, default, and migration. Only `wounds` changes shape; `fate`/`fortune`/`resilience`/`resolve` stay `{current,max}` and `Resources.tsx` still reads `character[key].max` for those (unchanged).

**Placeholder scan:** none — every code step has complete code.
