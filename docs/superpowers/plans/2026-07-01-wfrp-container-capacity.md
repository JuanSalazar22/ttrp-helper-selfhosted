# WFRP Container Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let WFRP trappings (backpacks, sacks, sling bags, etc.) carry an optional `capacity` value that, when the item is equipped, adds to the character's max encumbrance — on top of the existing "equipped items count −1 Enc" discount.

**Architecture:** Additive optional field (`capacity?: number`) on the existing `Wfrp4eCharacter['trappings']` array entry — no new list, no schema version bump. `encumbranceMaxValue` sums equipped items' capacity alongside SB + TB + modifier; everything downstream (`encumbranceLevel`, synthetic Encumbered debuff, `effectiveMovement`) picks it up automatically because they all read through `encumbranceMaxValue`. The Trappings UI gets a Capacity input in the row modal, a `Cap +N` badge on the row, and a static name→capacity lookup so picking a known container (Backpack, Sack, …) from "Search the book" prefills it.

**Tech Stack:** TypeScript (strict), React Native components, jest-expo for unit tests. No new dependencies.

**Homebrew note:** This is **not RAW** — Core WFRP 4e containers have an Enc value but no canonical capacity mechanic. Confirmed via a rules check against the bundled `src/data/wfrp-content/trapping.json` content (Backpack, Sack, Large Sack, Sling Bag, Pouch, Saddlebags all list only `enc`, no capacity-like field). Design was validated with the user in the 2026-07-01 brainstorming session; recorded in [TODO.md](../../../TODO.md) under "Near-term features."

---

### Task 1: Data model — `capacity` field on trappings

**Files:**
- Modify: `src/types/wfrp4e.ts:109-116` (the `trappings` array type on `Wfrp4eCharacter`)
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the other `migrateWfrp4eCharacter — equipped` tests (after the `describe('migrateWfrp4eCharacter — equipped', ...)` block, which ends around line 850 — find it with `grep -n "describe('migrateWfrp4eCharacter — equipped'" src/types/__tests__/wfrp4e.test.ts` and insert immediately after its closing `});`):

```typescript
describe('migrateWfrp4eCharacter — trapping capacity passthrough', () => {
  test('capacity survives migration unchanged when present', () => {
    const raw = {
      ...defaultWfrp4eCharacter('T'),
      trappings: [{ id: 't1', name: 'Backpack', encumbrance: 2, qty: 1, equipped: true, capacity: 2 }],
    };
    const migrated = migrateWfrp4eCharacter(raw);
    expect(migrated.trappings[0].capacity).toBe(2);
  });

  test('capacity is undefined when absent (not defaulted to 0)', () => {
    const raw = {
      ...defaultWfrp4eCharacter('T'),
      trappings: [{ id: 't1', name: 'Rope', encumbrance: 1, qty: 1, equipped: false }],
    };
    const migrated = migrateWfrp4eCharacter(raw);
    expect(migrated.trappings[0].capacity).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- wfrp4e.test.ts -t "trapping capacity passthrough"`
Expected: FAIL — TypeScript compile error or `capacity` not recognized as a valid property (jest-expo runs through ts-jest, so an invalid object-literal property on a typed array will fail at the "capacity survives migration unchanged" test's construction of `raw`, since `trappings` isn't yet typed to allow `capacity`).

- [ ] **Step 3: Add `capacity` to the type**

In `src/types/wfrp4e.ts`, change the `trappings` field (currently lines 109–116):

```typescript
  trappings: Array<{
    id: string;
    name: string;
    encumbrance: number;
    qty: number;
    notes?: string;
    equipped: boolean;
  }>;
```

to:

```typescript
  trappings: Array<{
    id: string;
    name: string;
    encumbrance: number;
    qty: number;
    notes?: string;
    equipped: boolean;
    // Container capacity (homebrew): when equipped, adds to encumbranceMaxValue.
    // Optional — most trappings aren't containers. See encumbranceMaxValue below.
    capacity?: number;
  }>;
```

No changes needed to `migrateWfrp4eCharacter` or `withEquipped` — both already spread the raw object (`{...x, equipped: ...}`), so `capacity` passes through untouched when present and stays `undefined` when absent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- wfrp4e.test.ts -t "trapping capacity passthrough"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "feat(wfrp4e): add optional capacity field to trappings"
```

---

### Task 2: Derived helper — `encumbranceMaxValue` counts equipped container capacity

**Files:**
- Modify: `src/types/wfrp4e.ts:223-231` (`encumbranceMaxValue`)
- Test: `src/types/__tests__/wfrp4e.test.ts:186-194` (`describe('encumbranceMaxValue', ...)`)

- [ ] **Step 1: Write the failing tests**

Replace the existing `encumbranceMaxValue` describe block (lines 186–194):

```typescript
describe('encumbranceMaxValue', () => {
  test('SB + TB + modifier', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    c.encumbranceModifier = 2;
    expect(encumbranceMaxValue(c)).toBe(3 + 4 + 2);
  });
});
```

with:

```typescript
describe('encumbranceMaxValue', () => {
  test('SB + TB + modifier', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    c.encumbranceModifier = 2;
    expect(encumbranceMaxValue(c)).toBe(3 + 4 + 2);
  });

  test('equipped container capacity is added on top', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    c.trappings = [
      { id: 't1', name: 'Backpack', encumbrance: 2, qty: 1, equipped: true, capacity: 2 },
    ];
    expect(encumbranceMaxValue(c)).toBe(3 + 4 + 2);
  });

  test('unequipped container capacity does NOT count', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    c.trappings = [
      { id: 't1', name: 'Backpack', encumbrance: 2, qty: 1, equipped: false, capacity: 2 },
    ];
    expect(encumbranceMaxValue(c)).toBe(3 + 4);
  });

  test('multiple equipped containers stack; non-container trappings ignored', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 };  // TB 3
    c.trappings = [
      { id: 't1', name: 'Backpack', encumbrance: 2, qty: 1, equipped: true, capacity: 2 },
      { id: 't2', name: 'Sling Bag', encumbrance: 1, qty: 1, equipped: true, capacity: 1 },
      { id: 't3', name: 'Rope', encumbrance: 1, qty: 1, equipped: true },  // no capacity field
    ];
    expect(encumbranceMaxValue(c)).toBe(3 + 3 + 2 + 1);
  });

  test('capacity 0 contributes nothing (explicit non-container)', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 };  // TB 3
    c.trappings = [
      { id: 't1', name: 'Pouch', encumbrance: 0, qty: 1, equipped: true, capacity: 0 },
    ];
    expect(encumbranceMaxValue(c)).toBe(3 + 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- wfrp4e.test.ts -t "encumbranceMaxValue"`
Expected: FAIL — the 4 new tests fail because `encumbranceMaxValue` doesn't read `capacity` yet (e.g. "equipped container capacity is added on top" expects `9` but gets `7`).

- [ ] **Step 3: Implement**

In `src/types/wfrp4e.ts`, replace `encumbranceMaxValue` (currently lines 223–231):

```typescript
/**
 * Max Encumbrance a character can carry before penalties (WFRP4e): Strength Bonus +
 * Toughness Bonus, plus a custom modifier (e.g. for a Mule, cart, or homebrew).
 * Uses `baseCharacteristicBonus` to avoid pulling the synthetic Encumbered buff into
 * its own derivation.
 */
export function encumbranceMaxValue(char: Wfrp4eCharacter): number {
  return baseCharacteristicBonus(char, 's') + baseCharacteristicBonus(char, 't') + (char.encumbranceModifier ?? 0);
}
```

with:

```typescript
/** Sum of `capacity` on every equipped trapping that has one (homebrew: worn
 *  containers — backpacks, sacks — raise what you can carry). Not RAW; see
 *  docs/superpowers/plans/2026-07-01-wfrp-container-capacity.md. */
function containerCapacityBonus(char: Wfrp4eCharacter): number {
  return (char.trappings ?? []).reduce(
    (sum, item) => sum + (item.equipped && item.capacity ? item.capacity : 0), 0);
}

/**
 * Max Encumbrance a character can carry before penalties (WFRP4e): Strength Bonus +
 * Toughness Bonus, plus a custom modifier (e.g. for a Mule, cart, or homebrew), plus
 * any equipped container capacity (homebrew — see containerCapacityBonus).
 * Uses `baseCharacteristicBonus` to avoid pulling the synthetic Encumbered buff into
 * its own derivation.
 */
export function encumbranceMaxValue(char: Wfrp4eCharacter): number {
  return baseCharacteristicBonus(char, 's') + baseCharacteristicBonus(char, 't')
    + (char.encumbranceModifier ?? 0) + containerCapacityBonus(char);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- wfrp4e.test.ts -t "encumbranceMaxValue"`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full encumbrance describe block to check for regressions**

Run: `npm test -- wfrp4e.test.ts -t "encumbrance"`
Expected: PASS (all encumbrance-related tests, including the pre-existing `describe('encumbrance', ...)` block at line 757 and `encumberedBuff (synthetic)` — none of those set `capacity`, so `containerCapacityBonus` contributes 0 and their expected values are unchanged)

- [ ] **Step 6: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "feat(wfrp4e): equipped container capacity raises max encumbrance"
```

---

### Task 3: Content-library defaults for known containers

**Files:**
- Modify: `src/types/wfrp4e.ts` (add near `DEFAULT_WOUNDS_COEFFS`, e.g. after line 211)
- Test: `src/types/__tests__/wfrp4e.test.ts`

- [ ] **Step 1: Write the failing test**

Add after the Task 1 test block (or anywhere top-level in the file — append near the end is fine, e.g. after the last `describe` block):

```typescript
import { defaultContainerCapacity } from '../wfrp4e';

describe('defaultContainerCapacity', () => {
  test('known containers return their book capacity', () => {
    expect(defaultContainerCapacity('Backpack')).toBe(2);
    expect(defaultContainerCapacity('Sack')).toBe(2);
    expect(defaultContainerCapacity('Sack - Large')).toBe(3);
    expect(defaultContainerCapacity('Sling Bag')).toBe(1);
    expect(defaultContainerCapacity('Saddlebags')).toBe(4);
  });

  test('Pouch and unknown names return 0', () => {
    expect(defaultContainerCapacity('Pouch')).toBe(0);
    expect(defaultContainerCapacity('Longsword')).toBe(0);
  });

  test('lookup is case-insensitive', () => {
    expect(defaultContainerCapacity('backpack')).toBe(2);
    expect(defaultContainerCapacity('BACKPACK')).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- wfrp4e.test.ts -t "defaultContainerCapacity"`
Expected: FAIL with "defaultContainerCapacity is not a function" / module has no exported member

- [ ] **Step 3: Implement**

In `src/types/wfrp4e.ts`, add this after `DEFAULT_WOUNDS_COEFFS` (line 211):

```typescript
// Book capacity (homebrew) for known containers from src/data/wfrp-content/trapping.json
// (Core p.301). Keyed lowercase for case-insensitive lookup. Not RAW — see
// docs/superpowers/plans/2026-07-01-wfrp-container-capacity.md.
const CONTAINER_CAPACITY_DEFAULTS: Record<string, number> = {
  'backpack': 2,
  'sack': 2,
  'sack - large': 3,
  'sling bag': 1,
  'pouch': 0,
  'saddlebags': 4,
};

/** Default capacity for a known container name (case-insensitive), 0 if unknown. */
export function defaultContainerCapacity(name: string): number {
  return CONTAINER_CAPACITY_DEFAULTS[name.trim().toLowerCase()] ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- wfrp4e.test.ts -t "defaultContainerCapacity"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "feat(wfrp4e): default capacity lookup for known containers"
```

---

### Task 4: Trappings UI — capacity input, row badge, content-picker prefill

**Files:**
- Modify: `src/components/wfrp4e/Trappings.tsx`

- [ ] **Step 1: Update imports and the `EMPTY` draft default**

In `src/components/wfrp4e/Trappings.tsx`, change line 14:

```typescript
import { encumbranceMaxValue, characteristicBonus, encumbranceCarried, encumbranceLevel, encumbrancePenalty } from '@/types/wfrp4e';
```

to:

```typescript
import { encumbranceMaxValue, characteristicBonus, encumbranceCarried, encumbranceLevel, encumbrancePenalty, defaultContainerCapacity } from '@/types/wfrp4e';
```

Change line 30:

```typescript
const EMPTY: Omit<Trapping, 'id'> = { name: '', encumbrance: 0, qty: 1, notes: '', equipped: false };
```

to:

```typescript
const EMPTY: Omit<Trapping, 'id'> = { name: '', encumbrance: 0, qty: 1, notes: '', equipped: false, capacity: 0 };
```

- [ ] **Step 2: Prefill capacity when opening the edit modal**

Change `openEdit` (line 47–51):

```typescript
  function openEdit(item: Trapping) {
    setDraft({ name: item.name, encumbrance: item.encumbrance, qty: item.qty, notes: item.notes ?? '', equipped: item.equipped === true });
    setEditId(item.id);
    setAdding(true);
  }
```

to:

```typescript
  function openEdit(item: Trapping) {
    setDraft({
      name: item.name, encumbrance: item.encumbrance, qty: item.qty,
      notes: item.notes ?? '', equipped: item.equipped === true, capacity: item.capacity ?? 0,
    });
    setEditId(item.id);
    setAdding(true);
  }
```

(`save()` at line 59–75 already spreads `...draft` onto the stored item, so no change needed there — `capacity` flows through automatically for both add and edit.)

- [ ] **Step 3: Show a `Cap +N` badge on rows that have capacity**

Change the list-row block (lines 123–148) — find:

```typescript
      {character.trappings.map(item => (
        <View key={item.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEdit(item)}>
            <Text style={[styles.itemName, { color: t.colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
              Enc {item.encumbrance} · ×{item.qty}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleEquipped(item.id)}
```

replace with:

```typescript
      {character.trappings.map(item => (
        <View key={item.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEdit(item)}>
            <Text style={[styles.itemName, { color: t.colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
              Enc {item.encumbrance} · ×{item.qty}
            </Text>
          </TouchableOpacity>
          {!!item.capacity && (
            <View style={[styles.capBadge, { borderColor: t.colors.accent }]}>
              <Text style={[styles.capBadgeText, { color: t.colors.accent }]}>
                {tr('wfrp.trappings.capacityBadge', { n: item.capacity })}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => toggleEquipped(item.id)}
```

- [ ] **Step 4: Add the Capacity input to the add/edit modal**

Change the `twoCol` block (lines 220–239) — find:

```typescript
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.encumbrance')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={draft.encumbrance === 0 ? '' : String(draft.encumbrance)}
                  onChangeText={v => setDraft(d => ({ ...d, encumbrance: parseInt(v) || 0 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.qty')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="1" placeholderTextColor={t.colors.textMuted}
                  value={draft.qty === 0 ? '' : String(draft.qty)}
                  onChangeText={v => setDraft(d => ({ ...d, qty: parseInt(v) || 1 }))}
                />
              </View>
            </View>
```

replace with (adds a third column for Capacity):

```typescript
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.encumbrance')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={draft.encumbrance === 0 ? '' : String(draft.encumbrance)}
                  onChangeText={v => setDraft(d => ({ ...d, encumbrance: parseInt(v) || 0 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.qty')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="1" placeholderTextColor={t.colors.textMuted}
                  value={draft.qty === 0 ? '' : String(draft.qty)}
                  onChangeText={v => setDraft(d => ({ ...d, qty: parseInt(v) || 1 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.capacity')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={draft.capacity ? String(draft.capacity) : ''}
                  onChangeText={v => setDraft(d => ({ ...d, capacity: Math.max(0, parseInt(v) || 0) }))}
                />
              </View>
            </View>
            <Text style={[styles.capHint, { color: t.colors.textMuted }]}>{tr('wfrp.trappings.capacityHint')}</Text>
```

- [ ] **Step 5: Prefill capacity from the content-library picker**

Change the `ContentPicker` `onSelect` (lines 278–284) — find:

```typescript
        onSelect={(r) => setDraft({
          name: r.name,
          encumbrance: (r.enc as number) ?? 0,
          qty: 1,
          notes: (r.description as string) ?? '',
          equipped: false,
        })}
```

replace with:

```typescript
        onSelect={(r) => setDraft({
          name: r.name,
          encumbrance: (r.enc as number) ?? 0,
          qty: 1,
          notes: (r.description as string) ?? '',
          equipped: false,
          capacity: defaultContainerCapacity(r.name),
        })}
```

- [ ] **Step 6: Add the new styles**

In the `StyleSheet.create` block at the bottom of the file, add these two entries next to `equipChip`/`equipChipText` (around line 303–304):

```typescript
  capBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginRight: 6 },
  capBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
```

and add `capHint` next to `fieldLabel` (around line 331):

```typescript
  capHint: { fontSize: 11, marginTop: -4 },
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "feat(wfrp4e): capacity input, badge, and content-picker prefill in Trappings UI"
```

---

### Task 5: i18n keys

**Files:**
- Modify: `src/i18n/en.ts:241-259` (`wfrp.trappings` block)
- Modify: `src/i18n/es.ts:238-256` (`wfrp.trappings` block)

- [ ] **Step 1: Add English keys**

In `src/i18n/en.ts`, the `trappings` block currently reads (lines 241–259):

```typescript
    trappings: {
      title: 'Trappings & Wealth',
      addItem: 'Add Item',
      editItem: 'Edit Item',
      clearAll: 'Clear all',
      clearAllConfirm: 'Clear all {n} items?',
      removeConfirm: 'Remove {name}?',
      searchBook: 'Search the book',
      namePlaceholder: 'Item name',
      encumbrance: 'Encumbrance',
      qty: 'Qty',
      notesPlaceholder: 'Notes (optional)',
      wealth: 'Wealth',
      save: 'Save',
      decreaseCoin: 'Decrease {coin}',
      increaseCoin: 'Increase {coin}',
      encumberedTitle: 'Encumbered ×{n}',
      encumberedBody: '−{move} Movement, −{test} to WS, BS, Ag, Initiative tests.',
    },
```

Add three keys after `qty: 'Qty',`:

```typescript
    trappings: {
      title: 'Trappings & Wealth',
      addItem: 'Add Item',
      editItem: 'Edit Item',
      clearAll: 'Clear all',
      clearAllConfirm: 'Clear all {n} items?',
      removeConfirm: 'Remove {name}?',
      searchBook: 'Search the book',
      namePlaceholder: 'Item name',
      encumbrance: 'Encumbrance',
      qty: 'Qty',
      capacity: 'Capacity',
      capacityHint: 'If worn or held, adds to your max Encumbrance (e.g. a Backpack).',
      capacityBadge: 'Cap +{n}',
      notesPlaceholder: 'Notes (optional)',
      wealth: 'Wealth',
      save: 'Save',
      decreaseCoin: 'Decrease {coin}',
      increaseCoin: 'Increase {coin}',
      encumberedTitle: 'Encumbered ×{n}',
      encumberedBody: '−{move} Movement, −{test} to WS, BS, Ag, Initiative tests.',
    },
```

- [ ] **Step 2: Add matching Spanish keys**

In `src/i18n/es.ts`, the `trappings` block currently reads (lines 238–256):

```typescript
    trappings: {
      title: 'Objetos y Riqueza',
      addItem: 'Añadir objeto',
      editItem: 'Editar objeto',
      clearAll: 'Borrar todo',
      clearAllConfirm: '¿Borrar los {n} objetos?',
      removeConfirm: '¿Quitar {name}?',
      searchBook: 'Buscar en el libro',
      namePlaceholder: 'Nombre del objeto',
      encumbrance: 'Carga',
      qty: 'Cantidad',
      notesPlaceholder: 'Notas (opcional)',
      wealth: 'Riqueza',
      save: 'Guardar',
      decreaseCoin: 'Reducir {coin}',
      increaseCoin: 'Aumentar {coin}',
      encumberedTitle: 'Sobrecarga ×{n}',
      encumberedBody: '−{move} Movimiento, −{test} a HA, HP, Ag, Iniciativa.',
    },
```

Add the same three keys, translated, after `qty: 'Cantidad',`:

```typescript
    trappings: {
      title: 'Objetos y Riqueza',
      addItem: 'Añadir objeto',
      editItem: 'Editar objeto',
      clearAll: 'Borrar todo',
      clearAllConfirm: '¿Borrar los {n} objetos?',
      removeConfirm: '¿Quitar {name}?',
      searchBook: 'Buscar en el libro',
      namePlaceholder: 'Nombre del objeto',
      encumbrance: 'Carga',
      qty: 'Cantidad',
      capacity: 'Capacidad',
      capacityHint: 'Si se lleva puesto o en mano, aumenta tu Carga máxima (p. ej. una Mochila).',
      capacityBadge: 'Cap +{n}',
      notesPlaceholder: 'Notas (opcional)',
      wealth: 'Riqueza',
      save: 'Guardar',
      decreaseCoin: 'Reducir {coin}',
      increaseCoin: 'Aumentar {coin}',
      encumberedTitle: 'Sobrecarga ×{n}',
      encumberedBody: '−{move} Movimiento, −{test} a HA, HP, Ag, Iniciativa.',
    },
```

- [ ] **Step 3: Typecheck (the typed `tr()` will fail to compile if EN/ES key shapes diverge in an incompatible way)**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "feat(wfrp4e): i18n keys for container capacity"
```

---

### Task 6: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new ones from Tasks 1–3 (10 new tests total: 2 passthrough + 5 encumbranceMaxValue + 3 defaultContainerCapacity)

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Manual smoke test in the browser preview**

Start the web preview (use the `preview_start` tool with name `ttrp-web`, already configured in `.claude/launch.json`). Then:

1. Open a WFRP character sheet, go to Trappings.
2. Tap "Add Item" → "Search the book" → search "Backpack" → select it. Confirm the Capacity field prefills to `2` and Encumbrance prefills to `2`.
3. Save. Confirm the row shows a `Cap +2` badge.
4. Note the max Enc shown at the top of the section (e.g. `X / Y`).
5. Tap the row's "Equip" chip to equip the Backpack. Confirm: carried Enc drops (backpack now counts as Enc 1 instead of 2 — existing −1 discount) AND the max Enc (`Y`) rises by 2.
6. Unequip it. Confirm both carried Enc rises back and max Enc drops back to the original value.
7. Check the browser console (`preview_console_logs`) for errors/warnings — expect none.

- [ ] **Step 4: Report result**

No commit for this task — it's verification only. If step 3 reveals a UI bug, fix it in the relevant file from Task 4 and re-run this task's steps before proceeding.

---

### Task 7: Update TODO.md and ship

**Files:**
- Modify: `TODO.md` (mark the container-capacity entry done)

- [ ] **Step 1: Mark the TODO entry complete**

In `TODO.md`, under "Near-term features", change the `**WFRP container capacity (homebrew).**` bullet's checkbox from `- [ ]` to `- [x]` (leave the rest of the bullet text as-is — it's still accurate documentation of what shipped).

- [ ] **Step 2: Commit**

```bash
git add -A -- ':!CLAUDE.md'
git commit -m "docs: mark WFRP container capacity done in TODO.md"
```

- [ ] **Step 3: Push and open a PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(wfrp4e): container capacity (homebrew)" --body "$(cat <<'EOF'
## Summary
- Equipped containers (Backpack, Sack, Sling Bag, etc.) now add a `capacity` value to max Encumbrance, on top of the existing equipped −1 Enc discount.
- Homebrew, not RAW — see docs/superpowers/plans/2026-07-01-wfrp-container-capacity.md for the rules check.
- Additive optional field, no schemaVer bump.

## Test plan
- [x] Unit tests: encumbranceMaxValue (5 new), defaultContainerCapacity (3 new), migration passthrough (2 new)
- [x] npm test / npm run typecheck clean
- [x] Manual: equip/unequip a Backpack in the web preview, confirm max Enc and carried Enc both update correctly
EOF
)"
```

- [ ] **Step 4: Merge**

```bash
gh pr merge --squash --admin --delete-branch
```

- [ ] **Step 5: Sync main**

```bash
git checkout main && git pull origin main --ff-only
```

---
