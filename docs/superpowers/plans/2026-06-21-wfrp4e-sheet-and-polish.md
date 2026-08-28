# WFRP 4e Sheet + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the WFRP 4e character sheet to edit/view parity with the D&D 5e sheet (incl. d100 roll-under dice with Success Levels and a difficulty picker), plus a polish pass (export/import JSON, settings tab, error/empty states). No paywall — free for demo.

**Architecture:** `app/character/[id].tsx` becomes a thin loader that switches on `data.system` and renders `<Dnd5eSheet>` (extracted from today's inline body) or `<Wfrp4eSheet>` (new). Each sheet owns its own roll hook + modal. WFRP dice are a separate pure module (`evaluateWfrpTest`) with their own result type and modal. Polish reuses existing primitives and the `settings` table.

**Tech Stack:** React Native 0.85, Expo 56, expo-router, expo-sqlite, expo-haptics, expo-sharing, expo-document-picker, expo-file-system (added), TypeScript strict, jest-expo (added).

**Spec:** `docs/superpowers/specs/2026-06-21-wfrp4e-sheet-and-polish-design.md`
**Branch:** `feat/wfrp4e-sheet` (already created)

**Reference patterns to copy (read before starting):**
- UI primitives: `src/components/ui/{Section,StatBox,EditableNumber,Stepper,TextEditModal,RollModal}.tsx`
- List-with-add/remove archetype: `src/components/dnd5e/Inventory.tsx`
- Sheet wiring + back-bar: `src/components/dnd5e/*` + current `app/character/[id].tsx`
- Edit/persist hook (system-agnostic, no change needed): `src/hooks/useCharacter.ts`
- WFRP types + helpers: `src/types/wfrp4e.ts` (`Wfrp4eCharacter`, `CharacteristicKey`, `CHARACTERISTIC_ABBREV`, `CHARACTERISTIC_LABELS`, `characteristicTotal`, `defaultWfrp4eCharacter`)

**Theme API (every component uses this):** `const t = useTheme();` then `t.colors.{background,backgroundSecondary,text,textSecondary,textMuted,accent,accentText,gold,border,card,danger,success}` and `t.fontFamily.serif`. Edits persist by calling `onChange(partial)` where `onChange = patch` from `useCharacter`.

---

## Part A — WFRP 4e sheet

### Task 1: Add a test runner (jest-expo)

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`

- [ ] **Step 1: Install jest-expo and jest**

Run: `npx expo install jest-expo` then `npm i -D jest @types/jest`
Expected: deps added under devDependencies, no peer-dep errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "jest"
```

- [ ] **Step 3: Create `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
};
```

- [ ] **Step 4: Verify jest runs (no tests yet)**

Run: `npm test -- --passWithNoTests`
Expected: "No tests found, exiting with code 0" (passWithNoTests) — runner boots cleanly.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js
git commit -m "test: add jest-expo runner"
```

---

### Task 2: WFRP dice — types + pure evaluator (TDD)

WFRP test: roll d100 (1–100), success if `roll <= baseTarget + difficulty`. `SL = floor(effectiveTarget/10) − floor(roll/10)`. Doubles (11,22,…,99 and 100) → crit on success, fumble on failure.

**Files:**
- Modify: `src/dice/types.ts`
- Create: `src/dice/wfrp.ts`
- Test: `src/dice/__tests__/wfrp.test.ts`

- [ ] **Step 1: Add WFRP types to `src/dice/types.ts`** (append; leave existing exports intact)

```ts
export type WfrpDifficulty = { label: string; mod: number };

export const WFRP_DIFFICULTIES: WfrpDifficulty[] = [
  { label: 'Very Easy', mod: 60 },
  { label: 'Easy', mod: 40 },
  { label: 'Average', mod: 20 },
  { label: 'Challenging', mod: 0 },
  { label: 'Difficult', mod: -10 },
  { label: 'Hard', mod: -20 },
  { label: 'Very Hard', mod: -30 },
];

export type WfrpRollResult = {
  kind: 'wfrp';
  label: string;
  roll: number;            // 1-100
  baseTarget: number;      // characteristic/skill total before difficulty
  difficulty: number;      // applied modifier (e.g. -20)
  effectiveTarget: number; // baseTarget + difficulty
  sl: number;              // success levels (negative on failure)
  success: boolean;
  isCrit: boolean;
  isFumble: boolean;
  timestamp: number;
};
```

- [ ] **Step 2: Write the failing test** — `src/dice/__tests__/wfrp.test.ts`

```ts
import { evaluateWfrpTest } from '../wfrp';

describe('evaluateWfrpTest', () => {
  test('success when roll <= target', () => {
    const r = evaluateWfrpTest(34, 45);
    expect(r.success).toBe(true);
    expect(r.effectiveTarget).toBe(45);
  });

  test('failure when roll > target', () => {
    const r = evaluateWfrpTest(67, 45);
    expect(r.success).toBe(false);
  });

  test('SL = tens(target) - tens(roll)', () => {
    expect(evaluateWfrpTest(23, 45).sl).toBe(2);   // 4 - 2
    expect(evaluateWfrpTest(67, 45).sl).toBe(-2);  // 4 - 6
  });

  test('difficulty shifts the target before comparison', () => {
    const easy = evaluateWfrpTest(60, 45, 20);     // effective 65 -> success
    expect(easy.success).toBe(true);
    expect(easy.effectiveTarget).toBe(65);
    const hard = evaluateWfrpTest(60, 45, -20);    // effective 25 -> fail
    expect(hard.success).toBe(false);
  });

  test('double on success is a crit', () => {
    const r = evaluateWfrpTest(33, 45);
    expect(r.isCrit).toBe(true);
    expect(r.isFumble).toBe(false);
  });

  test('double on failure is a fumble', () => {
    const r = evaluateWfrpTest(88, 45);
    expect(r.isFumble).toBe(true);
    expect(r.isCrit).toBe(false);
  });

  test('100 counts as a double (fumble unless target >= 100)', () => {
    expect(evaluateWfrpTest(100, 45).isFumble).toBe(true);
  });

  test('non-double roll is neither crit nor fumble', () => {
    const r = evaluateWfrpTest(34, 45);
    expect(r.isCrit).toBe(false);
    expect(r.isFumble).toBe(false);
  });
});
```

- [ ] **Step 3: Run it — verify it fails**

Run: `npm test -- src/dice/__tests__/wfrp.test.ts`
Expected: FAIL — "Cannot find module '../wfrp'".

- [ ] **Step 4: Implement `src/dice/wfrp.ts`**

```ts
import type { WfrpRollResult } from './types';

function isDouble(roll: number): boolean {
  return roll === 100 || (roll % 11 === 0 && roll >= 11 && roll <= 99);
}

// Pure evaluator — deterministic given the roll. Tested directly.
export function evaluateWfrpTest(
  roll: number,
  baseTarget: number,
  difficulty = 0,
  label = 'Test',
): WfrpRollResult {
  const effectiveTarget = baseTarget + difficulty;
  const success = roll <= effectiveTarget;
  const sl = Math.floor(effectiveTarget / 10) - Math.floor(roll / 10);
  const dbl = isDouble(roll);
  return {
    kind: 'wfrp',
    label,
    roll,
    baseTarget,
    difficulty,
    effectiveTarget,
    sl,
    success,
    isCrit: success && dbl,
    isFumble: !success && dbl,
    timestamp: Date.now(),
  };
}

// Rolls a real d100 (1-100) and evaluates.
export function rollWfrpTest(
  baseTarget: number,
  opts: { difficulty?: number; label?: string } = {},
): WfrpRollResult {
  const roll = Math.floor(Math.random() * 100) + 1;
  return evaluateWfrpTest(roll, baseTarget, opts.difficulty ?? 0, opts.label ?? 'Test');
}
```

- [ ] **Step 5: Run tests — verify pass**

Run: `npm test -- src/dice/__tests__/wfrp.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/dice/types.ts src/dice/wfrp.ts src/dice/__tests__/wfrp.test.ts
git commit -m "feat(dice): WFRP d100 roll-under test with success levels"
```

---

### Task 3: Shared haptics module (DRY) + refactor useRoll

`useRoll` has private `haptic`/`hapticHeavy`. Extract them so `useWfrpRoll` reuses them and the haptics toggle (Part B) can disable both in one place.

**Files:**
- Create: `src/lib/haptics.ts`
- Modify: `src/hooks/useRoll.ts:6-21,30`

- [ ] **Step 1: Create `src/lib/haptics.ts`**

```ts
import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  Haptics = require('expo-haptics');
}

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export async function haptic() {
  if (!enabled) return;
  try {
    await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export async function hapticHeavy() {
  if (!enabled) return;
  try {
    await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}
```

- [ ] **Step 2: Refactor `src/hooks/useRoll.ts`** — replace lines 1–21 (the imports + local `Haptics`/`haptic`/`hapticHeavy`) with:

```ts
import { useState, useCallback, useRef } from 'react';
import type { RollResult, AdvantageMode } from '@/dice/types';
import { roll, rollD20, rollPlain } from '@/dice/engine';
import { haptic, hapticHeavy } from '@/lib/haptics';
```

Leave the rest of the file unchanged (`doRoll` still calls `haptic()`/`hapticHeavy()`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/haptics.ts src/hooks/useRoll.ts
git commit -m "refactor: extract shared haptics module"
```

---

### Task 4: `useWfrpRoll` hook

Holds the current WFRP result + the last test (target/label/difficulty) so the modal can re-roll and change difficulty.

**Files:**
- Create: `src/hooks/useWfrpRoll.ts`

- [ ] **Step 1: Create `src/hooks/useWfrpRoll.ts`**

```ts
import { useState, useCallback, useRef } from 'react';
import { rollWfrpTest } from '@/dice/wfrp';
import { haptic, hapticHeavy } from '@/lib/haptics';
import type { WfrpRollResult } from '@/dice/types';

export function useWfrpRoll() {
  const [result, setResult] = useState<WfrpRollResult | null>(null);
  const last = useRef<{ target: number; label: string; difficulty: number }>({
    target: 0,
    label: 'Test',
    difficulty: 0,
  });

  const run = useCallback((target: number, label: string, difficulty: number) => {
    last.current = { target, label, difficulty };
    const r = rollWfrpTest(target, { difficulty, label });
    if (r.isCrit || r.isFumble) hapticHeavy(); else haptic();
    setResult(r);
  }, []);

  // Tap a stat/skill — first roll at Challenging (0).
  const rollTest = useCallback((target: number, label: string) => {
    run(target, label, 0);
  }, [run]);

  // Difficulty buttons in the modal re-roll the same target.
  const setDifficulty = useCallback((difficulty: number) => {
    run(last.current.target, last.current.label, difficulty);
  }, [run]);

  const reroll = useCallback(() => {
    run(last.current.target, last.current.label, last.current.difficulty);
  }, [run]);

  const dismiss = useCallback(() => setResult(null), []);

  return { result, rollTest, setDifficulty, reroll, dismiss };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWfrpRoll.ts
git commit -m "feat: useWfrpRoll hook"
```

---

### Task 5: `WfrpRollModal`

Mirrors `RollModal`'s overlay/animation style but shows roll vs target, SL, a success/crit/fumble label, and a difficulty selector row that re-rolls.

**Files:**
- Create: `src/components/ui/WfrpRollModal.tsx`

- [ ] **Step 1: Create `src/components/ui/WfrpRollModal.tsx`**

```tsx
import { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { WFRP_DIFFICULTIES } from '@/dice/types';
import type { WfrpRollResult } from '@/dice/types';

type Props = {
  result: WfrpRollResult | null;
  onClose: () => void;
  onReroll: () => void;
  onDifficulty: (mod: number) => void;
};

export function WfrpRollModal({ result, onClose, onReroll, onDifficulty }: Props) {
  const t = useTheme();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const bounce = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * bounce.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (result) {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
      bounce.value = withSequence(
        withTiming(1.12, { duration: 100 }),
        withSpring(1, { damping: 12, stiffness: 300 }),
      );
    } else {
      scale.value = withTiming(0.5, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [result]);

  if (!result) return null;

  const crit = result.isCrit;
  const fumble = result.isFumble;
  const headColor = crit ? '#22c55e' : fumble ? t.colors.danger
    : result.success ? t.colors.success : t.colors.danger;
  const headLabel = crit ? 'CRITICAL!' : fumble ? 'FUMBLE!'
    : result.success ? 'SUCCESS' : 'FAILURE';
  const slStr = result.sl >= 0 ? `+${result.sl}` : `${result.sl}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.card, { backgroundColor: t.colors.card, borderColor: headColor }, animStyle]}
        >
          <TouchableOpacity activeOpacity={1}>
            <Text style={[styles.label, { color: t.colors.textMuted }]} numberOfLines={1}>
              {result.label}
            </Text>
            <Text style={[styles.head, { color: headColor }]}>{headLabel}</Text>

            <Text style={[styles.roll, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {result.roll}
            </Text>
            <Text style={[styles.vs, { color: t.colors.textMuted }]}>
              vs {result.effectiveTarget}
              {result.difficulty !== 0
                ? ` (${result.baseTarget}${result.difficulty > 0 ? '+' : ''}${result.difficulty})`
                : ''}
            </Text>

            <View style={[styles.slBadge, { borderColor: headColor, backgroundColor: headColor + '18' }]}>
              <Text style={[styles.slText, { color: headColor }]}>{slStr} SL</Text>
            </View>

            {/* Difficulty selector */}
            <View style={styles.diffRow}>
              {WFRP_DIFFICULTIES.map(d => {
                const active = d.mod === result.difficulty;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.diffChip, {
                      borderColor: active ? t.colors.accent : t.colors.border,
                      backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
                    }]}
                    onPress={() => onDifficulty(d.mod)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.diffText, { color: active ? t.colors.accent : t.colors.textMuted }]}>
                      {d.mod > 0 ? `+${d.mod}` : d.mod}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onReroll}>
                <Text style={[styles.btnText, { color: t.colors.accent }]}>Roll Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnClose, { backgroundColor: t.colors.accent }]} onPress={onClose}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  head: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  roll: { fontSize: 72, fontWeight: '700', lineHeight: 80 },
  vs: { fontSize: 14 },
  slBadge: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  slText: { fontSize: 18, fontWeight: '700' },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 },
  diffChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 40, alignItems: 'center' },
  diffText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnClose: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/WfrpRollModal.tsx
git commit -m "feat: WfrpRollModal with SL + difficulty selector"
```

---

### Task 6: Sheet routing refactor (extract Dnd5eSheet, add Wfrp4eSheet shell, ErrorState)

Fixes the data trap. After this task a WFRP character opens and renders its header (sections land in Tasks 7–16). D&D behavior is unchanged — its body just moves into a component.

**Files:**
- Create: `src/components/dnd5e/Dnd5eSheet.tsx`
- Create: `src/components/wfrp4e/Wfrp4eSheet.tsx`
- Create: `src/components/ui/ErrorState.tsx`
- Rewrite: `app/character/[id].tsx`

- [ ] **Step 1: Create `src/components/ui/ErrorState.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = { title: string; body?: string; onBack?: () => void };

export function ErrorState({ title, body, onBack }: Props) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <AlertTriangle size={44} color={t.colors.textMuted} />
      <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: t.colors.textMuted }]}>{body}</Text> : null}
      {onBack && (
        <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={onBack}>
          <Text style={[styles.btnText, { color: t.colors.accentText }]}>Go back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Create `src/components/dnd5e/Dnd5eSheet.tsx`** — move the D&D body + roll wiring out of `[id].tsx`. (This is the exact JSX currently in `[id].tsx` lines 62–83, with the roll hook + modal owned here.)

```tsx
import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRoll } from '@/hooks/useRoll';
import { RollModal } from '@/components/ui/RollModal';
import type { AdvantageMode } from '@/dice/types';
import type { Dnd5eCharacter } from '@/types/dnd5e';

import { CharacterHeader } from '@/components/dnd5e/CharacterHeader';
import { ProficiencyRow } from '@/components/dnd5e/ProficiencyRow';
import { AbilityScores } from '@/components/dnd5e/AbilityScores';
import { CombatStats } from '@/components/dnd5e/CombatStats';
import { SavingThrows } from '@/components/dnd5e/SavingThrows';
import { Skills } from '@/components/dnd5e/Skills';
import { Attacks } from '@/components/dnd5e/Attacks';
import { Spellcasting } from '@/components/dnd5e/Spellcasting';
import { Inventory } from '@/components/dnd5e/Inventory';
import { FeaturesSection } from '@/components/dnd5e/FeaturesSection';

type Props = {
  character: Dnd5eCharacter;
  onChange: (patch: Partial<Dnd5eCharacter>) => void;
};

export function Dnd5eSheet({ character, onChange }: Props) {
  const { result, rollCheck, rollExpression, reroll, dismiss } = useRoll();
  const [rollMode] = useState<AdvantageMode>('normal');

  return (
    <>
      <CharacterHeader character={character} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <ProficiencyRow character={character} />
          <AbilityScores character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />
          <CombatStats character={character} onChange={onChange} />
          <SavingThrows character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />
          <Skills character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />
          <Attacks
            character={character}
            onChange={onChange}
            onRollAttack={(mod, label) => rollCheck(mod, label, rollMode)}
            onRollExpression={(expr, label) => rollExpression(expr, label)}
          />
          <Spellcasting character={character} onChange={onChange} />
          <Inventory character={character} onChange={onChange} />
          <FeaturesSection character={character} onChange={onChange} />
        </View>
      </ScrollView>
      <RollModal result={result} onClose={dismiss} onReroll={reroll} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { padding: 20, paddingBottom: 48 },
});
```

- [ ] **Step 3: Create `src/components/wfrp4e/Wfrp4eSheet.tsx`** (shell — header only for now; Tasks 7–16 add sections)

```tsx
import { ScrollView, View, StyleSheet } from 'react-native';
import { useWfrpRoll } from '@/hooks/useWfrpRoll';
import { WfrpRollModal } from '@/components/ui/WfrpRollModal';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { Wfrp4eHeader } from '@/components/wfrp4e/Wfrp4eHeader';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

export function Wfrp4eSheet({ character, onChange }: Props) {
  const { result, rollTest, setDifficulty, reroll, dismiss } = useWfrpRoll();

  return (
    <>
      <Wfrp4eHeader character={character} onChange={onChange} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Tasks 7-16 add section components here, e.g.:
              <Characteristics character={character} onChange={onChange} onRoll={rollTest} /> */}
        </View>
      </ScrollView>
      <WfrpRollModal result={result} onClose={dismiss} onReroll={reroll} onDifficulty={setDifficulty} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { padding: 20, paddingBottom: 48 },
});
```

> Note: `rollTest` is referenced by section components added in later tasks. It is intentionally unused in this shell — that is fine (TS won't error since it's destructured-and-used by the modal siblings via `setDifficulty`/`reroll`; if `noUnusedLocals` flags `rollTest`, prefix with `void rollTest;` until Task 7 wires it).

- [ ] **Step 4: Rewrite `app/character/[id].tsx`** — thin loader + back-bar + system switch

```tsx
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useCharacter } from '@/hooks/useCharacter';
import { ErrorState } from '@/components/ui/ErrorState';
import { Dnd5eSheet } from '@/components/dnd5e/Dnd5eSheet';
import { Wfrp4eSheet } from '@/components/wfrp4e/Wfrp4eSheet';
import { exportCharacter } from '@/lib/transfer';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

export default function CharacterSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { data, loading, saving, patch } = useCharacter(id);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={t.colors.accent} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <ErrorState title="Character not found" body="This character may have been deleted." onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.backBar, { borderBottomColor: t.colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={t.colors.accent} />
          <Text style={[styles.backText, { color: t.colors.accent }]}>Characters</Text>
        </TouchableOpacity>
        <View style={styles.backRight}>
          {saving && <Text style={[styles.savingText, { color: t.colors.textMuted }]}>Saving…</Text>}
          <TouchableOpacity onPress={() => exportCharacter(data)} activeOpacity={0.7} hitSlop={8}>
            <Share2 size={20} color={t.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {data.system === 'dnd5e'
        ? <Dnd5eSheet character={data as Dnd5eCharacter} onChange={patch} />
        : <Wfrp4eSheet character={data as Wfrp4eCharacter} onChange={patch} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 15, fontWeight: '500' },
  backRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  savingText: { fontSize: 12 },
});
```

> `patch` is typed `(updates: Partial<EditableCharacter>) => void`. The sheet props want `Partial<Dnd5eCharacter>` / `Partial<Wfrp4eCharacter>`. Passing `patch` directly is assignable because `EditableCharacter` is the union. If TS complains about variance, wrap: `onChange={(p) => patch(p)}`.

> **Dependency note:** `exportCharacter` is created in Task 17. To keep this task compiling on its own, temporarily stub it: create `src/lib/transfer.ts` with `export async function exportCharacter(_data: unknown) {}` now, and Task 17 fills it in. Commit the stub with this task.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verify (Expo)**

Run: `npm run ios` (or `npm run android`). Create a WFRP character → it opens to a header (no more "Character not found"). Open an existing D&D character → unchanged. Tap the share icon → no crash (stub).

- [ ] **Step 7: Commit**

```bash
git add app/character/\[id\].tsx src/components/dnd5e/Dnd5eSheet.tsx src/components/wfrp4e/Wfrp4eSheet.tsx src/components/ui/ErrorState.tsx src/lib/transfer.ts
git commit -m "feat: system-branching sheet route; fix WFRP open trap"
```

---

### Task 7: `Wfrp4eHeader`

Editable bio block: name, species, current career + rank, status (tier/standing), age, height.

**Files:**
- Create: `src/components/wfrp4e/Wfrp4eHeader.tsx`

- [ ] **Step 1: Create `src/components/wfrp4e/Wfrp4eHeader.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { TextEditModal } from '@/components/ui/TextEditModal';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

type StrField = 'name' | 'species' | 'currentCareer' | 'height';

const TITLES: Record<StrField, string> = {
  name: 'Name', species: 'Species', currentCareer: 'Career', height: 'Height',
};

const TIERS: Wfrp4eCharacter['status']['tier'][] = ['Brass', 'Silver', 'Gold'];

export function Wfrp4eHeader({ character, onChange }: Props) {
  const t = useTheme();
  const [editing, setEditing] = useState<StrField | null>(null);

  function cycleRank() {
    const next = (character.careerRank % 4) + 1 as Wfrp4eCharacter['careerRank'];
    onChange({ careerRank: next });
  }

  function cycleTier() {
    const i = TIERS.indexOf(character.status.tier);
    const tier = TIERS[(i + 1) % TIERS.length];
    onChange({ status: { ...character.status, tier } });
  }

  return (
    <View style={[styles.root, { borderBottomColor: t.colors.border }]}>
      <TouchableOpacity onPress={() => setEditing('name')} activeOpacity={0.7}>
        <Text style={[styles.name, { color: t.colors.text, fontFamily: t.fontFamily.serif }]} numberOfLines={1}>
          {character.name || 'Unnamed'}
        </Text>
      </TouchableOpacity>

      <View style={styles.metaRow}>
        <TouchableOpacity onPress={() => setEditing('species')} activeOpacity={0.7}>
          <Text style={[styles.meta, { color: t.colors.textSecondary }]}>
            {character.species || 'Species'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
        <TouchableOpacity onPress={() => setEditing('currentCareer')} activeOpacity={0.7}>
          <Text style={[styles.meta, { color: t.colors.textSecondary }]}>
            {character.currentCareer || 'Career'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRank} activeOpacity={0.7} style={[styles.pill, { borderColor: t.colors.accent }]}>
          <Text style={[styles.pillText, { color: t.colors.accent }]}>Rank {character.careerRank}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <TouchableOpacity onPress={cycleTier} activeOpacity={0.7} style={[styles.pill, { borderColor: t.colors.gold }]}>
          <Text style={[styles.pillText, { color: t.colors.gold }]}>
            {character.status.tier} {character.status.standing}
          </Text>
        </TouchableOpacity>
      </View>

      <TextEditModal
        visible={editing !== null}
        title={editing ? TITLES[editing] : ''}
        value={editing ? String(character[editing] ?? '') : ''}
        onSave={(v) => editing && onChange({ [editing]: v } as Partial<Wfrp4eCharacter>)}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, gap: 6 },
  name: { fontSize: 28, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 14, fontWeight: '500' },
  dot: { fontSize: 14 },
  pill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
```

> `status.standing` is edited via the Status tap-to-cycle for tier; standing is adjusted in the `Resources`/`StorySection` later if needed. For this phase, standing stays read/display in the header (set via import or future field). Age is shown in `StorySection` (Task 16). This keeps the header compact.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/wfrp4e/Wfrp4eHeader.tsx
git commit -m "feat(wfrp): editable header"
```

---

### Task 8: `Characteristics` (10-stat grid, tap to roll)

Grid of WS BS S T I Ag Dex Int WP Fel. Each cell: abbrev, total (base+advances, large), base/advances editable. Tap the total → `onRoll(total, label)`.

**Files:**
- Create: `src/components/wfrp4e/Characteristics.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx` (render it)

- [ ] **Step 1: Create `src/components/wfrp4e/Characteristics.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Section } from '@/components/ui/Section';
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
  const [editKey, setEditKey] = useState<CharacteristicKey | null>(null);
  const [baseDraft, setBaseDraft] = useState('');
  const [advDraft, setAdvDraft] = useState('');

  function openEdit(k: CharacteristicKey) {
    setBaseDraft(String(character.characteristics[k].base));
    setAdvDraft(String(character.characteristics[k].advances));
    setEditKey(k);
  }

  function save() {
    if (!editKey) return;
    const base = parseInt(baseDraft, 10);
    const advances = parseInt(advDraft, 10);
    onChange({
      characteristics: {
        ...character.characteristics,
        [editKey]: {
          base: isNaN(base) ? 0 : base,
          advances: isNaN(advances) ? 0 : advances,
        },
      },
    });
    setEditKey(null);
  }

  return (
    <Section title="Characteristics">
      <View style={styles.grid}>
        {KEYS.map(k => {
          const total = characteristicTotal(character, k);
          const { advances } = character.characteristics[k];
          return (
            <View key={k} style={[styles.cell, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
              <Text style={[styles.abbrev, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[k]}</Text>
              <TouchableOpacity onPress={() => onRoll(total, CHARACTERISTIC_LABELS[k])} activeOpacity={0.6}>
                <Text style={[styles.total, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{total}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(k)} activeOpacity={0.6}>
                <Text style={[styles.adv, { color: t.colors.textMuted }]}>+{advances}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <Modal visible={editKey !== null} transparent animationType="fade" onRequestClose={() => setEditKey(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setEditKey(null)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text }]}>
              {editKey ? CHARACTERISTIC_LABELS[editKey] : ''}
            </Text>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Base</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={baseDraft} onChangeText={setBaseDraft} autoFocus selectTextOnFocus />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Advances</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={advDraft} onChangeText={setAdvDraft} selectTextOnFocus />
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setEditKey(null)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={save}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '18.5%', borderRadius: 8, borderWidth: 1, alignItems: 'center', paddingVertical: 8, gap: 1 },
  abbrev: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  total: { fontSize: 24, fontWeight: '700' },
  adv: { fontSize: 11, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  twoCol: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input: { fontSize: 18, padding: 12, borderRadius: 8, borderWidth: 1, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Wire into `Wfrp4eSheet.tsx`** — import and render inside `<View style={styles.body}>`, replacing the comment:

```tsx
import { Characteristics } from '@/components/wfrp4e/Characteristics';
// ...
<View style={styles.body}>
  <Characteristics character={character} onChange={onChange} onRoll={rollTest} />
</View>
```

(Remove the `void rollTest;` workaround from Task 6 if you added it.)

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit` (no errors). In the app: open a WFRP character, tap a characteristic total → roll modal shows roll vs target, SL, difficulty chips; change difficulty re-rolls. Tap `+adv` → edit base/advances, total updates and persists (reopen confirms).

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/Characteristics.tsx src/components/wfrp4e/Wfrp4eSheet.tsx
git commit -m "feat(wfrp): characteristics grid with d100 tests"
```

---

### Task 9: `Resources` (Wounds, Fate/Fortune, Resilience/Resolve)

Wounds prominent with the `Stepper` (has the HP bar). Fate/Fortune/Resilience/Resolve as compact current/max steppers.

**Files:**
- Create: `src/components/wfrp4e/Resources.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx`

- [ ] **Step 1: Create `src/components/wfrp4e/Resources.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Section } from '@/components/ui/Section';
import { Stepper } from '@/components/ui/Stepper';
import { EditableNumber } from '@/components/ui/EditableNumber';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Pair = { current: number; max: number };
type PairKey = 'fate' | 'fortune' | 'resilience' | 'resolve';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const PAIR_LABEL: Record<PairKey, string> = {
  fate: 'Fate', fortune: 'Fortune', resilience: 'Resilience', resolve: 'Resolve',
};

export function Resources({ character, onChange }: Props) {
  const t = useTheme();

  function setWounds(next: number) {
    onChange({ wounds: { ...character.wounds, current: next } });
  }
  function setPair(key: PairKey, patch: Partial<Pair>) {
    onChange({ [key]: { ...character[key], ...patch } } as Partial<Wfrp4eCharacter>);
  }

  return (
    <Section title="Resources">
      <Stepper
        label="Wounds"
        value={character.wounds.current}
        max={character.wounds.max}
        onStep={setWounds}
        accent
      />
      <View style={styles.maxRow}>
        <Text style={[styles.maxLabel, { color: t.colors.textMuted }]}>Max wounds</Text>
        <EditableNumber
          value={character.wounds.max}
          label="Max"
          size="sm"
          onSave={(v) => onChange({ wounds: { ...character.wounds, max: v } })}
        />
      </View>

      <View style={styles.pairGrid}>
        {(['fate', 'fortune', 'resilience', 'resolve'] as PairKey[]).map(key => (
          <View key={key} style={[styles.pairBox, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
            <Text style={[styles.pairLabel, { color: t.colors.textMuted }]}>{PAIR_LABEL[key]}</Text>
            <View style={styles.pairRow}>
              <Text style={[styles.minus, { color: t.colors.danger }]} onPress={() => setPair(key, { current: Math.max(0, character[key].current - 1) })}>−</Text>
              <Text style={[styles.pairVal, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
                {character[key].current}
                <Text style={{ color: t.colors.textMuted, fontSize: 14 }}> / {character[key].max}</Text>
              </Text>
              <Text style={[styles.plus, { color: t.colors.success }]} onPress={() => setPair(key, { current: Math.min(character[key].max, character[key].current + 1) })}>+</Text>
            </View>
            <EditableNumber
              value={character[key].max}
              label="Max"
              size="sm"
              onSave={(v) => setPair(key, { max: v, current: Math.min(character[key].current, v) })}
            />
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  maxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  maxLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  pairGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pairBox: { width: '47%', borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'center', gap: 6 },
  pairLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pairVal: { fontSize: 24, fontWeight: '700' },
  minus: { fontSize: 26, fontWeight: '700', width: 28, textAlign: 'center' },
  plus: { fontSize: 26, fontWeight: '700', width: 28, textAlign: 'center' },
});
```

- [ ] **Step 2: Wire into `Wfrp4eSheet.tsx`** — add under `<Characteristics .../>`:

```tsx
import { Resources } from '@/components/wfrp4e/Resources';
// ...
<Resources character={character} onChange={onChange} />
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit`. In-app: wounds bar steps and changes color; Fate/Fortune/Resilience/Resolve ± clamp at 0/max; max edits persist.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/Resources.tsx src/components/wfrp4e/Wfrp4eSheet.tsx
git commit -m "feat(wfrp): wounds + fate/fortune/resilience/resolve"
```

---

### Task 10: `WfrpSkills` (reference list pattern) + additive `description` field

Each skill row: name, linked-characteristic abbrev, total (`characteristicTotal + advances`), advances (tap to edit), tap row → roll test. Add/remove rows. This is the canonical add/remove archetype — Tasks 11–15 follow this structure.

**Files:**
- Modify: `src/types/wfrp4e.ts` (add `description?` to skills)
- Create: `src/components/wfrp4e/WfrpSkills.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx`

- [ ] **Step 1: Add the additive field in `src/types/wfrp4e.ts`** — in the `skills` array element type, add `description?: string;`:

```ts
  skills: Array<{
    id: string;
    name: string;
    characteristic: CharacteristicKey;
    advances: number;
    isAdvanced: boolean;
    description?: string;   // user-entered; powers the next-phase wiki popup
  }>;
```

(Additive optional field — existing characters stay valid.)

- [ ] **Step 2: Create `src/components/wfrp4e/WfrpSkills.tsx`**

```tsx
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { Section } from '@/components/ui/Section';
import { CHARACTERISTIC_ABBREV, characteristicTotal } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

type Skill = Wfrp4eCharacter['skills'][number];
const CHARS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onRoll: (target: number, label: string) => void;
};

const EMPTY: Omit<Skill, 'id'> = { name: '', characteristic: 'ws', advances: 0, isAdvanced: false, description: '' };

export function WfrpSkills({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Skill, 'id'>>(EMPTY);

  function total(s: Skill) {
    return characteristicTotal(character, s.characteristic) + s.advances;
  }
  function setAdvances(id: string, advances: number) {
    onChange({ skills: character.skills.map(s => s.id === id ? { ...s, advances } : s) });
  }
  function remove(id: string) {
    Alert.alert('Remove skill?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange({ skills: character.skills.filter(s => s.id !== id) }) },
    ]);
  }
  function add() {
    if (!draft.name.trim()) return;
    onChange({ skills: [...character.skills, { id: uuidv4(), ...draft, name: draft.name.trim() }] });
    setDraft(EMPTY);
    setAdding(false);
  }

  const sorted = [...character.skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Section title="Skills">
      {sorted.map(s => (
        <View key={s.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={styles.rowMain} activeOpacity={0.6} onPress={() => onRoll(total(s), s.name)}>
            <Text style={[styles.skillName, { color: t.colors.text }]} numberOfLines={1}>{s.name}</Text>
            <Text style={[styles.skillChar, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[s.characteristic]}</Text>
          </TouchableOpacity>
          <View style={styles.advCtl}>
            <TouchableOpacity onPress={() => setAdvances(s.id, Math.max(0, s.advances - 1))} style={[styles.advBtn, { borderColor: t.colors.border }]}>
              <Text style={[styles.advBtnText, { color: t.colors.textMuted }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.advVal, { color: t.colors.textMuted }]}>+{s.advances}</Text>
            <TouchableOpacity onPress={() => setAdvances(s.id, s.advances + 1)} style={[styles.advBtn, { borderColor: t.colors.border }]}>
              <Text style={[styles.advBtnText, { color: t.colors.textMuted }]}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.6} onPress={() => onRoll(total(s), s.name)} style={styles.totalBox}>
            <Text style={[styles.total, { color: t.colors.accent, fontFamily: t.fontFamily.serif }]}>{total(s)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(s.id)} style={styles.del}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={() => setAdding(true)}>
        <Plus size={14} color={t.colors.accent} />
        <Text style={[styles.addText, { color: t.colors.accent }]}>Add Skill</Text>
      </TouchableOpacity>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>Add Skill</Text>
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder="Skill name (e.g. Melee (Basic))" placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} autoFocus />
            <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Characteristic</Text>
            <View style={styles.charRow}>
              {CHARS.map(c => {
                const active = draft.characteristic === c;
                return (
                  <TouchableOpacity key={c}
                    style={[styles.charChip, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
                    onPress={() => setDraft(d => ({ ...d, characteristic: c }))}>
                    <Text style={[styles.charChipText, { color: active ? t.colors.accent : t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[c]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Advances</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={String(draft.advances)} onChangeText={v => setDraft(d => ({ ...d, advances: parseInt(v) || 0 }))} />
              </View>
              <TouchableOpacity style={[styles.advancedToggle, { borderColor: draft.isAdvanced ? t.colors.accent : t.colors.border, backgroundColor: draft.isAdvanced ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
                onPress={() => setDraft(d => ({ ...d, isAdvanced: !d.isAdvanced }))}>
                <Text style={[styles.advancedText, { color: draft.isAdvanced ? t.colors.accent : t.colors.textMuted }]}>Advanced</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder="Description (optional)" placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={draft.description} onChangeText={v => setDraft(d => ({ ...d, description: v }))} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={add}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  skillName: { fontSize: 14, flexShrink: 1 },
  skillChar: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  advCtl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  advBtn: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  advBtnText: { fontSize: 14, lineHeight: 16 },
  advVal: { fontSize: 12, fontWeight: '600', minWidth: 26, textAlign: 'center' },
  totalBox: { minWidth: 34, alignItems: 'center' },
  total: { fontSize: 20, fontWeight: '700' },
  del: { width: 26, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  charRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  charChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, minWidth: 38, alignItems: 'center' },
  charChipText: { fontSize: 12, fontWeight: '700' },
  twoCol: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  advancedToggle: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  advancedText: { fontSize: 13, fontWeight: '600' },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 64 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 3: Wire into `Wfrp4eSheet.tsx`** under `<Resources .../>`:

```tsx
import { WfrpSkills } from '@/components/wfrp4e/WfrpSkills';
// ...
<WfrpSkills character={character} onChange={onChange} onRoll={rollTest} />
```

- [ ] **Step 4: Typecheck + manual verify**

Run: `npx tsc --noEmit`. In-app: add a skill (name + characteristic + advances), tap it → rolls vs `charTotal+advances`, ± advances persists, remove works.

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/components/wfrp4e/WfrpSkills.tsx src/components/wfrp4e/Wfrp4eSheet.tsx
git commit -m "feat(wfrp): skills list with d100 tests + description field"
```

---

### Task 11: `Talents`

List archetype (copy `WfrpSkills` structure). Row: name + `×timesTaken`; tap → edit. Fields: `name`, `timesTaken` (number), `description` (multiline), `tests?` (string). No roll.

**Files:**
- Create: `src/components/wfrp4e/Talents.tsx`
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx`

- [ ] **Step 1: Create `src/components/wfrp4e/Talents.tsx`**

```tsx
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { Section } from '@/components/ui/Section';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Talent = Wfrp4eCharacter['talents'][number];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const EMPTY: Omit<Talent, 'id'> = { name: '', timesTaken: 1, description: '', tests: '' };

export function Talents({ character, onChange }: Props) {
  const t = useTheme();
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Talent, 'id'>>(EMPTY);

  function openAdd() { setDraft(EMPTY); setAdding(true); setEditId(null); }
  function openEdit(tal: Talent) {
    setDraft({ name: tal.name, timesTaken: tal.timesTaken, description: tal.description, tests: tal.tests ?? '' });
    setEditId(tal.id); setAdding(true);
  }
  function save() {
    if (!draft.name.trim()) return;
    if (editId) {
      onChange({ talents: character.talents.map(x => x.id === editId ? { ...x, ...draft, name: draft.name.trim() } : x) });
    } else {
      onChange({ talents: [...character.talents, { id: uuidv4(), ...draft, name: draft.name.trim() }] });
    }
    setAdding(false); setEditId(null); setDraft(EMPTY);
  }
  function remove(id: string) {
    Alert.alert('Remove talent?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange({ talents: character.talents.filter(x => x.id !== id) }) },
    ]);
  }

  return (
    <Section title="Talents">
      {character.talents.map(tal => (
        <View key={tal.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEdit(tal)}>
            <Text style={[styles.name, { color: t.colors.text }]}>
              {tal.name}{tal.timesTaken > 1 ? ` ×${tal.timesTaken}` : ''}
            </Text>
            {!!tal.description && <Text style={[styles.desc, { color: t.colors.textMuted }]} numberOfLines={2}>{tal.description}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(tal.id)} style={styles.del}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAdd}>
        <Plus size={14} color={t.colors.accent} />
        <Text style={[styles.addText, { color: t.colors.accent }]}>Add Talent</Text>
      </TouchableOpacity>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{editId ? 'Edit Talent' : 'Add Talent'}</Text>
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder="Talent name" placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} autoFocus />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Times taken</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={String(draft.timesTaken)} onChangeText={v => setDraft(d => ({ ...d, timesTaken: parseInt(v) || 1 }))} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textMuted }]}>Test</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder="e.g. Cool" placeholderTextColor={t.colors.textMuted}
                  value={draft.tests} onChangeText={v => setDraft(d => ({ ...d, tests: v }))} />
              </View>
            </View>
            <TextInput style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder="Description" placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={draft.description} onChangeText={v => setDraft(d => ({ ...d, description: v }))} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={save}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 14, fontWeight: '500' },
  desc: { fontSize: 12, marginTop: 2 },
  del: { width: 26, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 80 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Wire into `Wfrp4eSheet.tsx`** under `<WfrpSkills .../>`:

```tsx
import { Talents } from '@/components/wfrp4e/Talents';
// ...
<Talents character={character} onChange={onChange} />
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`.

```bash
git add src/components/wfrp4e/Talents.tsx src/components/wfrp4e/Wfrp4eSheet.tsx
git commit -m "feat(wfrp): talents list"
```

---

> **Tasks 12–15 are the same add/edit/remove list archetype as `Talents` (Task 11).** Build each by copying `Talents.tsx`, renaming, and swapping the item type, the `EMPTY` draft, the modal fields, and the row display per the spec below. Each: typecheck (`npx tsc --noEmit`), wire into `Wfrp4eSheet.tsx` in the listed order, manual-verify add/edit/remove persists, commit. No roll wiring (none of these roll).

### Task 12: `Combat` (Weapons + Armour + Armour Points)

**File:** `src/components/wfrp4e/Combat.tsx`. Three blocks inside one `<Section title="Combat">` (or two Sections "Weapons & Armour" + an Armour-Points strip). Reuse the Task-11 modal pattern for the two lists; Armour Points is a fixed 4-cell editable strip.

- **Weapons** — `character.weapons`, item fields: `name, group, encumbrance(number), range, damage, qualities, notes?`. Patch: `onChange({ weapons: ... })`. Row display: `name` (bold) + `damage · group` muted subline; right side small `Enc {encumbrance}`.
- **Armour** — `character.armour`, fields: `name, locations(string[] — comma-split input "Head, Body"), encumbrance(number), ap(number), qualities`. Patch: `onChange({ armour: ... })`. Row: `name` + `AP {ap} · {locations.join('/')}`. For the `locations` input, store `value.split(',').map(s=>s.trim()).filter(Boolean)`.
- **Armour Points** — `character.armourPoints` = `{ head, body, arms, legs }`. Render four `EditableNumber` (from `@/components/ui/EditableNumber`), one per location, in a row:

```tsx
{(['head','body','arms','legs'] as const).map(loc => (
  <EditableNumber key={loc} value={character.armourPoints[loc]} label={loc} size="sm"
    onSave={(v) => onChange({ armourPoints: { ...character.armourPoints, [loc]: v } })} />
))}
```

Wire order: under `<Talents/>`. Commit: `feat(wfrp): combat — weapons, armour, armour points`.

### Task 13: `Trappings` (items + encumbrance + wealth)

**File:** `src/components/wfrp4e/Trappings.tsx`. `<Section title="Trappings & Wealth">`.

- **Items** — `character.trappings`, fields: `name, encumbrance(number), qty(number), notes?`. Patch `onChange({ trappings: ... })`. Same list modal as Task 11.
- **Encumbrance summary** — computed carried = `character.trappings.reduce((s,i)=>s + i.encumbrance*i.qty, 0)` plus weapons/armour enc (`character.weapons.reduce(...)+character.armour.reduce(...)`). Display `carried / character.encumbranceMax`, with `encumbranceMax` as an `EditableNumber`. Tint the carried number `t.colors.danger` when `carried > encumbranceMax`.
- **Wealth** — `character.wealth = { brass, silver, gold }`. Three coin chips like `Inventory.tsx`'s currency row, each an `EditableNumber` (size `sm`). Patch `onChange({ wealth: { ...character.wealth, [coin]: v } })`.

Wire order: under `<Combat/>`. Commit: `feat(wfrp): trappings, encumbrance, wealth`.

### Task 14: `Magic` (Spells + Prayers, collapsible)

**File:** `src/components/wfrp4e/Magic.tsx`. Two `<Section>`s or one with two sub-lists. **Collapse when empty:** if `character.spells.length === 0 && character.prayers.length === 0`, render a single collapsed `<Section title="Magic & Prayers">` containing just the two "Add" buttons (no empty tables). Use local `useState` for an expand toggle only if both lists are non-empty and long; minimum viable = always show "Add Spell"/"Add Prayer" and render rows when present.

- **Spells** — `character.spells`, fields: `name, lore, castingNumber(number), range, target, duration, effect`. Patch `onChange({ spells: ... })`. Row: `name` + `Lore: {lore} · CN {castingNumber}` subline; tap → edit (show `effect` in the modal as multiline).
- **Prayers** — `character.prayers`, fields: `name, god, range, target, duration, effect`. Patch `onChange({ prayers: ... })`. Row: `name` + `{god}` subline.

Wire order: under `<Trappings/>`. Commit: `feat(wfrp): spells + prayers`.

### Task 15: `CorruptionSin` (Corruption + Sin + Mutations)

**File:** `src/components/wfrp4e/CorruptionSin.tsx`. `<Section title="Corruption & Sin">`.

- **Corruption** — `character.corruption = { current, threshold }`. Two `EditableNumber` (current, threshold) side by side, or a `Stepper` for current with threshold as `EditableNumber`.
- **Sin** — `character.sin` (number). One `EditableNumber` (`onSave={(v)=>onChange({ sin: v })}`).
- **Mutations** — `character.mutations`, fields: `name, type('physical'|'mental')`. List modal (Task 11 pattern) but the only "type" control is a two-chip toggle Physical/Mental. Patch `onChange({ mutations: ... })`. Row: `name` + small type pill.

Wire order: under `<Magic/>`. Commit: `feat(wfrp): corruption, sin, mutations`.

### Task 16: `StorySection` (ambitions, psychology, notes, age/height)

Free-text blocks via `TextEditModal` (no add/remove). 

**File:** `src/components/wfrp4e/StorySection.tsx`. `<Section title="Story">`. Tappable rows that open `TextEditModal`:
- Ambition (short) → `onChange({ ambitions: { ...character.ambitions, shortTerm: v } })`
- Ambition (long) → `ambitions.longTerm`
- Party ambition (short/long) → `partyAmbition.shortTerm` / `.longTerm`
- Psychology → `onChange({ psychology: v })`
- Notes → `onChange({ notes: v })`
- Age (number, `EditableNumber`) → `onChange({ age: v })`; Height (string, `TextEditModal`) → `onChange({ height: v })`

Each row: label + current value (muted, `numberOfLines={2}`) or "Tap to add". Reuse the single-`editing`-key pattern from `Wfrp4eHeader` (Task 7).

Wire order: under `<CorruptionSin/>` (last section). Commit: `feat(wfrp): story — ambitions, psychology, notes`.

- [ ] **Task 12 done** — Combat built, wired, typechecks, committed.
- [ ] **Task 13 done** — Trappings built, wired, typechecks, committed.
- [ ] **Task 14 done** — Magic built, wired, typechecks, committed.
- [ ] **Task 15 done** — CorruptionSin built, wired, typechecks, committed.
- [ ] **Task 16 done** — StorySection built, wired, typechecks, committed.

- [ ] **Part A acceptance check:** open a fresh WFRP character; every field in `Wfrp4eCharacter` is reachable and editable; edits survive leaving and reopening the sheet; characteristics and skills roll d100 with SL + difficulty. Run `npm test` (dice green) and `npx tsc --noEmit` (clean).

---

## Part B — Polish

### Task 17: Export / import character JSON

Fills the `src/lib/transfer.ts` stub from Task 6. Export from the sheet (wired in Task 6 back-bar). Import from the character list.

**Files:**
- Modify: `package.json` (add expo-file-system)
- Rewrite: `src/lib/transfer.ts`
- Modify: `src/hooks/useCharacterList.ts` (add `importCharacter`)
- Modify: `app/(tabs)/index.tsx` (import button + handler)

- [ ] **Step 1: Install expo-file-system**

Run: `npx expo install expo-file-system`
Expected: dependency added.

- [ ] **Step 2: Rewrite `src/lib/transfer.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { CharacterData, GameSystem } from '@/types';

// Export: write JSON to cache, open the system share sheet.
export async function exportCharacter(data: CharacterData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const safe = (data.name || 'character').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const uri = `${FileSystem.cacheDirectory}${safe}.ttrp.json`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export character' });
  }
}

export type ImportedCharacter = { system: GameSystem; data: CharacterData };

// Import: pick a JSON file, parse + validate shape.
export async function pickAndParseCharacter(): Promise<ImportedCharacter | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const parsed = JSON.parse(text);
  if (parsed?.system !== 'dnd5e' && parsed?.system !== 'wfrp4e') {
    throw new Error('Unrecognized character file.');
  }
  if (parsed?.schemaVer !== 1) {
    throw new Error('Unsupported character version.');
  }
  return { system: parsed.system as GameSystem, data: parsed as CharacterData };
}
```

> **SDK 56 note:** if `FileSystem.cacheDirectory` / `writeAsStringAsync` / `readAsStringAsync` are not exported from `expo-file-system` (new File API), change the import to `import * as FileSystem from 'expo-file-system/legacy';` — the legacy API has these exact members.

- [ ] **Step 3: Add `importCharacter` to `src/hooks/useCharacterList.ts`** — add inside the hook (after `duplicate`), and include it in the returned object:

```ts
  const importCharacter = useCallback(async (): Promise<string | null> => {
    const picked = await pickAndParseCharacter();
    if (!picked) return null;
    const id = await queries.createCharacter(db, picked.system, picked.data.name, picked.data);
    await refresh();
    return id;
  }, [db, refresh]);
```

Add the import at the top: `import { pickAndParseCharacter } from '@/lib/transfer';` and add `importCharacter` to the `return { ... }`.

- [ ] **Step 4: Wire the import button in `app/(tabs)/index.tsx`** — destructure `importCharacter` from the hook, add an `Upload` icon button next to the `+` in the header, and a handler:

```tsx
import { Plus, Eye, Copy, Trash2, Dices, Upload } from 'lucide-react-native';
// in NativeCharacterList:
const { characters, loading, refresh, create, remove, duplicate, importCharacter } = useCharacterListNative!();

async function handleImport() {
  try {
    const id = await importCharacter();
    if (id) router.push(`/character/${id}`);
  } catch (e) {
    Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not read that file.');
  }
}
```

In the header `<View style={styles.header}>`, put the add button group:

```tsx
<View style={{ flexDirection: 'row', gap: 10 }}>
  <TouchableOpacity style={[styles.addButton, { backgroundColor: t.colors.backgroundSecondary }]} onPress={handleImport} activeOpacity={0.8}>
    <Upload size={18} color={t.colors.accent} />
  </TouchableOpacity>
  <TouchableOpacity style={[styles.addButton, { backgroundColor: t.colors.accent }]} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
    <Plus size={20} color={t.colors.accentText} />
  </TouchableOpacity>
</View>
```

- [ ] **Step 5: Typecheck + manual verify**

Run: `npx tsc --noEmit`. In-app: export a character → share sheet shows a `.ttrp.json`; import it → new copy appears and opens. Import a non-JSON file → "Import failed" alert.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/transfer.ts src/hooks/useCharacterList.ts app/\(tabs\)/index.tsx
git commit -m "feat: export/import character as JSON"
```

---

### Task 18: Settings tab + theme provider (manual light/dark) + haptics toggle

`useTheme` currently reads OS scheme only. Convert it to a context so a stored override (system/light/dark) wins. Persist in the `settings` table.

**Files:**
- Rename + rewrite: `src/hooks/useTheme.ts` → `src/hooks/useTheme.tsx`
- Modify: `app/_layout.tsx`
- Create: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace `src/hooks/useTheme.ts` with `src/hooks/useTheme.tsx`**

```bash
git rm src/hooks/useTheme.ts
```

Create `src/hooks/useTheme.tsx`:

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { light, dark, type ColorScheme } from '../tokens/colors';
import { spacing, radius, shadow } from '../tokens/spacing';
import { fontSize, fontWeight, textStyle, fontFamily } from '../tokens/typography';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Theme = {
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  textStyle: typeof textStyle;
  fontFamily: typeof fontFamily;
  isDark: boolean;
};

function buildTheme(isDark: boolean): Theme {
  return { colors: isDark ? dark : light, spacing, radius, shadow, fontSize, fontWeight, textStyle, fontFamily, isDark };
}

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; isDark: boolean };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children, onModeChange }: { children: ReactNode; onModeChange?: (m: ThemeMode) => void }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    onModeChange?.(m);
  }, [onModeChange]);
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return <ThemeCtx.Provider value={{ mode, setMode, isDark }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  const scheme = useColorScheme();
  return buildTheme(ctx ? ctx.isDark : scheme === 'dark');
}

export function useThemeMode() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return { mode: ctx.mode, setMode: ctx.setMode };
}
```

> Existing imports `from '@/hooks/useTheme'` resolve unchanged (extension-agnostic). `useTheme()`'s return shape is identical, so no consumer changes.

- [ ] **Step 2: Rewrite `app/_layout.tsx`** to wrap in `ThemeProvider` and load persisted prefs on native

```tsx
import { useEffect, useCallback } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase, DB_NAME } from '@/db/schema';
import { getSetting, setSetting } from '@/db/queries';
import { ThemeProvider, useTheme, useThemeMode, type ThemeMode } from '@/hooks/useTheme';
import { setHapticsEnabled } from '@/lib/haptics';

function AppContent() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function PrefLoader({ db }: { db: ReturnType<typeof useSQLiteContext> }) {
  const { setMode } = useThemeMode();
  useEffect(() => {
    (async () => {
      const m = await getSetting(db, 'theme_mode');
      if (m === 'light' || m === 'dark' || m === 'system') setMode(m as ThemeMode);
      const h = await getSetting(db, 'haptics_enabled');
      setHapticsEnabled(h !== 'false');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function NativeThemed() {
  const db = useSQLiteContext();
  const persist = useCallback((m: ThemeMode) => { setSetting(db, 'theme_mode', m); }, [db]);
  return (
    <ThemeProvider onModeChange={persist}>
      <PrefLoader db={db} />
      <AppContent />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DB_NAME} onInit={initDatabase}>
        <NativeThemed />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Create `app/(tabs)/settings.tsx`**

```tsx
import { Platform, View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme, useThemeMode, type ThemeMode } from '@/hooks/useTheme';
import { setHapticsEnabled } from '@/lib/haptics';

let useDb: (() => any) | null = null;
if (Platform.OS !== 'web') {
  useDb = require('expo-sqlite').useSQLiteContext;
}
let setSettingFn: ((db: any, k: string, v: string) => Promise<void>) | null = null;
if (Platform.OS !== 'web') {
  setSettingFn = require('@/db/queries').setSetting;
}

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const db = useDb ? useDb() : null;
  const [haptics, setHaptics] = useState(true);

  function toggleHaptics(v: boolean) {
    setHaptics(v);
    setHapticsEnabled(v);
    if (db && setSettingFn) setSettingFn(db, 'haptics_enabled', v ? 'true' : 'false');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>Settings</Text>

      <Text style={[styles.section, { color: t.colors.textMuted }]}>Appearance</Text>
      <View style={styles.segment}>
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <TouchableOpacity key={m.id}
              style={[styles.segBtn, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
              onPress={() => setMode(m.id)} activeOpacity={0.7}>
              <Text style={[styles.segText, { color: active ? t.colors.accent : t.colors.text }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.section, { color: t.colors.textMuted }]}>Feedback</Text>
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>Haptics</Text>
        <Switch value={haptics} onValueChange={toggleHaptics} />
      </View>

      <Text style={[styles.section, { color: t.colors.textMuted }]}>About</Text>
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>Version</Text>
        <Text style={[styles.rowValue, { color: t.colors.textMuted }]}>1.0.0 · demo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '700', paddingTop: 16, paddingBottom: 12 },
  section: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14 },
});
```

> The `haptics` `useState` initialises to `true` for display; the real flag is loaded at startup by `PrefLoader` (Task 18 Step 2) via `setHapticsEnabled`. To reflect the persisted value in the toggle, read it once on mount: `useEffect(() => { if (db) getSetting(db,'haptics_enabled').then(h => setHaptics(h !== 'false')); }, [db]);` (import `getSetting` the same conditional way as `setSetting`).

- [ ] **Step 4: Add the Settings tab in `app/(tabs)/_layout.tsx`** — import `Settings` icon and add a third `<Tabs.Screen>`:

```tsx
import { Users, Dices, Settings } from 'lucide-react-native';
// ...after the dice screen:
<Tabs.Screen
  name="settings"
  options={{
    title: 'Settings',
    tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
  }}
/>
```

- [ ] **Step 5: Typecheck + manual verify**

Run: `npx tsc --noEmit`. In-app: Settings tab appears; switching Light/Dark/System repaints immediately; kill + relaunch → choice persisted; toggle Haptics off → rolls no longer buzz, persists across relaunch.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTheme.tsx app/_layout.tsx app/\(tabs\)/settings.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat: settings tab — theme override + haptics toggle"
```

---

### Task 19: Final states + verification

Empty state (character list) and sheet error state already exist (list: `app/(tabs)/index.tsx`; sheet: `ErrorState` from Task 6). This task confirms loading states and runs the full check.

**Files:**
- Modify (if needed): `app/(tabs)/index.tsx` (loading spinner)

- [ ] **Step 1: Ensure the list shows a spinner while `loading`** — in `NativeCharacterList`, when `loading && characters.length === 0`, render `<ActivityIndicator color={t.colors.accent} style={{ marginTop: 40 }} />` instead of an empty gap. (Import `ActivityIndicator` from `react-native`.)

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full test run**

Run: `npm test`
Expected: dice suite green.

- [ ] **Step 4: Manual smoke (both systems)**

- Create D&D character → sheet unchanged, rolls work.
- Create WFRP character → full sheet, every section edits + persists, d100 tests with SL/difficulty.
- Export WFRP → import → duplicate opens.
- Settings: theme + haptics persist across relaunch.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: loading state + final verification"
```

---

## Deferred (NOT in this plan)

- Wiki popup (tap talent/skill → description popup). `skills[].description` and `talents[].description` already persist for it. Tracked as next-phase task.
- Onboarding flow, opposed-test dice mode, paywall/RevenueCat.

## Self-review notes

- **Spec coverage:** §1 routing → Task 6; §2 components → Tasks 7–16; §3 dice → Tasks 2,4,5; §4 polish → Tasks 17,18,19; §5 `skills[].description` → Task 10 Step 1; §6 testing → Tasks 1,2. All covered.
- **Type consistency:** `WfrpRollResult` (Task 2) consumed by `useWfrpRoll` (4), `WfrpRollModal` (5), `Wfrp4eSheet` (6). `onRoll(target,label)` signature matches `rollTest` in Characteristics (8) and WfrpSkills (10). `exportCharacter` stubbed in Task 6, filled in Task 17 — flagged inline.
- **Ordering:** `transfer.ts` is referenced by `[id].tsx` in Task 6 (stub) before Task 17 fills it — handled with an explicit stub step.
