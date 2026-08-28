# WFRP Species & Origin (library-backed) Implementation Plan — Phase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Split species from origin; make each a library-backed dropdown (create + autocomplete from previously-entered entries); species applies characteristic modifiers. Nothing official bundled.

**Architecture:** New `origin` field + library types in `wfrp4e.ts`; a `useWfrpLibrary` hook persists species/origin definitions in the `settings` table; `SpeciesPicker`/`OriginPicker` modals (reusing a reworked `SpeciesEditor`) are opened from the header.

**Tech Stack:** React Native 0.85 · Expo SDK 56 · TypeScript · jest-expo · expo-sqlite settings table.

**Spec:** `docs/superpowers/specs/2026-06-22-wfrp-species-origin-design.md`

**Branch:** `feat/wfrp-species-editor` (reworks the open PR #4).

---

## File Structure

- `src/types/wfrp4e.ts` — **modify**: `origin` field, schemaVer 4, migration, default, `WfrpSpeciesDef`/`WfrpOriginDef`, `upsertByName`.
- `src/types/__tests__/wfrp4e.test.ts` — **modify**: `upsertByName` + origin-migration tests; update existing schemaVer assertions 3→4.
- `src/hooks/useWfrpLibrary.ts` — **create**: settings-backed species/origin library hook.
- `src/components/wfrp4e/SpeciesEditor.tsx` — **modify**: rework into an `onSubmit(def)` create/edit form.
- `src/components/wfrp4e/SpeciesPicker.tsx` — **create**: list library species + create-new.
- `src/components/wfrp4e/OriginPicker.tsx` — **create**: list library origins + create-new.
- `src/components/wfrp4e/Wfrp4eHeader.tsx` — **modify**: species + origin taps open the pickers.

Pure logic is unit-tested; UI verified with `tsc` + web preview.

---

## Task 1: Model — origin field, library types, `upsertByName` (TDD)

**Files:** `src/types/wfrp4e.ts`, `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/types/__tests__/wfrp4e.test.ts`:

```ts
import { upsertByName } from '../wfrp4e';

describe('upsertByName', () => {
  test('appends a new item', () => {
    const out = upsertByName([{ name: 'Human' }], { name: 'Dwarf' });
    expect(out.map(x => x.name)).toEqual(['Human', 'Dwarf']);
  });
  test('replaces an existing item case-insensitively, no mutation', () => {
    const input = [{ name: 'Human', v: 1 }];
    const out = upsertByName(input as any, { name: 'human', v: 2 } as any);
    expect(out).toHaveLength(1);
    expect((out[0] as any).v).toBe(2);
    expect((input[0] as any).v).toBe(1); // original unchanged
  });
});

describe('migrateWfrp4eCharacter origin', () => {
  test('adds origin = "" when absent and bumps schemaVer to 4', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 3,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 0, modifier: 0 },
    };
    const m = migrateWfrp4eCharacter(old);
    expect(m.origin).toBe('');
    expect(m.schemaVer).toBe(4);
  });
  test('preserves an existing origin', () => {
    const c = defaultWfrp4eCharacter('T');
    c.origin = 'Reiklander';
    expect(migrateWfrp4eCharacter(c).origin).toBe('Reiklander');
  });
});
```

Also UPDATE any existing assertions in this file that read `expect(...schemaVer).toBe(3)` →
`toBe(4)` (search the file; the #37 wounds-migration tests assert 3).

- [ ] **Step 2: Run, verify fail**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: FAIL — `upsertByName` not exported; migration returns schemaVer 3 / no origin.

- [ ] **Step 3: Edit `src/types/wfrp4e.ts`**

3a. Change the type's `schemaVer: 3;` → `schemaVer: 4;`.

3b. Add an `origin` field right after the `species: string;` line:
```ts
  species: string;
  origin: string;
```

3c. Add library types + helper near the other exports (after `applySpeciesPatch`):
```ts
export type WfrpSpeciesDef = { name: string; modifiers: Record<CharacteristicKey, number> };
export type WfrpOriginDef = { name: string };

export function upsertByName<T extends { name: string }>(list: T[], item: T): T[] {
  const i = list.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase());
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}
```

3d. In `migrateWfrp4eCharacter`, change the final return from:
```ts
  return { ...raw, characteristics, wounds, schemaVer: 3 } as Wfrp4eCharacter;
```
to:
```ts
  return { ...raw, characteristics, wounds, origin: raw.origin ?? '', schemaVer: 4 } as Wfrp4eCharacter;
```

3e. In `defaultWfrp4eCharacter`: change `schemaVer: 3,` → `schemaVer: 4,` and add `origin: '',`
right after the `species: '',` line.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts`
Expected: PASS (all green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: There will be a KNOWN error in `Wfrp4eHeader.tsx` (it still renders the old
`<SpeciesEditor … character … onChange …/>` whose props change in Task 4, and references
`speciesOpen`). That's fixed in Task 6. Confirm no OTHER unexpected errors. Do NOT edit the
header here.

- [ ] **Step 6: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): origin field + species/origin library types"
```

---

## Task 2: `useWfrpLibrary` hook

**Files:** Create `src/hooks/useWfrpLibrary.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/queries';
import { upsertByName } from '@/types/wfrp4e';
import type { WfrpSpeciesDef, WfrpOriginDef } from '@/types/wfrp4e';

const SPECIES_KEY = 'wfrp_species_library';
const ORIGIN_KEY = 'wfrp_origin_library';

export function useWfrpLibrary() {
  const db = useSQLiteContext();
  const [species, setSpecies] = useState<WfrpSpeciesDef[]>([]);
  const [origins, setOrigins] = useState<WfrpOriginDef[]>([]);

  useEffect(() => {
    let alive = true;
    getSetting(db, SPECIES_KEY).then(v => { if (alive && v) setSpecies(JSON.parse(v)); });
    getSetting(db, ORIGIN_KEY).then(v => { if (alive && v) setOrigins(JSON.parse(v)); });
    return () => { alive = false; };
  }, [db]);

  const addSpecies = useCallback((def: WfrpSpeciesDef) => {
    setSpecies(prev => {
      const next = upsertByName(prev, def);
      setSetting(db, SPECIES_KEY, JSON.stringify(next));
      return next;
    });
  }, [db]);

  const addOrigin = useCallback((def: WfrpOriginDef) => {
    setOrigins(prev => {
      const next = upsertByName(prev, def);
      setSetting(db, ORIGIN_KEY, JSON.stringify(next));
      return next;
    });
  }, [db]);

  return { species, origins, addSpecies, addOrigin };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: same known `Wfrp4eHeader.tsx` error as Task 1; nothing new from this file.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWfrpLibrary.ts
git commit -m "feat(wfrp): useWfrpLibrary settings-backed species/origin store"
```

---

## Task 3: Rework `SpeciesEditor` into an `onSubmit` form

**Files:** Replace the entire contents of `src/components/wfrp4e/SpeciesEditor.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
import type { CharacteristicKey, WfrpSpeciesDef } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
const ZERO: Record<CharacteristicKey, number> = Object.fromEntries(KEYS.map(k => [k, 0])) as Record<CharacteristicKey, number>;

type Props = {
  visible: boolean;
  initialName?: string;
  initialModifiers?: Record<CharacteristicKey, number>;
  onSubmit: (def: WfrpSpeciesDef) => void;
  onClose: () => void;
};

function toStrings(m: Record<CharacteristicKey, number>): Record<CharacteristicKey, string> {
  return Object.fromEntries(KEYS.map(k => [k, String(m[k] ?? 0)])) as Record<CharacteristicKey, string>;
}

export function SpeciesEditor({ visible, initialName = '', initialModifiers, onSubmit, onClose }: Props) {
  const t = useTheme();
  const [name, setName] = useState(initialName);
  const [mods, setMods] = useState<Record<CharacteristicKey, string>>(() => toStrings(initialModifiers ?? ZERO));

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setMods(toStrings(initialModifiers ?? ZERO));
    }
  }, [visible]);

  function handleSave() {
    const modifiers = Object.fromEntries(
      KEYS.map(k => {
        const n = parseInt(mods[k], 10);
        return [k, isNaN(n) ? 0 : n];
      }),
    ) as Record<CharacteristicKey, number>;
    onSubmit({ name: name.trim(), modifiers });
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
            <Text style={[styles.title, { color: t.colors.text }]}>New species</Text>
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
              placeholder="e.g. Human, Dwarf, Wood Elf…"
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

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` (known header error only).
- [ ] **Step 3: Commit**
```bash
git add src/components/wfrp4e/SpeciesEditor.tsx
git commit -m "refactor(wfrp): SpeciesEditor returns a def via onSubmit"
```

---

## Task 4: `SpeciesPicker`

**Files:** Create `src/components/wfrp4e/SpeciesPicker.tsx`:

```tsx
import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { SpeciesEditor } from '@/components/wfrp4e/SpeciesEditor';
import { useWfrpLibrary } from '@/hooks/useWfrpLibrary';
import { applySpeciesPatch, CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, WfrpSpeciesDef, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

function summary(def: WfrpSpeciesDef): string {
  return KEYS.filter(k => def.modifiers[k]).map(k => `${CHARACTERISTIC_ABBREV[k]} ${def.modifiers[k] > 0 ? '+' : ''}${def.modifiers[k]}`).join('  ') || 'no modifiers';
}

export function SpeciesPicker({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const { species, addSpecies } = useWfrpLibrary();
  const [editing, setEditing] = useState(false);

  function applyDef(def: WfrpSpeciesDef) {
    onChange(applySpeciesPatch(character, def.name, def.modifiers));
    onClose();
  }

  function handleCreate(def: WfrpSpeciesDef) {
    addSpecies(def);
    onChange(applySpeciesPatch(character, def.name, def.modifiers));
    setEditing(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>Species</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {species.length === 0 && (
            <Text style={[styles.empty, { color: t.colors.textMuted }]}>No species yet. Create one below.</Text>
          )}
          {species.map(def => (
            <TouchableOpacity
              key={def.name}
              style={[styles.row, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => applyDef(def)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowName, { color: t.colors.text }]}>{def.name}</Text>
              <Text style={[styles.rowSummary, { color: t.colors.textMuted }]} numberOfLines={1}>{summary(def)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.createBtn, { borderColor: t.colors.accent }]}
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={t.colors.accent} />
            <Text style={[styles.createText, { color: t.colors.accent }]}>Create new species…</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <SpeciesEditor
        visible={editing}
        onSubmit={handleCreate}
        onClose={() => setEditing(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  row: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '700' },
  rowSummary: { fontSize: 12 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 4 },
  createText: { fontSize: 14, fontWeight: '600' },
});
```

- [ ] Typecheck (known header error only). Commit:
```bash
git add src/components/wfrp4e/SpeciesPicker.tsx
git commit -m "feat(wfrp): SpeciesPicker (library list + create)"
```

---

## Task 5: `OriginPicker`

**Files:** Create `src/components/wfrp4e/OriginPicker.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useWfrpLibrary } from '@/hooks/useWfrpLibrary';
import type { Wfrp4eCharacter, WfrpOriginDef } from '@/types/wfrp4e';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

export function OriginPicker({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const { origins, addOrigin } = useWfrpLibrary();
  const [draft, setDraft] = useState('');

  useEffect(() => { if (visible) setDraft(''); }, [visible]);

  function applyDef(def: WfrpOriginDef) {
    onChange({ origin: def.name });
    onClose();
  }

  function create() {
    const name = draft.trim();
    if (!name) return;
    addOrigin({ name });
    onChange({ origin: name });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>Origin</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {origins.length === 0 && (
            <Text style={[styles.empty, { color: t.colors.textMuted }]}>No origins yet. Add one below.</Text>
          )}
          {origins.map(def => (
            <TouchableOpacity
              key={def.name}
              style={[styles.row, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => applyDef(def)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowName, { color: t.colors.text }]}>{def.name}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.label, { color: t.colors.textMuted }]}>Create new origin</Text>
          <View style={styles.createRow}>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={draft}
              onChangeText={setDraft}
              placeholder="e.g. Reiklander, Middenheimer…"
              placeholderTextColor={t.colors.textMuted}
              onSubmitEditing={create}
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: t.colors.accent }]} onPress={create} activeOpacity={0.7}>
              <Plus size={16} color={t.colors.accentText} />
              <Text style={[styles.addText, { color: t.colors.accentText }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  row: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowName: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 4 },
  createRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  addText: { fontSize: 14, fontWeight: '700' },
});
```

- [ ] Typecheck (known header error only). Commit:
```bash
git add src/components/wfrp4e/OriginPicker.tsx
git commit -m "feat(wfrp): OriginPicker (library list + create)"
```

---

## Task 6: Header wiring

**Files:** `src/components/wfrp4e/Wfrp4eHeader.tsx`

The header currently imports `SpeciesEditor`, has a `speciesOpen` state, a species
`TouchableOpacity` calling `setSpeciesOpen(true)`, and renders `<SpeciesEditor visible={speciesOpen} character … onChange … onClose … />`.

- [ ] **Step 1: Swap imports**

Replace:
```tsx
import { SpeciesEditor } from '@/components/wfrp4e/SpeciesEditor';
```
with:
```tsx
import { SpeciesPicker } from '@/components/wfrp4e/SpeciesPicker';
import { OriginPicker } from '@/components/wfrp4e/OriginPicker';
```

- [ ] **Step 2: State**

Replace:
```tsx
  const [speciesOpen, setSpeciesOpen] = useState(false);
```
with:
```tsx
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
```

- [ ] **Step 3: Meta row — species + origin taps**

Replace the species `TouchableOpacity` block:
```tsx
        <TouchableOpacity onPress={() => setSpeciesOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, { color: t.colors.textSecondary }]}>
            {character.species || 'Species'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
```
with (adds an Origin tap between species and career):
```tsx
        <TouchableOpacity onPress={() => setSpeciesPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, { color: t.colors.textSecondary }]}>
            {character.species || 'Species'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
        <TouchableOpacity onPress={() => setOriginPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, { color: t.colors.textSecondary }]}>
            {character.origin || 'Origin'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
```

- [ ] **Step 4: Render the pickers**

Replace the `<SpeciesEditor … />` element:
```tsx
      <SpeciesEditor
        visible={speciesOpen}
        character={character}
        onChange={onChange}
        onClose={() => setSpeciesOpen(false)}
      />
```
with:
```tsx
      <SpeciesPicker
        visible={speciesPickerOpen}
        character={character}
        onChange={onChange}
        onClose={() => setSpeciesPickerOpen(false)}
      />
      <OriginPicker
        visible={originPickerOpen}
        character={character}
        onChange={onChange}
        onClose={() => setOriginPickerOpen(false)}
      />
```

- [ ] **Step 5: Typecheck + tests**

Run: `npx tsc --noEmit` → MUST be clean now.
Run: `npm test` → all pass.

- [ ] **Step 6: Commit**
```bash
git add src/components/wfrp4e/Wfrp4eHeader.tsx
git commit -m "feat(wfrp): species + origin pickers in the header"
```

---

## Task 7: Verify against acceptance criteria

- [ ] **Step 1:** `npx tsc --noEmit && npm test` — clean + all pass.
- [ ] **Step 2: Web preview** (`ttrp-web`). On a WFRP character:
  1. Header shows separate **Species** and **Origin** taps.
  2. Tap Species → picker (empty first) → "Create new species…" → enter name + modifiers →
     Save → species name shows in header, racial column filled, detail Sum reflects it.
  3. Reopen Species picker → the created species is listed; create a second character and
     confirm it's offered there too (library persists).
  4. Tap Origin → add an origin name → it shows in the header; reopen → listed.
  5. Reload the page → species, origin, and racial all persist.
  Check `preview_console_logs`; capture a `preview_screenshot` of each picker.
- [ ] **Step 3:** Final fix commit only if needed.

---

## Self-Review (plan author)

**Spec coverage:** §1 model/migration/types/upsertByName → T1; §2 hook → T2; §3.1 editor rework → T3; §3.2 SpeciesPicker → T4; §3.3 OriginPicker → T5; §4 header → T6; §5 tests → T1; §6 out-of-scope (no skills/talents granting, no bundled data) honored. Acceptance → T7.

**Type consistency:** `WfrpSpeciesDef`/`WfrpOriginDef` defined in T1 and consumed identically in the hook (T2) and pickers (T4/T5). `SpeciesEditor` new props (`onSubmit`/`initial*`) match its only caller `SpeciesPicker`. Header renders `SpeciesPicker`/`OriginPicker` with `{visible,character,onChange,onClose}` matching their Props. `schemaVer` literal `4` in type, default, migration.

**Placeholder scan:** none — all code complete.
