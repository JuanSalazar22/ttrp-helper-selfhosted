# WFRP Homebrew Species Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-character editor to set the species name + 10 racial characteristic modifiers, writing them into each characteristic's `racial` component. No bundled official species.

**Architecture:** A pure `applySpeciesPatch` helper builds the `onChange` patch; a new `SpeciesEditor` full-screen modal collects name + modifiers; the WFRP header's existing Species tap opens it.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · TypeScript (strict) · jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-22-wfrp-species-editor-design.md`

---

## File Structure

- `src/types/wfrp4e.ts` — **modify**: add `applySpeciesPatch` helper.
- `src/types/__tests__/wfrp4e.test.ts` — **modify**: add `applySpeciesPatch` tests.
- `src/components/wfrp4e/SpeciesEditor.tsx` — **create**: the editor modal.
- `src/components/wfrp4e/Wfrp4eHeader.tsx` — **modify**: Species tap opens the editor.

No data-shape/schema change (uses existing `species` + `characteristics[k].racial`). UI verified with `tsc` + web preview.

---

## Task 1: `applySpeciesPatch` helper (TDD)

**Files:**
- Modify: `src/types/wfrp4e.ts`
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { applySpeciesPatch } from '../wfrp4e';

describe('applySpeciesPatch', () => {
  test('sets species and each racial, preserving roll/other/advances', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.ws = { roll: 31, racial: 0, other: 2, advances: 5 };
    const racial = {
      ws: 20, bs: 10, s: 0, t: 5, i: 0, ag: 10, dex: 0, int: 0, wp: 0, fel: 10,
    } as Record<import('../wfrp4e').CharacteristicKey, number>;
    const patch = applySpeciesPatch(char, 'Reiklander', racial);
    expect(patch.species).toBe('Reiklander');
    expect(patch.characteristics!.ws).toEqual({ roll: 31, racial: 20, other: 2, advances: 5 });
    expect(patch.characteristics!.fel.racial).toBe(10);
  });

  test('missing key in the map sets that racial to 0', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.bs = { roll: 25, racial: 99, other: 0, advances: 0 };
    const patch = applySpeciesPatch(char, 'X', {} as Record<import('../wfrp4e').CharacteristicKey, number>);
    expect(patch.characteristics!.bs.racial).toBe(0);
    expect(patch.characteristics!.bs.roll).toBe(25);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — `applySpeciesPatch` not exported.

- [ ] **Step 3: Implement the helper**

In `src/types/wfrp4e.ts`, add after `advanceCost` (before `defaultWfrp4eCharacter`):

```ts
export function applySpeciesPatch(
  character: Wfrp4eCharacter,
  species: string,
  racialByKey: Record<CharacteristicKey, number>,
): Partial<Wfrp4eCharacter> {
  const characteristics = { ...character.characteristics };
  for (const k of CHARACTERISTIC_KEYS) {
    characteristics[k] = { ...characteristics[k], racial: racialByKey[k] ?? 0 };
  }
  return { species, characteristics };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): applySpeciesPatch helper"
```

---

## Task 2: `SpeciesEditor` modal

**Files:**
- Create: `src/components/wfrp4e/SpeciesEditor.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/wfrp4e/SpeciesEditor.tsx` with exactly:

```tsx
import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { CHARACTERISTIC_ABBREV, applySpeciesPatch } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

function modsFromCharacter(character: Wfrp4eCharacter): Record<CharacteristicKey, string> {
  return Object.fromEntries(
    KEYS.map(k => [k, String(character.characteristics[k].racial)]),
  ) as Record<CharacteristicKey, string>;
}

export function SpeciesEditor({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const [name, setName] = useState(character.species);
  const [mods, setMods] = useState<Record<CharacteristicKey, string>>(() => modsFromCharacter(character));

  // Re-sync from the character whenever the editor opens (react-native-web does not
  // reliably fire Modal onShow, so key off `visible`).
  useEffect(() => {
    if (visible) {
      setName(character.species);
      setMods(modsFromCharacter(character));
    }
  }, [visible]);

  function handleSave() {
    const racialByKey = Object.fromEntries(
      KEYS.map(k => {
        const n = parseInt(mods[k], 10);
        return [k, isNaN(n) ? 0 : n];
      }),
    ) as Record<CharacteristicKey, number>;
    onChange(applySpeciesPatch(character, name.trim(), racialByKey));
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: t.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.inner}>
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}>
              <Text style={[styles.cancelText, { color: t.colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: t.colors.text }]}>Species</Text>
            <TouchableOpacity onPress={handleSave} style={[styles.hBtn, styles.hBtnRight]}>
              <Text style={[styles.saveText, { color: t.colors.accent }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: t.colors.textMuted }]}>Species name</Text>
            <TextInput
              style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Reiklander, Mountain Dwarf…"
              placeholderTextColor={t.colors.textMuted}
            />

            <Text style={[styles.label, { color: t.colors.textMuted, marginTop: 20 }]}>Racial modifiers</Text>
            <View style={styles.grid}>
              {KEYS.map(k => (
                <View key={k} style={[styles.cell, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.cellLabel, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[k]}</Text>
                  <TextInput
                    style={[styles.cellInput, { color: t.colors.text }]}
                    value={mods[k]}
                    onChangeText={v => setMods(m => ({ ...m, [k]: v }))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  hBtn: { width: 70 },
  hBtnRight: { alignItems: 'flex-end' },
  cancelText: { fontSize: 15 },
  saveText: { fontSize: 15, fontWeight: '600' },
  body: { padding: 20 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  nameInput: { fontSize: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  cellLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  cellInput: { fontSize: 18, fontWeight: '700', minWidth: 50, textAlign: 'right', paddingVertical: 6 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the component is not yet mounted; Task 3 wires it).

- [ ] **Step 3: Commit**

```bash
git add src/components/wfrp4e/SpeciesEditor.tsx
git commit -m "feat(wfrp): SpeciesEditor modal (name + racial modifiers)"
```

---

## Task 3: Header wiring

**Files:**
- Modify: `src/components/wfrp4e/Wfrp4eHeader.tsx`

- [ ] **Step 1: Import the editor + add state**

Add the import after the `TextEditModal` import:

```tsx
import { SpeciesEditor } from '@/components/wfrp4e/SpeciesEditor';
```

Change the `StrField` type from:

```tsx
type StrField = 'name' | 'species' | 'currentCareer' | 'height';
```
to:
```tsx
type StrField = 'name' | 'currentCareer' | 'height';
```

Change the `TITLES` map from:

```tsx
const TITLES: Record<StrField, string> = {
  name: 'Name', species: 'Species', currentCareer: 'Career', height: 'Height',
};
```
to:
```tsx
const TITLES: Record<StrField, string> = {
  name: 'Name', currentCareer: 'Career', height: 'Height',
};
```

After `const [editing, setEditing] = useState<StrField | null>(null);` add:

```tsx
  const [speciesOpen, setSpeciesOpen] = useState(false);
```

- [ ] **Step 2: Point the Species tap at the editor**

Change the species `TouchableOpacity` `onPress` from:

```tsx
        <TouchableOpacity onPress={() => setEditing('species')} activeOpacity={0.7}>
```
to:
```tsx
        <TouchableOpacity onPress={() => setSpeciesOpen(true)} activeOpacity={0.7}>
```

- [ ] **Step 3: Render the editor**

Immediately after the existing `<TextEditModal … />` element (before the closing `</View>`), add:

```tsx
      <SpeciesEditor
        visible={speciesOpen}
        character={character}
        onChange={onChange}
        onClose={() => setSpeciesOpen(false)}
      />
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/Wfrp4eHeader.tsx
git commit -m "feat(wfrp): open SpeciesEditor from the header species field"
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
1. Tapping the **Species** text in the header opens the editor, pre-filled with the
   current species name and racial values (0 for a fresh character).
2. Type a species name + some racial modifiers (e.g. WS 20, Fel 10), Save. The header
   shows the new species name; opening **Details** shows those values in the Racial column
   and the Sum reflects them.
3. The change persists across a page reload.
4. Because racial feeds totals, the Resources "Max wounds" breakdown reflects any S/T/WP
   racial you entered.

Check `preview_console_logs` for errors. Capture a `preview_screenshot` of the editor.

- [ ] **Step 3: Final commit (only if Step 2 required a fix)**

```bash
git add -A
git commit -m "fix(wfrp): species editor review fixes"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 `applySpeciesPatch` → Task 1. ✓
- §2 `SpeciesEditor` modal (name + 10 modifier grid, re-sync on open, save via helper) → Task 2. ✓
- §3 header wiring (species removed from TextEditModal set, tap opens editor) → Task 3. ✓
- §4 out of scope (no presets, no library) — only a blank editor; career/rank untouched. ✓
- §5 tests (sets species + racial, preserves other fields, missing key → 0) → Task 1. ✓
- Acceptance criteria → Task 4. ✓

**Type consistency:** `applySpeciesPatch(character, species, racialByKey)` is called once in
`SpeciesEditor.handleSave`. `SpeciesEditor` props match the `<SpeciesEditor …/>` usage in the
header. `StrField` no longer includes `'species'`, and the species tap no longer calls
`setEditing` — it calls `setSpeciesOpen`. `CHARACTERISTIC_ABBREV`/`CharacteristicKey` are
already exported from `@/types/wfrp4e`.

**Placeholder scan:** none — every code step has complete code.
