# Critical Wounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track WFRP4e Critical Wounds on a character — look one up by rolling/typing 1-100 within a location, or search for it by name directly — and keep a removable list of the character's current ones with their full effect text.

**Architecture:** The 4 tables (already hand-transcribed into `json_book_information/critical_wounds.json`) become an 11th entry in this repo's existing book-content pipeline (raw dump → build script → seeded `content_library` → searchable). A new `CriticalWounds.tsx` section adds entries to the character two ways — a pure roll-lookup function matched against a number, or the existing `ContentPicker` search — storing a denormalized snapshot on the character, same as talents already work.

**Tech Stack:** Existing WFRP4e content pipeline (`scripts/build-wfrp-content.mjs`, `content_library` SQLite table), existing `ContentPicker`/`WikiModal` components.

**Reference doc:** [2026-08-30-critical-wounds-design.md](../specs/2026-08-30-critical-wounds-design.md)

**Working directory:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted`.

---

## Task 1: Build-script transform for the hand-transcribed critical wounds data

**Files:**
- Modify: `scripts/build-wfrp-content.mjs`

`json_book_information/critical_wounds.json` already exists (hand-transcribed, verified: 80 records, 20 per location, each location's roll ranges cover exactly 1-100 with no gaps or overlaps). Its shape is `{ "_source": string, "head": [{rollMin, rollMax, name, wounds: number|"death", description}, ...], "body": [...], "arm": [...], "leg": [...] }` — this does NOT match the Foundry-style `{data: [{id, object}]}` shape every other raw dump in that directory uses, so it needs its own isolated code path in this script rather than joining the generic `TRANSFORMS`/`CATEGORY` loop.

- [ ] **Step 1: Read the current file in full**

```bash
cat -n scripts/build-wfrp-content.mjs
```

- [ ] **Step 2: Add a dedicated critical-wounds builder function**

Find the line `const CATEGORY = {` and add this new function immediately **before** it:

```javascript
/** critical_wounds.json isn't a Foundry dump like the others (it's hand-transcribed
 *  from a fan reference sheet) — nested by location, no id/object wrapper — so it
 *  gets its own flattening step instead of joining the generic TRANSFORMS loop below. */
async function buildCriticalWounds() {
  const raw = JSON.parse(await readFile(join(SRC, 'critical_wounds.json'), 'utf8'));
  const rows = [];
  for (const location of ['head', 'body', 'arm', 'leg']) {
    for (const entry of raw[location]) {
      rows.push({
        id: `${location}_${entry.rollMin}`,
        name: clean(entry.name),
        location,
        rollMin: entry.rollMin,
        rollMax: entry.rollMax,
        wounds: entry.wounds,
        description: clean(entry.description),
      });
    }
  }
  return rows;
}
```

- [ ] **Step 3: Call it from `run()` and include it in the same index/logging**

Find:
```javascript
async function run() {
  await mkdir(OUT, { recursive: true });
  const index = {};
  for (const [file, transform] of Object.entries(TRANSFORMS)) {
    const raw = JSON.parse(await readFile(join(SRC, `${file}.json`), 'utf8'));
    const rows = (raw.data ?? [])
      .map((r) => transform(r.object ?? {}, r.id))
      .filter((r) => r.name);
    // de-dup by id (some dumps repeat)
    const seen = new Set();
    const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const category = CATEGORY[file];
    await writeFile(join(OUT, `${category}.json`), JSON.stringify(deduped));
    index[category] = deduped.length;
    console.log(`${category.padEnd(16)} ${deduped.length} records`);
  }
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log('Total categories:', Object.keys(index).length);
}
```
Change to:
```javascript
async function run() {
  await mkdir(OUT, { recursive: true });
  const index = {};
  for (const [file, transform] of Object.entries(TRANSFORMS)) {
    const raw = JSON.parse(await readFile(join(SRC, `${file}.json`), 'utf8'));
    const rows = (raw.data ?? [])
      .map((r) => transform(r.object ?? {}, r.id))
      .filter((r) => r.name);
    // de-dup by id (some dumps repeat)
    const seen = new Set();
    const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const category = CATEGORY[file];
    await writeFile(join(OUT, `${category}.json`), JSON.stringify(deduped));
    index[category] = deduped.length;
    console.log(`${category.padEnd(16)} ${deduped.length} records`);
  }

  const criticalWounds = await buildCriticalWounds();
  await writeFile(join(OUT, 'critical_wound.json'), JSON.stringify(criticalWounds));
  index.critical_wound = criticalWounds.length;
  console.log(`${'critical_wound'.padEnd(16)} ${criticalWounds.length} records`);

  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log('Total categories:', Object.keys(index).length);
}
```

- [ ] **Step 4: Run the build script**

```bash
node scripts/build-wfrp-content.mjs
```
Expected: prints a line for every existing category plus `critical_wound        80 records`, and `Total categories: 11`.

- [ ] **Step 5: Verify the generated file**

```bash
node -e "
const rows = require('./src/data/wfrp-content/critical_wound.json');
console.log('total:', rows.length);
console.log('by location:', rows.reduce((a,r) => (a[r.location]=(a[r.location]||0)+1, a), {}));
console.log('sample:', rows.find(r => r.id === 'head_1'));
console.log('death rows:', rows.filter(r => r.wounds === 'death').map(r => r.name));
"
```
Expected: `total: 80`, `by location: { head: 20, body: 20, arm: 20, leg: 20 }`, a real sample record for `head_1` (Dramatic Injury), and 4 death rows: `Decapitated`, `Torn Apart`, `Brutal Dismemberment`, `Shattered Pelvis`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-wfrp-content.mjs src/data/wfrp-content/critical_wound.json src/data/wfrp-content/index.json
git commit -m "feat(critical-wounds): build-script transform for the hand-transcribed critical wounds data"
```

---

## Task 2: Register the new content category, bump seed version, add attribution

**Files:**
- Modify: `src/data/wfrp-content/index.ts`
- Create: `NOTICE.md`

- [ ] **Step 1: Read the current file**

```bash
cat -n src/data/wfrp-content/index.ts
```

- [ ] **Step 2: Register the category**

Change:
```typescript
import skill from './skill.json';
import talent from './talent.json';
import spell from './spell.json';
import prayer from './prayer.json';
import trapping from './trapping.json';
import quality from './quality.json';
import mutation from './mutation.json';
import creature_trait from './creature_trait.json';
import rune from './rune.json';
import career from './career.json';

export const CONTENT_SEED_VERSION = '1';

export type ContentCategory =
  | 'skill' | 'talent' | 'spell' | 'prayer' | 'trapping'
  | 'quality' | 'mutation' | 'creature_trait' | 'rune' | 'career';

export type ContentRecord = {
  id: string;
  name: string;
  characteristic?: string | null;
  [key: string]: unknown;
};

export const CONTENT_SOURCES: Record<ContentCategory, ContentRecord[]> = {
  skill: skill as ContentRecord[],
  talent: talent as ContentRecord[],
  spell: spell as ContentRecord[],
  prayer: prayer as ContentRecord[],
  trapping: trapping as ContentRecord[],
  quality: quality as ContentRecord[],
  mutation: mutation as ContentRecord[],
  creature_trait: creature_trait as ContentRecord[],
  rune: rune as ContentRecord[],
  career: career as ContentRecord[],
};
```
to:
```typescript
import skill from './skill.json';
import talent from './talent.json';
import spell from './spell.json';
import prayer from './prayer.json';
import trapping from './trapping.json';
import quality from './quality.json';
import mutation from './mutation.json';
import creature_trait from './creature_trait.json';
import rune from './rune.json';
import career from './career.json';
import critical_wound from './critical_wound.json';

export const CONTENT_SEED_VERSION = '2';

export type ContentCategory =
  | 'skill' | 'talent' | 'spell' | 'prayer' | 'trapping'
  | 'quality' | 'mutation' | 'creature_trait' | 'rune' | 'career'
  | 'critical_wound';

export type ContentRecord = {
  id: string;
  name: string;
  characteristic?: string | null;
  [key: string]: unknown;
};

export const CONTENT_SOURCES: Record<ContentCategory, ContentRecord[]> = {
  skill: skill as ContentRecord[],
  talent: talent as ContentRecord[],
  spell: spell as ContentRecord[],
  prayer: prayer as ContentRecord[],
  trapping: trapping as ContentRecord[],
  quality: quality as ContentRecord[],
  mutation: mutation as ContentRecord[],
  creature_trait: creature_trait as ContentRecord[],
  rune: rune as ContentRecord[],
  career: career as ContentRecord[],
  critical_wound: critical_wound as ContentRecord[],
};
```

- [ ] **Step 3: Create `NOTICE.md`**

```markdown
# Third-Party Notices

## Critical Wounds reference data

The Critical Wounds text (`src/data/wfrp-content/critical_wound.json`) is transcribed from
**"WFRP4th – Critical Hits Reference Sheet v1.04"** by jakob@bindslet.dk — a fan-made reference
sheet summarizing WFRP4e's Critical Wound tables, not a scan or transcription of the official
Cubicle 7 rulebook text.
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/wfrp-content/index.ts NOTICE.md
git commit -m "feat(critical-wounds): register critical_wound content category, bump seed version"
```

---

## Task 3: `criticalWounds` field on `Wfrp4eCharacter`

**Files:**
- Modify: `src/types/wfrp4e.ts`

- [ ] **Step 1: Read the relevant parts of the file**

```bash
grep -n "talents:" src/types/wfrp4e.ts
```
This shows every place `talents` appears — the type definition, the migration function, and the default-character constructor. `criticalWounds` follows the exact same three touch points.

- [ ] **Step 2: Add the field to the `Wfrp4eCharacter` type**

Find the `talents: Array<{...}>;` field definition in the main type (the one near the top of the file, not the `GrantedTalent`-related ones used by career advancement) and add immediately after its closing `}>;`:
```typescript
  criticalWounds: Array<{
    id: string;
    name: string;
    location: 'head' | 'body' | 'arm' | 'leg';
    wounds: number | 'death';
    description: string;
    roll: number | null;
  }>;
```

- [ ] **Step 3: Add migration support**

`migrateWfrp4eCharacter` starts its return with `...raw` (so any field already present on a saved character just passes through), then explicitly overrides/defaults specific fields. A character saved before this feature existed won't have `criticalWounds` at all, so it needs an explicit default the same way `tags` gets one. Find:
```typescript
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
```
Add immediately after it:
```typescript
  const criticalWounds = Array.isArray(raw?.criticalWounds) ? raw.criticalWounds : [];
```

Then find the function's returned object:
```typescript
  return {
    ...raw,
    characteristics, wounds, experience, woundsCoeffs, armourPoints, corruption,
    buffs,
    origin: raw.origin ?? '',
    lore: raw?.lore ?? '',
    description: raw?.description ?? '',
    relations: raw?.relations ?? '',
    eyeColor: raw?.eyeColor ?? '',
    hair: raw?.hair ?? '',
    movement: typeof raw?.movement === 'number' ? raw.movement : 4,
    extraPoints: typeof raw?.extraPoints === 'number' ? raw.extraPoints : 0,
    encumbranceModifier: typeof raw?.encumbranceModifier === 'number' ? raw.encumbranceModifier : 0,
    weapons: withEquipped(raw?.weapons),
    armour: withEquipped(raw?.armour),
    trappings: withEquipped(raw?.trappings),
    tags,
    schemaVer: 9,
  } as Wfrp4eCharacter;
```
Change to:
```typescript
  return {
    ...raw,
    characteristics, wounds, experience, woundsCoeffs, armourPoints, corruption,
    buffs,
    origin: raw.origin ?? '',
    lore: raw?.lore ?? '',
    description: raw?.description ?? '',
    relations: raw?.relations ?? '',
    eyeColor: raw?.eyeColor ?? '',
    hair: raw?.hair ?? '',
    movement: typeof raw?.movement === 'number' ? raw.movement : 4,
    extraPoints: typeof raw?.extraPoints === 'number' ? raw.extraPoints : 0,
    encumbranceModifier: typeof raw?.encumbranceModifier === 'number' ? raw.encumbranceModifier : 0,
    weapons: withEquipped(raw?.weapons),
    armour: withEquipped(raw?.armour),
    trappings: withEquipped(raw?.trappings),
    tags,
    criticalWounds,
    schemaVer: 9,
  } as Wfrp4eCharacter;
```

- [ ] **Step 4: Add to the default new-character constructor**

```bash
grep -n "talents: \[\]," src/types/wfrp4e.ts
```
This shows the default-character factory's line (was line 796 before this task's edits added lines above it — confirm the real current line rather than assuming it's still 796). Add immediately after that line:
```typescript
    criticalWounds: [],
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```
Expected: all passing, no regressions (adding a field with proper defaults shouldn't break existing character fixtures, but confirm).

- [ ] **Step 7: Commit**

```bash
git add src/types/wfrp4e.ts
git commit -m "feat(critical-wounds): criticalWounds field on Wfrp4eCharacter + migration + default"
```

---

## Task 4: Roll-lookup pure function, TDD

**Files:**
- Create: `src/components/wfrp4e/criticalWoundLookup.ts`
- Test: `src/components/wfrp4e/__tests__/criticalWoundLookup.test.ts`

This is the one piece of real, pure, testable logic in this feature: given a list of critical-wound content records for a location and a rolled/typed number, find the one whose range contains it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/wfrp4e/__tests__/criticalWoundLookup.test.ts`:
```typescript
import { findCriticalWound } from '../criticalWoundLookup';
import type { ContentRecord } from '@/data/wfrp-content';

const HEAD_ROWS: ContentRecord[] = [
  { id: 'head_1', name: 'Dramatic Injury', location: 'head', rollMin: 1, rollMax: 10, wounds: 1, description: 'x' },
  { id: 'head_11', name: 'Minor Cut', location: 'head', rollMin: 11, rollMax: 20, wounds: 1, description: 'y' },
  { id: 'head_100', name: 'Decapitated', location: 'head', rollMin: 100, rollMax: 100, wounds: 'death', description: 'z' },
];

describe('findCriticalWound', () => {
  it('finds the row whose range contains the roll', () => {
    expect(findCriticalWound(HEAD_ROWS, 5)?.name).toBe('Dramatic Injury');
    expect(findCriticalWound(HEAD_ROWS, 10)?.name).toBe('Dramatic Injury');
    expect(findCriticalWound(HEAD_ROWS, 11)?.name).toBe('Minor Cut');
  });

  it('finds a "00" result stored as roll 100', () => {
    expect(findCriticalWound(HEAD_ROWS, 100)?.name).toBe('Decapitated');
  });

  it('returns null for a number with no matching row', () => {
    expect(findCriticalWound(HEAD_ROWS, 50)).toBeNull();
  });

  it('returns null for an out-of-range number', () => {
    expect(findCriticalWound(HEAD_ROWS, 0)).toBeNull();
    expect(findCriticalWound(HEAD_ROWS, 101)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npx jest src/components/wfrp4e/__tests__/criticalWoundLookup.test.ts
```
Expected: FAIL — `Cannot find module '../criticalWoundLookup'`.

- [ ] **Step 3: Implement `criticalWoundLookup.ts`**

Create `src/components/wfrp4e/criticalWoundLookup.ts`:
```typescript
import type { ContentRecord } from '@/data/wfrp-content';

/** Find the critical-wound record whose [rollMin, rollMax] range contains `n`,
 *  among the given (already location-filtered) rows. Null if none matches —
 *  e.g. n is out of 1-100 range, or the rows list is empty/wrong location. */
export function findCriticalWound(rows: ContentRecord[], n: number): ContentRecord | null {
  return rows.find(r => n >= (r.rollMin as number) && n <= (r.rollMax as number)) ?? null;
}
```

- [ ] **Step 4: Run the tests again, confirm they pass**

```bash
npx jest src/components/wfrp4e/__tests__/criticalWoundLookup.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/criticalWoundLookup.ts src/components/wfrp4e/__tests__/criticalWoundLookup.test.ts
git commit -m "feat(critical-wounds): findCriticalWound roll-lookup function"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Find the WFRP-specific section of the file**

```bash
grep -n "wfrp: {" src/i18n/en.ts
```

- [ ] **Step 2: Add a new `criticalWounds` sub-object inside `wfrp`**

Add these keys (nested under the existing `wfrp: { ... }` object, alongside sibling sections like `combat`/`talents` — match the existing indentation and structure by placing it as a new top-level key inside `wfrp`):
```typescript
    criticalWounds: {
      title: 'Critical Wounds',
      add: 'Add Critical Wound',
      roll: 'Roll',
      search: 'Search',
      location: 'Location',
      head: 'Head',
      body: 'Body',
      arm: 'Arm',
      leg: 'Leg',
      rollLabel: 'Roll',
      editRoll: 'Edit roll',
      reroll: 'Reroll',
      preview: 'Result',
      confirm: 'Add',
      cancel: 'Cancel',
      noMatch: 'No result for that roll',
      death: 'Death',
      removeConfirm: 'Remove "{{name}}"?',
    },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: clean (this repo's i18n types are structural, so a new nested object is automatically valid — confirm rather than assume).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts
git commit -m "feat(critical-wounds): i18n keys"
```

---

## Task 6: `CriticalWounds.tsx` component

**Files:**
- Create: `src/components/wfrp4e/CriticalWounds.tsx`

- [ ] **Step 1: Read `src/components/ui/WfrpRollModal.tsx` in full first**

```bash
cat -n src/components/ui/WfrpRollModal.tsx
```
This is the reference for the tap-to-edit roll number pattern used below (TextInput, number-pad, autoFocus, selectTextOnFocus, maxLength, commit on submit/blur).

- [ ] **Step 2: Read `src/components/wfrp4e/Talents.tsx` in full first**

```bash
cat -n src/components/wfrp4e/Talents.tsx
```
This is the reference for `ContentPicker` usage, `WikiModal` usage, list-row-with-trash-icon, and `confirmRemove` usage — all reused below.

- [ ] **Step 3: Write the component**

Create `src/components/wfrp4e/CriticalWounds.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useSQLiteContext } from 'expo-sqlite';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import { searchContent } from '@/db/queries';
import { findCriticalWound } from './criticalWoundLookup';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import type { ContentRecord } from '@/data/wfrp-content';

type CriticalWound = Wfrp4eCharacter['criticalWounds'][number];
type Location = CriticalWound['location'];

const LOCATIONS: Location[] = ['head', 'body', 'arm', 'leg'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

export function CriticalWounds({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();

  const [rolling, setRolling] = useState(false);
  const [location, setLocation] = useState<Location>('head');
  const [rollValue, setRollValue] = useState(1);
  const [editingRoll, setEditingRoll] = useState(false);
  const [rollDraft, setRollDraft] = useState('1');
  const [locationRows, setLocationRows] = useState<ContentRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);

  const wikiWound = wikiId ? character.criticalWounds.find(x => x.id === wikiId) ?? null : null;

  // Load this location's 80-row-total (20 per location) table once the roll
  // picker is open, so findCriticalWound has something to search.
  useEffect(() => {
    if (!rolling) return;
    let cancelled = false;
    searchContent(db, 'critical_wound', '', 100, locale).then(rows => {
      if (!cancelled) setLocationRows(rows.filter(r => r.location === location));
    });
    return () => { cancelled = true; };
  }, [rolling, location, db, locale]);

  function openRoll() {
    setLocation('head');
    setRollValue(Math.floor(Math.random() * 100) + 1);
    setRolling(true);
  }

  function reroll() {
    setRollValue(Math.floor(Math.random() * 100) + 1);
  }

  function startEditingRoll() {
    setRollDraft(String(rollValue));
    setEditingRoll(true);
  }

  function commitRollEdit() {
    const n = parseInt(rollDraft, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 100) setRollValue(n);
    setEditingRoll(false);
  }

  const match = findCriticalWound(locationRows, rollValue);

  function addFromRoll() {
    if (!match) return;
    addWound({
      id: uuidv4(),
      name: match.name,
      location,
      wounds: match.wounds as number | 'death',
      description: (match.description as string) ?? '',
      roll: rollValue,
    });
    setRolling(false);
  }

  function addFromPicker(r: ContentRecord) {
    addWound({
      id: uuidv4(),
      name: r.name,
      location: r.location as Location,
      wounds: r.wounds as number | 'death',
      description: (r.description as string) ?? '',
      roll: null,
    });
    setPicking(false);
  }

  function addWound(w: CriticalWound) {
    onChange({ criticalWounds: [...character.criticalWounds, w] });
  }

  function removeWound(id: string) {
    const w = character.criticalWounds.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.criticalWounds.removeConfirm', { name: w?.name ?? '' }), () =>
      onChange({ criticalWounds: character.criticalWounds.filter(x => x.id !== id) }));
  }

  return (
    <Section title={tr('wfrp.criticalWounds.title')}>
      {character.criticalWounds.map(w => (
        <TouchableOpacity
          key={w.id}
          style={[styles.row, { borderColor: t.colors.border }]}
          activeOpacity={0.6}
          onPress={() => setWikiId(w.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: t.colors.text }]}>{w.name}</Text>
            <Text style={[styles.sub, { color: t.colors.textSecondary }]}>
              {tr(`wfrp.criticalWounds.${w.location}`)}
              {' · '}
              {w.wounds === 'death' ? tr('wfrp.criticalWounds.death') : `${w.wounds} ${tr('wfrp.combat.ap')}`}
              {w.roll !== null ? ` · ${tr('wfrp.criticalWounds.rollLabel')} ${w.roll}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => removeWound(w.id)} style={styles.del} hitSlop={8}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {!rolling ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openRoll}>
            <Plus size={14} color={t.colors.accent} />
            <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.criticalWounds.roll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
            <Plus size={14} color={t.colors.accent} />
            <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.criticalWounds.search')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.rollPanel, { borderColor: t.colors.border }]}>
          <Text style={[styles.panelLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.criticalWounds.location')}</Text>
          <View style={styles.chipRow}>
            {LOCATIONS.map(loc => (
              <TouchableOpacity
                key={loc}
                onPress={() => setLocation(loc)}
                style={[styles.chip, {
                  borderColor: t.colors.accent,
                  backgroundColor: location === loc ? t.colors.accent : 'transparent',
                }]}
              >
                <Text style={{ color: location === loc ? t.colors.accentText : t.colors.accent }}>
                  {tr(`wfrp.criticalWounds.${loc}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {editingRoll ? (
            <TextInput
              style={[styles.rollInput, { color: t.colors.text, borderColor: t.colors.accent }]}
              value={rollDraft}
              onChangeText={setRollDraft}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={3}
              onSubmitEditing={commitRollEdit}
              onBlur={commitRollEdit}
            />
          ) : (
            <TouchableOpacity onPress={startEditingRoll} accessibilityLabel={tr('wfrp.criticalWounds.editRoll')}>
              <Text style={[styles.rollNumber, { color: t.colors.text }]}>{rollValue}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={reroll} style={[styles.rerollBtn, { borderColor: t.colors.accent }]}>
            <Text style={{ color: t.colors.accent }}>{tr('wfrp.criticalWounds.reroll')}</Text>
          </TouchableOpacity>

          <Text style={[styles.panelLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.criticalWounds.preview')}</Text>
          <Text style={[styles.previewText, { color: t.colors.text }]}>
            {match ? `${match.name} — ${match.wounds === 'death' ? tr('wfrp.criticalWounds.death') : match.wounds}` : tr('wfrp.criticalWounds.noMatch')}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.panelBtn} onPress={() => setRolling(false)}>
              <Text style={{ color: t.colors.textSecondary }}>{tr('wfrp.criticalWounds.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.panelBtn} onPress={addFromRoll} disabled={!match}>
              <Text style={{ color: match ? t.colors.accent : t.colors.textMuted, fontWeight: '700' }}>
                {tr('wfrp.criticalWounds.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ContentPicker
        visible={picking}
        category="critical_wound"
        title={tr('wfrp.criticalWounds.title')}
        subtitle={(r) => `${tr(`wfrp.criticalWounds.${r.location}`)} · ${r.wounds === 'death' ? tr('wfrp.criticalWounds.death') : r.wounds}`}
        onSelect={addFromPicker}
        onClose={() => setPicking(false)}
      />

      <WikiModal
        visible={wikiWound !== null}
        title={wikiWound?.name ?? ''}
        subtitle={wikiWound ? `${tr(`wfrp.criticalWounds.${wikiWound.location}`)}${wikiWound.roll !== null ? ` · ${tr('wfrp.criticalWounds.rollLabel')} ${wikiWound.roll}` : ''}` : undefined}
        body={wikiWound?.description ?? ''}
        onClose={() => setWikiId(null)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8, gap: 8 },
  name: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  del: { padding: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', padding: 10, flex: 1, justifyContent: 'center' },
  addText: { fontWeight: '600', fontSize: 13 },
  rollPanel: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  panelLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rollNumber: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  rollInput: { fontSize: 32, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderRadius: 8 },
  rerollBtn: { alignSelf: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  previewText: { fontSize: 13 },
  panelBtn: { padding: 10 },
});
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: errors ONLY where this new component isn't rendered yet anywhere (i.e., no errors from this file itself, since it's self-contained and unused so far — fixed in Task 7). If `t.colors.danger`/`t.colors.accentText`/`t.colors.textMuted` don't resolve, check `src/hooks/useTheme.ts`'s actual color keys and adjust to match exactly (these were used based on precedent from other WFRP components, but confirm they exist rather than assuming).

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/CriticalWounds.tsx
git commit -m "feat(critical-wounds): CriticalWounds section component"
```

---

## Task 7: Wire into `Wfrp4eSheet.tsx`

**Files:**
- Modify: `src/components/wfrp4e/Wfrp4eSheet.tsx`

- [ ] **Step 1: Add the import**

Find:
```typescript
import { Resources } from '@/components/wfrp4e/Resources';
```
Add immediately after it:
```typescript
import { CriticalWounds } from '@/components/wfrp4e/CriticalWounds';
```

- [ ] **Step 2: Add the section and place it in the layout arrays**

Find:
```typescript
    resources: <Resources key="resources" character={character} onChange={onChange} />,
```
Change to:
```typescript
    resources: <Resources key="resources" character={character} onChange={onChange} />,
    criticalWounds: <CriticalWounds key="criticalWounds" character={character} onChange={onChange} />,
```

Find:
```typescript
  const single = [s.details, s.experience, s.characteristics, s.buffs, s.resources, s.skills, s.talents, s.combat, s.trappings, s.magic, s.corruption];
  const left = [s.experience, s.characteristics, s.buffs, s.skills, s.talents];
  const right = [s.resources, s.combat, s.trappings, s.magic, s.corruption, s.details];
```
Change to:
```typescript
  const single = [s.details, s.experience, s.characteristics, s.buffs, s.resources, s.criticalWounds, s.skills, s.talents, s.combat, s.trappings, s.magic, s.corruption];
  const left = [s.experience, s.characteristics, s.buffs, s.skills, s.talents];
  const right = [s.resources, s.criticalWounds, s.combat, s.trappings, s.magic, s.corruption, s.details];
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```
Expected: all passing, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/Wfrp4eSheet.tsx
git commit -m "feat(critical-wounds): show Critical Wounds section in the WFRP4e sheet"
```

---

## Task 8: End-to-end manual verification

No new files — this exercises every prior task together.

- [ ] **Step 1: Start the app**

```bash
npx expo start --web
```

- [ ] **Step 2: Verify the roll path**

Open a WFRP4e character, scroll to the new "Critical Wounds" section, tap "Roll." Verify:
- Location chips (Head/Body/Arm/Leg) are shown, Head selected by default, a random 1-100 number is already showing.
- Tapping the number turns it into an editable numeric input; typing a specific value (e.g. `100`) and submitting shows that exact value.
- With roll `100` and location `Head`, the preview shows "Decapitated — Death" (cross-check this and 2-3 other specific rolls against the source images in `critical_injuries_table/` directly, to catch any transcription slip).
- Tapping "Reroll" changes the number and preview.
- Switching location changes which table the preview matches against (e.g. roll `100` on "Arm" should show "Brutal Dismemberment," not "Decapitated").
- Confirming adds it to the list above, showing name, location, wounds/death, and "Roll 100".

- [ ] **Step 3: Verify the direct/search path**

Tap "Search," confirm the picker searches across critical wounds by name (try typing part of an entry's name, e.g. "Bruised"), confirm selecting one adds it to the list with no roll number shown.

- [ ] **Step 4: Verify view and remove**

Tap an added entry, confirm the full description text opens (matching the source image's "Additional Effects" text for that entry). Remove it, confirm the confirmation prompt shows the entry's name and removing it takes it off the list.

- [ ] **Step 5: Verify D&D 5e characters are unaffected**

Open a D&D 5e character, confirm no "Critical Wounds" section appears anywhere (this component is only rendered inside `Wfrp4eSheet.tsx`, which D&D characters never use).

- [ ] **Step 6: Fix anything found, then push**

If Step 2's cross-check against the source images finds any transcription error, fix it directly in `json_book_information/critical_wounds.json`, re-run `node scripts/build-wfrp-content.mjs`, re-verify, and commit:
```bash
git add json_book_information/critical_wounds.json src/data/wfrp-content/critical_wound.json
git commit -m "fix(critical-wounds): correct transcription error found during verification"
```

```bash
git push
```
