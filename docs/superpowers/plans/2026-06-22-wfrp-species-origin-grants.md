# WFRP Species/Origin Granted Skills & Talents (#38 Phase 2) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Species/origin defs grant skills + talents; applying merges them into the character (dedup by name).

**Spec:** `docs/superpowers/specs/2026-06-22-wfrp-species-origin-grants-design.md`
**Branch:** `feat/wfrp-species-editor` (extends the open PR #4).

---

## Task P1: types + merge/apply helpers (TDD)

**Files:** `src/types/wfrp4e.ts`, `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: failing tests** — append to the test file:

```ts
import { mergeGrantedSkills, mergeGrantedTalents, applySpecies, applyOrigin } from '../wfrp4e';

describe('mergeGrantedSkills', () => {
  test('adds new skill with id/characteristic, skips existing (case-insensitive), no mutation', () => {
    let n = 0; const makeId = () => `id${++n}`;
    const existing = [{ id: 'x', name: 'Melee (Basic)', characteristic: 'ws' as const, advances: 5, isAdvanced: false }];
    const out = mergeGrantedSkills(existing, [
      { name: 'melee (basic)', characteristic: 'ws' },
      { name: 'Dodge', characteristic: 'ag' },
    ], makeId);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ id: 'id1', name: 'Dodge', characteristic: 'ag', advances: 0, isAdvanced: false });
    expect(existing).toHaveLength(1);
  });
});

describe('mergeGrantedTalents', () => {
  test('adds new (timesTaken 1), skips existing, ignores blanks', () => {
    let n = 0; const makeId = () => `t${++n}`;
    const existing = [{ id: 'a', name: 'Suave', timesTaken: 1, description: '' }];
    const out = mergeGrantedTalents(existing, ['Suave', '  ', 'Savvy'], makeId);
    expect(out.map(t => t.name)).toEqual(['Suave', 'Savvy']);
    expect(out[1]).toEqual({ id: 't1', name: 'Savvy', timesTaken: 1, description: '' });
  });
});

describe('applySpecies / applyOrigin', () => {
  test('applySpecies sets species, racial, and merges grants', () => {
    let n = 0; const makeId = () => `g${++n}`;
    const char = defaultWfrp4eCharacter('Test');
    const def = {
      name: 'Dwarf',
      modifiers: { ws: 30, bs: 20, s: 20, t: 30, i: 20, ag: 10, dex: 30, int: 20, wp: 40, fel: 10 } as Record<import('../wfrp4e').CharacteristicKey, number>,
      skills: [{ name: 'Trade', characteristic: 'dex' as const }],
      talents: ['Night Vision'],
    };
    const patch = applySpecies(char, def, makeId);
    expect(patch.species).toBe('Dwarf');
    expect(patch.characteristics!.t.racial).toBe(30);
    expect(patch.skills!.some(s => s.name === 'Trade')).toBe(true);
    expect(patch.talents!.some(t => t.name === 'Night Vision')).toBe(true);
  });

  test('applyOrigin sets origin + merges grants, no characteristic change', () => {
    let n = 0; const makeId = () => `o${++n}`;
    const char = defaultWfrp4eCharacter('Test');
    const patch = applyOrigin(char, { name: 'Reiklander', skills: [{ name: 'Gossip', characteristic: 'fel' }], talents: [] }, makeId);
    expect(patch.origin).toBe('Reiklander');
    expect(patch.skills!.some(s => s.name === 'Gossip')).toBe(true);
    expect(patch.characteristics).toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run `npx jest src/types/__tests__/wfrp4e.test.ts` → FAIL (not exported).

- [ ] **Step 3:** Edit `src/types/wfrp4e.ts`:
  - Add `export type GrantedSkill = { name: string; characteristic: CharacteristicKey };`
  - Change `WfrpSpeciesDef` to `{ name: string; modifiers: Record<CharacteristicKey, number>; skills: GrantedSkill[]; talents: string[] }`.
  - Change `WfrpOriginDef` to `{ name: string; skills: GrantedSkill[]; talents: string[] }`.
  - Add the four functions exactly as written in spec §1 (`mergeGrantedSkills`, `mergeGrantedTalents`, `applySpecies`, `applyOrigin`). Place them after `applySpeciesPatch`.

- [ ] **Step 4:** Run the test file → PASS.

- [ ] **Step 5:** `npx tsc --noEmit`. KNOWN errors will appear in `SpeciesEditor.tsx` (its `onSubmit` builds `{ name, modifiers }` — now missing `skills`/`talents`) and `OriginPicker.tsx` (builds `{ name }`). These are fixed in P3/P4. Confirm no other unexpected errors.

- [ ] **Step 6:** Commit:
```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "feat(wfrp): granted skills/talents types + apply helpers"
```

---

## Task P2: `GrantedListsFields` component

**Files:** Create `src/components/wfrp4e/GrantedListsFields.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
import type { CharacteristicKey, GrantedSkill } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

export type GrantedValue = { skills: GrantedSkill[]; talents: string[] };
type Props = { value: GrantedValue; onChange: (next: GrantedValue) => void };

export function GrantedListsFields({ value, onChange }: Props) {
  const t = useTheme();
  const [skillName, setSkillName] = useState('');
  const [skillChar, setSkillChar] = useState<CharacteristicKey>('ws');
  const [talentName, setTalentName] = useState('');

  function addSkill() {
    const name = skillName.trim();
    if (!name) return;
    onChange({ ...value, skills: [...value.skills, { name, characteristic: skillChar }] });
    setSkillName('');
    setSkillChar('ws');
  }
  function removeSkill(i: number) {
    onChange({ ...value, skills: value.skills.filter((_, idx) => idx !== i) });
  }
  function cycleChar() {
    setSkillChar(prev => KEYS[(KEYS.indexOf(prev) + 1) % KEYS.length]);
  }
  function addTalent() {
    const name = talentName.trim();
    if (!name) return;
    onChange({ ...value, talents: [...value.talents, name] });
    setTalentName('');
  }
  function removeTalent(i: number) {
    onChange({ ...value, talents: value.talents.filter((_, idx) => idx !== i) });
  }

  return (
    <View>
      <Text style={[styles.label, { color: t.colors.textMuted }]}>Granted skills</Text>
      {value.skills.map((s, i) => (
        <View key={i} style={[styles.listRow, { borderColor: t.colors.border }]}>
          <Text style={[styles.listText, { color: t.colors.text }]} numberOfLines={1}>{s.name}</Text>
          <Text style={[styles.charTag, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[s.characteristic]}</Text>
          <TouchableOpacity onPress={() => removeSkill(i)} hitSlop={8}><X size={16} color={t.colors.danger} /></TouchableOpacity>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
          value={skillName} onChangeText={setSkillName}
          placeholder="Skill name" placeholderTextColor={t.colors.textMuted}
        />
        <TouchableOpacity onPress={cycleChar} style={[styles.charBtn, { borderColor: t.colors.border }]} activeOpacity={0.7}>
          <Text style={[styles.charBtnText, { color: t.colors.textSecondary }]}>{CHARACTERISTIC_ABBREV[skillChar]}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={addSkill} style={[styles.addBtn, { backgroundColor: t.colors.accent }]} activeOpacity={0.7}>
          <Plus size={16} color={t.colors.accentText} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: t.colors.textMuted, marginTop: 16 }]}>Granted talents</Text>
      {value.talents.map((name, i) => (
        <View key={i} style={[styles.listRow, { borderColor: t.colors.border }]}>
          <Text style={[styles.listText, { color: t.colors.text }]} numberOfLines={1}>{name}</Text>
          <TouchableOpacity onPress={() => removeTalent(i)} hitSlop={8}><X size={16} color={t.colors.danger} /></TouchableOpacity>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
          value={talentName} onChangeText={setTalentName}
          placeholder="Talent name" placeholderTextColor={t.colors.textMuted}
        />
        <TouchableOpacity onPress={addTalent} style={[styles.addBtn, { backgroundColor: t.colors.accent }]} activeOpacity={0.7}>
          <Plus size={16} color={t.colors.accentText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  listText: { flex: 1, fontSize: 14 },
  charTag: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, fontSize: 15, padding: 10, borderRadius: 8, borderWidth: 1 },
  charBtn: { minWidth: 48, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  charBtnText: { fontSize: 13, fontWeight: '700' },
  addBtn: { width: 44, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] Typecheck (known P1 errors only). Commit:
```bash
git add src/components/wfrp4e/GrantedListsFields.tsx
git commit -m "feat(wfrp): GrantedListsFields editor (skills + talents)"
```

---

## Task P3: `SpeciesEditor` — add grants

**Files:** Replace `src/components/wfrp4e/SpeciesEditor.tsx` entirely with:

```tsx
import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { GrantedListsFields, type GrantedValue } from '@/components/wfrp4e/GrantedListsFields';
import { CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
import type { CharacteristicKey, WfrpSpeciesDef, GrantedSkill } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
const ZERO: Record<CharacteristicKey, number> = Object.fromEntries(KEYS.map(k => [k, 0])) as Record<CharacteristicKey, number>;

type Props = {
  visible: boolean;
  initialName?: string;
  initialModifiers?: Record<CharacteristicKey, number>;
  initialSkills?: GrantedSkill[];
  initialTalents?: string[];
  onSubmit: (def: WfrpSpeciesDef) => void;
  onClose: () => void;
};

function toStrings(m: Record<CharacteristicKey, number>): Record<CharacteristicKey, string> {
  return Object.fromEntries(KEYS.map(k => [k, String(m[k] ?? 0)])) as Record<CharacteristicKey, string>;
}

export function SpeciesEditor({ visible, initialName = '', initialModifiers, initialSkills, initialTalents, onSubmit, onClose }: Props) {
  const t = useTheme();
  const [name, setName] = useState(initialName);
  const [mods, setMods] = useState<Record<CharacteristicKey, string>>(() => toStrings(initialModifiers ?? ZERO));
  const [granted, setGranted] = useState<GrantedValue>(() => ({ skills: initialSkills ?? [], talents: initialTalents ?? [] }));

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setMods(toStrings(initialModifiers ?? ZERO));
      setGranted({ skills: initialSkills ?? [], talents: initialTalents ?? [] });
    }
  }, [visible]);

  function handleSave() {
    const modifiers = Object.fromEntries(
      KEYS.map(k => {
        const n = parseInt(mods[k], 10);
        return [k, isNaN(n) ? 0 : n];
      }),
    ) as Record<CharacteristicKey, number>;
    onSubmit({ name: name.trim(), modifiers, skills: granted.skills, talents: granted.talents });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: t.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              value={name} onChangeText={setName}
              placeholder="e.g. Human, Dwarf, Wood Elf…" placeholderTextColor={t.colors.textMuted}
            />

            <Text style={[styles.label, { color: t.colors.textMuted, marginTop: 20 }]}>Racial modifiers</Text>
            <View style={styles.grid}>
              {KEYS.map(k => (
                <View key={k} style={[styles.cell, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.cellLabel, { color: t.colors.textMuted }]}>{CHARACTERISTIC_ABBREV[k]}</Text>
                  <TextInput
                    style={[styles.cellInput, { color: t.colors.text }]}
                    value={mods[k]} onChangeText={v => setMods(m => ({ ...m, [k]: v }))}
                    keyboardType="number-pad" selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <View style={{ marginTop: 20 }}>
              <GrantedListsFields value={granted} onChange={setGranted} />
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
  body: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  nameInput: { fontSize: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  cellLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  cellInput: { fontSize: 18, fontWeight: '700', minWidth: 50, textAlign: 'right', paddingVertical: 6 },
});
```

- [ ] Typecheck. KNOWN remaining error: `OriginPicker.tsx` (builds `{ name }`) — fixed in P4. Commit:
```bash
git add src/components/wfrp4e/SpeciesEditor.tsx
git commit -m "feat(wfrp): species editor grants skills + talents"
```

---

## Task P4: `OriginEditor` + `OriginPicker` rework

- [ ] **Step 1:** Create `src/components/wfrp4e/OriginEditor.tsx`:

```tsx
import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { GrantedListsFields, type GrantedValue } from '@/components/wfrp4e/GrantedListsFields';
import type { WfrpOriginDef, GrantedSkill } from '@/types/wfrp4e';

type Props = {
  visible: boolean;
  initialName?: string;
  initialSkills?: GrantedSkill[];
  initialTalents?: string[];
  onSubmit: (def: WfrpOriginDef) => void;
  onClose: () => void;
};

export function OriginEditor({ visible, initialName = '', initialSkills, initialTalents, onSubmit, onClose }: Props) {
  const t = useTheme();
  const [name, setName] = useState(initialName);
  const [granted, setGranted] = useState<GrantedValue>(() => ({ skills: initialSkills ?? [], talents: initialTalents ?? [] }));

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setGranted({ skills: initialSkills ?? [], talents: initialTalents ?? [] });
    }
  }, [visible]);

  function handleSave() {
    onSubmit({ name: name.trim(), skills: granted.skills, talents: granted.talents });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: t.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.inner}>
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}>
              <Text style={[styles.cancelText, { color: t.colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: t.colors.text }]}>New origin</Text>
            <TouchableOpacity onPress={handleSave} style={[styles.hBtn, styles.hBtnRight]}>
              <Text style={[styles.saveText, { color: t.colors.accent }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: t.colors.textMuted }]}>Origin name</Text>
            <TextInput
              style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Reiklander, Middenheimer…" placeholderTextColor={t.colors.textMuted}
            />
            <View style={{ marginTop: 20 }}>
              <GrantedListsFields value={granted} onChange={setGranted} />
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
  body: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  nameInput: { fontSize: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
});
```

- [ ] **Step 2:** Replace `src/components/wfrp4e/OriginPicker.tsx` entirely with:

```tsx
import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { OriginEditor } from '@/components/wfrp4e/OriginEditor';
import { useWfrpLibrary } from '@/hooks/useWfrpLibrary';
import { applyOrigin } from '@/types/wfrp4e';
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
  const [editing, setEditing] = useState(false);

  function applyDef(def: WfrpOriginDef) {
    onChange(applyOrigin(character, def, uuidv4));
    onClose();
  }

  function handleCreate(def: WfrpOriginDef) {
    addOrigin(def);
    onChange(applyOrigin(character, def, uuidv4));
    setEditing(false);
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

        <ScrollView contentContainerStyle={styles.body}>
          {origins.length === 0 && (
            <Text style={[styles.empty, { color: t.colors.textMuted }]}>No origins yet. Create one below.</Text>
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

          <TouchableOpacity
            style={[styles.createBtn, { borderColor: t.colors.accent }]}
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={t.colors.accent} />
            <Text style={[styles.createText, { color: t.colors.accent }]}>Create new origin…</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <OriginEditor
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
  row: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowName: { fontSize: 16, fontWeight: '700' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 4 },
  createText: { fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 3:** Typecheck (now only the SpeciesPicker `applySpeciesPatch` usage remains valid — but P5 changes it to `applySpecies`; if SpeciesPicker still compiles, tsc may already be clean here). Commit:
```bash
git add src/components/wfrp4e/OriginEditor.tsx src/components/wfrp4e/OriginPicker.tsx
git commit -m "feat(wfrp): origin editor + picker grant skills/talents"
```

---

## Task P5: `SpeciesPicker` — apply grants

**Files:** `src/components/wfrp4e/SpeciesPicker.tsx`

- [ ] **Step 1:** Change the import line:
```tsx
import { applySpeciesPatch, CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
```
to:
```tsx
import { applySpecies, CHARACTERISTIC_ABBREV } from '@/types/wfrp4e';
import { v4 as uuidv4 } from 'uuid';
```

- [ ] **Step 2:** Replace the two apply calls. In `applyDef`:
```tsx
    onChange(applySpeciesPatch(character, def.name, def.modifiers));
```
→
```tsx
    onChange(applySpecies(character, def, uuidv4));
```
In `handleCreate`:
```tsx
    onChange(applySpeciesPatch(character, def.name, def.modifiers));
```
→
```tsx
    onChange(applySpecies(character, def, uuidv4));
```

- [ ] **Step 3:** `npx tsc --noEmit` → MUST be clean. `npm test` → all pass. Commit:
```bash
git add src/components/wfrp4e/SpeciesPicker.tsx
git commit -m "feat(wfrp): apply species grants on pick/create"
```

---

## Task P6: Verify

- [ ] `npx tsc --noEmit && npm test` → clean + pass.
- [ ] Web preview (`ttrp-web`), on a WFRP character:
  1. Tap Species → Create new → set name + a modifier + a granted skill (name + cycle its
     characteristic) + a granted talent → Save. Confirm the species applies: racial set,
     and the **Skills** + **Talents** sections now contain the granted entries.
  2. Tap Origin → Create new → add a granted skill + talent → Save. Confirm those entries
     appear in Skills/Talents and the origin name shows in the header.
  3. Re-apply the same species → no duplicate skills/talents (dedup).
  4. Reload → library defs (with grants) persist; the applied skills/talents persist.
  Check console; screenshot Skills/Talents after applying.
- [ ] Final fix commit only if needed.

---

## Self-Review (plan author)

**Spec coverage:** §1 types+helpers → P1; §2 GrantedListsFields → P2; §3 SpeciesEditor → P3; §4 OriginEditor+OriginPicker → P4; §5 SpeciesPicker → P5; §7 tests → P1. Acceptance → P6.

**Type consistency:** `GrantedSkill`, extended `WfrpSpeciesDef`/`WfrpOriginDef` defined in P1; `GrantedListsFields` `GrantedValue` consumed by both editors (P3/P4); `applySpecies`/`applyOrigin` called with `uuidv4` in the pickers (P5/P4). `SpeciesEditor`/`OriginEditor` `onSubmit` return the full defs with `skills`/`talents`. Cross-task known tsc errors are sequenced to resolve by P5.

**Placeholder scan:** none.
