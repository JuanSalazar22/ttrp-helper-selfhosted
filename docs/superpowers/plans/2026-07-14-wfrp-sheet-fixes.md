# WFRP Sheet Fixes & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two armour-point bugs (unequipped armour counted; Spanish location names not recognized), add Spanish range/duration to spell content, add special-roll rules + animations (01–05 auto-success, 96–00 auto-failure, 88 chaos flair, doubles crit/fumble), and make characteristic abbreviations translatable.

**Architecture:** All changes ride existing seams: pure helpers in `src/types/wfrp4e.ts` (armour), the locale-agnostic content-overlay pipeline (`src/db/queries.ts` + `src/data/wfrp-content/es/`), the pure dice engine (`src/dice/wfrp.ts`), the Reanimated roll modal (`src/components/ui/WfrpRollModal.tsx`), and the typed `tr()` i18n tree. No schema bump needed — no stored character shape changes.

**Tech Stack:** React Native 0.85 / Expo 56, TypeScript strict, react-native-reanimated, jest-expo, Node script for content generation.

**Decisions locked in (flag to user if they look wrong at execution time):**
1. 01–05 / 96–00 change the **outcome** (engine), not just the animation — this is WFRP4e RAW ("Instant success/failure"). SL formula unchanged.
2. Roll of 88 gets chaos-themed presentation (purple + shake + caption); mechanically it's still a plain fumble/failure per doubles rules.
3. `yards` → `metros` (Devir Spanish edition convention). `target` field NOT translated (user asked Range + Duration only).
4. ES characteristic abbreviations (Devir): HA, HP, F, R, I, Ag, Des, Int, V, Em.
5. Equipped-only AP affects the derivation helper used by the "Auto-fill" button; the manual per-location boxes stay editable and untouched.

**Repo state warning:** the working tree already has *uncommitted* ES-content fixes (`src/data/wfrp-content/es/index.ts` seed bump to `es-5`, small edits to `es/skill.json` + `es/spell.json`, plan-doc tweak). Task 0 commits them first so this work starts clean. `CLAUDE.md` must NEVER be committed (`git add -A -- ':!CLAUDE.md'`). `src/data/wfrp-content.zip` is untracked scratch — leave it, don't commit it.

---

### Task 0: Branch + commit pre-existing ES content fixes

**Files:**
- Commit (pre-existing changes, not authored by this plan): `src/data/wfrp-content/es/index.ts`, `src/data/wfrp-content/es/skill.json`, `src/data/wfrp-content/es/spell.json`, `docs/superpowers/plans/2026-06-24-wfrp-es-content.md`

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/wfrp-sheet-fixes
```

- [ ] **Step 2: Commit the pre-existing ES content fixes as their own commit**

```bash
git add src/data/wfrp-content/es/index.ts src/data/wfrp-content/es/skill.json src/data/wfrp-content/es/spell.json docs/superpowers/plans/2026-06-24-wfrp-es-content.md
git commit -m "chore(wfrp-es): commit pending ES content fixes (seed es-5)"
```

- [ ] **Step 3: Verify tree is clean apart from CLAUDE.md and wfrp-content.zip**

Run: `git status --short`
Expected: only `?? CLAUDE.md` and `?? src/data/wfrp-content.zip` (plus this plan file once created).

---

### Task 1: Bug — auto-fill AP counts only equipped armour

**Files:**
- Modify: `src/types/wfrp4e.ts:374-385` (`armourPointsByLocation`)
- Test: `src/types/__tests__/wfrp4e.test.ts` (existing `describe('armourPointsByLocation')`, ~line 273)

- [ ] **Step 1: Update existing tests + add failing test**

In `src/types/__tests__/wfrp4e.test.ts`, inside `describe('armourPointsByLocation')`:
- In the first test (`'sums AP per location; bare Arms/Legs cover both sides'`) change all four items from `equipped: false` to `equipped: true`.
- In the second test (`'left/right sides and shield are independent'`) change both items to `equipped: true`.
- Add this new test inside the same describe:

```typescript
  test('unequipped armour contributes no AP', () => {
    const c = defaultWfrp4eCharacter('T');
    c.armour = [
      { id: '1', name: 'Helm', locations: ['Head'], encumbrance: 0, ap: 2, qualities: '', equipped: true },
      { id: '2', name: 'Spare Mail', locations: ['Body'], encumbrance: 1, ap: 3, qualities: '', equipped: false },
    ];
    const ap = armourPointsByLocation(c);
    expect(ap.head).toBe(2);
    expect(ap.body).toBe(0);
  });
```

- [ ] **Step 2: Run to verify the new test fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts -t "unequipped" 2>&1 | tail -5`
Expected: FAIL — `ap.body` is `3`, expected `0`.

- [ ] **Step 3: Implement**

In `src/types/wfrp4e.ts`, `armourPointsByLocation`:

```typescript
/** Armour Points per location, summed from every *equipped* armour item covering it. */
export function armourPointsByLocation(char: Wfrp4eCharacter): Record<ArmourLocation, number> {
  const out: Record<ArmourLocation, number> = {
    head: 0, rightArm: 0, leftArm: 0, body: 0, rightLeg: 0, leftLeg: 0, shield: 0,
  };
  for (const a of char.armour ?? []) {
    if (!a.equipped) continue;
    for (const locRaw of a.locations ?? []) {
      for (const loc of normalizeLocation(locRaw)) out[loc] += a.ap || 0;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run full test file**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts 2>&1 | tail -5`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "fix(wfrp4e): auto-fill armour points from equipped armour only"
```

---

### Task 2: Bug — armour location matching works in Spanish (and is extensible)

**Files:**
- Modify: `src/types/wfrp4e.ts:361-372` (`normalizeLocation`)
- Test: `src/types/__tests__/wfrp4e.test.ts` (same describe block)

- [ ] **Step 1: Add failing test**

Inside `describe('armourPointsByLocation')`:

```typescript
  test('recognizes Spanish location names', () => {
    const c = defaultWfrp4eCharacter('T');
    c.armour = [
      { id: '1', name: 'Yelmo', locations: ['Cabeza'], encumbrance: 0, ap: 2, qualities: '', equipped: true },
      { id: '2', name: 'Cota', locations: ['Torso', 'Brazos'], encumbrance: 1, ap: 1, qualities: '', equipped: true },
      { id: '3', name: 'Hombrera', locations: ['Brazo izq.'], encumbrance: 0, ap: 1, qualities: '', equipped: true },
      { id: '4', name: 'Greba', locations: ['Pierna derecha'], encumbrance: 0, ap: 1, qualities: '', equipped: true },
      { id: '5', name: 'Escudo', locations: ['Escudo'], encumbrance: 1, ap: 2, qualities: '', equipped: true },
    ];
    expect(armourPointsByLocation(c)).toEqual({
      head: 2, rightArm: 1, leftArm: 2, body: 1, rightLeg: 1, leftLeg: 0, shield: 2,
    });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts -t "Spanish" 2>&1 | tail -5`
Expected: FAIL — all zeros.

- [ ] **Step 3: Implement synonym-table matcher**

Replace `normalizeLocation` in `src/types/wfrp4e.ts` with:

```typescript
// Normalize a free-text armour location to the region(s) it covers. "Arms"/"Brazos"
// with no side cover both; "Left Arm"/"Brazo izq." cover one; "Shield"/"Escudo" is its
// own slot. To support another language, extend the synonym lists below (substring
// match against the lowercased input — stems like 'izquierd' cover izquierda/izquierdo).
const LOC_SYNONYMS = {
  shield: ['shield', 'escudo'],
  head: ['head', 'cabeza'],
  body: ['body', 'chest', 'torso', 'cuerpo', 'pecho'],
  arm: ['arm', 'brazo'],
  leg: ['leg', 'pierna'],
  left: ['left', 'izquierd', 'izq'],
  right: ['right', 'derech', 'der.', 'dcha'],
};
const hasAny = (l: string, words: string[]) => words.some(w => l.includes(w));

function normalizeLocation(raw: string): ArmourLocation[] {
  const l = raw.trim().toLowerCase();
  if (hasAny(l, LOC_SYNONYMS.shield)) return ['shield'];
  if (hasAny(l, LOC_SYNONYMS.head)) return ['head'];
  if (hasAny(l, LOC_SYNONYMS.body)) return ['body'];
  const left = hasAny(l, LOC_SYNONYMS.left), right = hasAny(l, LOC_SYNONYMS.right);
  if (hasAny(l, LOC_SYNONYMS.arm)) return left ? ['leftArm'] : right ? ['rightArm'] : ['leftArm', 'rightArm'];
  if (hasAny(l, LOC_SYNONYMS.leg)) return left ? ['leftLeg'] : right ? ['rightLeg'] : ['leftLeg', 'rightLeg'];
  return [];
}
```

Note: English `arm` synonym is a substring of Spanish-irrelevant words like "armadura" — but location strings are short labels, and "armadura" as a *location* doesn't exist; acceptable. `'right'` is checked via list so "Shoulder" (contains `der`? no — `der.` and `derech` don't match "shoulder") stays unmatched, same as before.

- [ ] **Step 4: Run full test file + full suite**

Run: `npx jest src/types/__tests__/wfrp4e.test.ts 2>&1 | tail -5`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/wfrp4e.ts src/types/__tests__/wfrp4e.test.ts
git commit -m "fix(wfrp4e): recognize Spanish armour location names in AP auto-fill"
```

---

### Task 3: Feature — Spanish range/duration for spells

The overlay pipeline already spreads arbitrary fields (`applyOverlay` = `{ ...base, ...overlay }`). Work: (a) generate `range`/`duration` Spanish strings into `es/spell.json` via a one-off script, (b) widen `EsOverlay`, (c) include the fields in the seed, (d) bump seed version, (e) data test.

**Files:**
- Create: `scripts/translate-spell-es.mjs` (one-off generator, kept in repo like `build-wfrp-content.mjs`)
- Modify: `src/data/wfrp-content/es/spell.json` (generated)
- Modify: `src/data/wfrp-content/es/index.ts` (type + version)
- Modify: `src/db/queries.ts:355-361` (`seedWfrpContentTranslations`)
- Test: `src/data/wfrp-content/__tests__/esSpellFields.test.ts` (new)

- [ ] **Step 1: Write the failing data test**

Create `src/data/wfrp-content/__tests__/esSpellFields.test.ts`:

```typescript
import spellEn from '../spell.json';
import spellEs from '../es/spell.json';

type EnSpell = { id: string; range?: string; duration?: string };
type EsSpell = { id: string; range?: string; duration?: string };

describe('ES spell overlay range/duration', () => {
  const enById = new Map((spellEn as EnSpell[]).map(s => [s.id, s]));

  test('every ES spell whose EN source has range/duration carries a non-empty translation', () => {
    const missing: string[] = [];
    for (const es of spellEs as EsSpell[]) {
      const en = enById.get(es.id);
      if (!en) continue;
      if (en.range && !(es.range ?? '').trim()) missing.push(`${es.id} range`);
      if (en.duration && !(es.duration ?? '').trim()) missing.push(`${es.id} duration`);
    }
    expect(missing).toEqual([]);
  });

  test('no leftover untranslated English tokens in ES fields', () => {
    const english = /\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity|yards?|rounds?|minutes?|hours?|days?|Touch|Instant|Permanent|Special|Bonus|Half|You)\b/;
    const bad: string[] = [];
    for (const es of spellEs as EsSpell[]) {
      for (const f of ['range', 'duration'] as const) {
        const v = es[f];
        if (v && english.test(v)) bad.push(`${es.id} ${f}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/data/wfrp-content/__tests__/esSpellFields.test.ts 2>&1 | tail -8`
Expected: FAIL — every spell missing range/duration (ES entries currently have only `id`+`name`).

- [ ] **Step 3: Write the generator script**

Create `scripts/translate-spell-es.mjs`:

```javascript
// One-off: derive Spanish `range` / `duration` for src/data/wfrp-content/es/spell.json
// from the formulaic English values in spell.json. Whole-phrase map first, then token
// rules. Prints anything still containing English words so it can be fixed by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const EN = JSON.parse(readFileSync('src/data/wfrp-content/spell.json', 'utf8'));
const ES = JSON.parse(readFileSync('src/data/wfrp-content/es/spell.json', 'utf8'));

const CHAR = {
  willpower: 'Voluntad', intelligence: 'Inteligencia', initiative: 'Iniciativa',
  fellowship: 'Empatía', toughness: 'Resistencia', strength: 'Fuerza',
  agility: 'Agilidad', dexterity: 'Destreza',
};

const PHRASES = new Map([
  ['You', 'Tú'], ['Touch', 'Toque'], ['Special', 'Especial'],
  ['Instant', 'Instantáneo'], ['Permanent', 'Permanente'],
  ['Line of Sight', 'Línea de visión'], ['Random Vortex', 'Vórtice aleatorio'],
]);

const TOKEN_RULES = [
  // "Willpower Bonus" → "Bonificación de Voluntad" (must run before bare characteristic rule)
  [/\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity) Bonus\b/gi,
    (_, c) => `Bonificación de ${CHAR[c.toLowerCase()]}`],
  [/\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity)\b/gi,
    (_, c) => CHAR[c.toLowerCase()]],
  [/\bHalf\b/gi, 'Mitad de'],
  [/\bAoE\b/g, 'Área'],
  [/\byards?\b/gi, 'metros'],
  [/\bmiles?\b/gi, 'millas'],
  [/\brounds\b/gi, 'asaltos'], [/\bround\b/gi, 'asalto'],
  [/\bminutes\b/gi, 'minutos'], [/\bminute\b/gi, 'minuto'],
  [/\bhours\b/gi, 'horas'], [/\bhour\b/gi, 'hora'],
  [/\bdays\b/gi, 'días'], [/\bday\b/gi, 'día'],
  [/\bInstant\b/gi, 'Instantáneo'], [/\bPermanent\b/gi, 'Permanente'],
  [/\bSpecial\b/gi, 'Especial'], [/\bYou\b/g, 'Tú'], [/\bTouch\b/gi, 'Toque'],
];

function translate(value) {
  const v = value.trim();
  if (PHRASES.has(v)) return PHRASES.get(v);
  let out = v;
  for (const [re, rep] of TOKEN_RULES) out = out.replace(re, rep);
  return out;
}

const LEFTOVER = /\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity|yards?|rounds?|minutes?|hours?|days?|Touch|Instant|Permanent|Special|Bonus|Half|You|of|the|per|target|item|object|any|one|ship|fire)\b/i;

const enById = new Map(EN.map(s => [s.id, s]));
const review = [];
for (const es of ES) {
  const en = enById.get(es.id);
  if (!en) continue;
  for (const f of ['range', 'duration']) {
    if (!en[f]) continue;
    const t = translate(en[f]);
    es[f] = t;
    if (LEFTOVER.test(t)) review.push(`${es.id} ${f}: "${en[f]}" -> "${t}"`);
  }
}

writeFileSync('src/data/wfrp-content/es/spell.json', JSON.stringify(ES, null, 1) + '\n');
console.log(`translated ${ES.length} spells; ${review.length} need manual review:`);
for (const r of review) console.log('  ' + r);
```

- [ ] **Step 4: Run the script and hand-fix the review list**

Run: `cd /Users/juan.salazar/Repos/TTRP-helper && node scripts/translate-spell-es.mjs`
Expected: `translated 579 spells; N need manual review:` followed by a short list (irregular values like `'Any 1 Fenbeast'`, `'One ship'`, `'Willpower Bonus rounds+'`).

Then open `src/data/wfrp-content/es/spell.json` and manually translate each listed value (e.g. `'Willpower Bonus rounds+'` → `'Bonificación de Voluntad asaltos+'`, `'One ship'` → `'Un barco'`). Re-run the data test's regex mentally — no English tokens may remain.

**IMPORTANT:** before editing, confirm the generated JSON preserved the pre-existing manual `name` fixes from Task 0's commit (script only writes `range`/`duration`; names untouched by design — verify with `git diff --stat src/data/wfrp-content/es/spell.json`).

- [ ] **Step 5: Widen overlay type + bump seed version**

In `src/data/wfrp-content/es/index.ts`:

```typescript
export const ES_CONTENT_SEED_VERSION = 'es-6';

export type EsOverlay = { id: string; name: string; description?: string; page?: string; range?: string; duration?: string };
```

- [ ] **Step 6: Seed the new fields**

In `src/db/queries.ts`, `seedWfrpContentTranslations`:

```typescript
export async function seedWfrpContentTranslations(db: SQLite.SQLiteDatabase): Promise<void> {
  const bundle = WFRP_CONTENT_ES.map((r) => ({
    id: r.id,
    overlay: { name: r.name, description: r.description, page: r.page, range: r.range, duration: r.duration },
  }));
  await seedContentTranslations(db, 'es', bundle, ES_CONTENT_SEED_VERSION);
}
```

(`JSON.stringify` drops `undefined` values, so non-spell categories are unaffected.)

- [ ] **Step 7: Run tests + typecheck**

Run: `npx jest src/data/wfrp-content/__tests__/esSpellFields.test.ts src/db/__tests__ 2>&1 | tail -5 && npm run typecheck`
Expected: PASS, clean typecheck.

- [ ] **Step 8: Commit**

```bash
git add scripts/translate-spell-es.mjs src/data/wfrp-content/es/spell.json src/data/wfrp-content/es/index.ts src/db/queries.ts src/data/wfrp-content/__tests__/esSpellFields.test.ts
git commit -m "feat(wfrp-es): Spanish range/duration for spells (seed es-6)"
```

---

### Task 4: Feature — engine auto-success (01–05) and auto-failure (96–00)

WFRP4e RAW: a roll of 01–05 always succeeds, 96–00 always fails, regardless of target. Doubles logic (crit on success, fumble on failure) is unchanged and composes: 99/100 on 96–00 are always fumbles now.

**Files:**
- Modify: `src/dice/wfrp.ts:12-15`
- Test: `src/dice/__tests__/wfrp.test.ts`

- [ ] **Step 1: Add failing tests + update the stale one**

In `src/dice/__tests__/wfrp.test.ts`, add:

```typescript
  test('01-05 always succeeds even above target', () => {
    const r = evaluateWfrpTest(3, 1);
    expect(r.success).toBe(true);
  });

  test('96-00 always fails even below target', () => {
    const r = evaluateWfrpTest(97, 120);
    expect(r.success).toBe(false);
  });

  test('99 on a high target is still a fumble (auto-failure + double)', () => {
    const r = evaluateWfrpTest(99, 120);
    expect(r.isFumble).toBe(true);
    expect(r.isCrit).toBe(false);
  });
```

Find the existing test `'100 counts as a double (fumble unless target >= 100)'` and replace it with:

```typescript
  test('100 is always a fumble (auto-failure + double)', () => {
    expect(evaluateWfrpTest(100, 45).isFumble).toBe(true);
    expect(evaluateWfrpTest(100, 120).isFumble).toBe(true);
  });
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest src/dice/__tests__/wfrp.test.ts 2>&1 | tail -8`
Expected: the three new tests FAIL (plus the replaced 100 test if target≥100 previously succeeded).

- [ ] **Step 3: Implement**

In `src/dice/wfrp.ts`, `evaluateWfrpTest`:

```typescript
export function evaluateWfrpTest(
  roll: number,
  baseTarget: number,
  difficulty = 0,
  label = 'Test',
): WfrpRollResult {
  const effectiveTarget = baseTarget + difficulty;
  // RAW: 01–05 always succeeds, 96–00 always fails, regardless of target.
  const success = roll <= 5 ? true : roll >= 96 ? false : roll <= effectiveTarget;
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
```

- [ ] **Step 4: Run dice tests**

Run: `npx jest src/dice/__tests__/wfrp.test.ts 2>&1 | tail -5`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dice/wfrp.ts src/dice/__tests__/wfrp.test.ts
git commit -m "feat(wfrp4e): RAW auto-success 01-05 and auto-failure 96-00"
```

---

### Task 5: Feature — special-roll animations + captions in the roll modal

Flair tiers derived from the result (no engine/type change): `chaos` (roll 88) > `crit` > `fumble` > `autoSuccess` (≤5) > `autoFailure` (≥96). Crit gets gold + stronger bounce; fumble/chaos/autoFailure get a horizontal shake; chaos recolors the card purple with a caption; autoSuccess/autoFailure get explanatory captions.

**Files:**
- Modify: `src/components/ui/WfrpRollModal.tsx`
- Modify: `src/i18n/en.ts` (under `ui.wfrpRoll`), `src/i18n/es.ts`

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en.ts`, inside the existing `ui.wfrpRoll` object (where `rollAgain`/`done`/`editRoll` live), add:

```typescript
      flairChaos: 'The Dark Gods take notice',
      flairAutoSuccess: '01–05 always succeeds',
      flairAutoFailure: '96–00 always fails',
```

In `src/i18n/es.ts`, same namespace:

```typescript
      flairChaos: 'Los Dioses Oscuros te observan',
      flairAutoSuccess: '01–05 siempre es éxito',
      flairAutoFailure: '96–00 siempre es fallo',
```

- [ ] **Step 2: Implement flair in WfrpRollModal**

In `src/components/ui/WfrpRollModal.tsx`:

(a) Add above the component (after imports):

```typescript
type Flair = 'chaos' | 'crit' | 'fumble' | 'autoSuccess' | 'autoFailure' | null;

// Priority: 88 is Chaos-flavored above all; doubles crit/fumble; then RAW auto bands.
function flairOf(r: WfrpRollResult): Flair {
  if (r.roll === 88) return 'chaos';
  if (r.isCrit) return 'crit';
  if (r.isFumble) return 'fumble';
  if (r.roll <= 5) return 'autoSuccess';
  if (r.roll >= 96) return 'autoFailure';
  return null;
}

const GOLD = '#d4af37';
const CHAOS_PURPLE = '#8b30c9';

const FLAIR_CAPTION = {
  chaos: 'ui.wfrpRoll.flairChaos',
  autoSuccess: 'ui.wfrpRoll.flairAutoSuccess',
  autoFailure: 'ui.wfrpRoll.flairAutoFailure',
} as const;
```

(b) Add a shake shared value next to the existing ones and fold it into the animated style:

```typescript
  const shakeX = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value * bounce.value }],
    opacity: opacity.value,
  }));
```

(c) Replace the body of the `if (result)` branch in the `useEffect`:

```typescript
    if (result) {
      setEditing(false);
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
      const flair = flairOf(result);
      if (flair === 'crit' || flair === 'autoSuccess') {
        bounce.value = withSequence(
          withTiming(1.18, { duration: 110 }),
          withSpring(1, { damping: 8, stiffness: 260 }),
        );
      } else {
        bounce.value = withSequence(
          withTiming(1.12, { duration: 100 }),
          withSpring(1, { damping: 12, stiffness: 300 }),
        );
      }
      if (flair === 'fumble' || flair === 'chaos' || flair === 'autoFailure') {
        shakeX.value = withSequence(
          withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
          withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      } else {
        shakeX.value = 0;
      }
    } else {
```

(d) After the `if (!result) return null;` guard, derive flair + colors (replacing the current `headColor` assignment):

```typescript
  const flair = flairOf(result);
  const crit = result.isCrit;
  const fumble = result.isFumble;
  const headColor = flair === 'chaos' ? CHAOS_PURPLE
    : crit ? GOLD
    : fumble ? t.colors.danger
    : result.success ? t.colors.success : t.colors.danger;
  const headLabel = crit ? 'CRITICAL!' : fumble ? 'FUMBLE!'
    : result.success ? 'SUCCESS' : 'FAILURE';
```

(e) Render the caption directly under the `slBadge` View (before `diffRow`):

```tsx
            {flair && flair in FLAIR_CAPTION && (
              <Text style={[styles.flair, { color: headColor }]}>
                {tr(FLAIR_CAPTION[flair as keyof typeof FLAIR_CAPTION])}
              </Text>
            )}
```

(f) Add the style:

```typescript
  flair: { fontSize: 12, fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
```

- [ ] **Step 3: Typecheck + full test suite**

Run: `npm run typecheck && npm test 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4: Manual browser verification**

Start the dev server via the launch config (`preview_start {name}` in Claude Code, or `npx expo start` + `w`). Open a WFRP character, tap a characteristic to roll, then tap the big number and type each of these rolls, checking the modal:
- `88` → purple border/labels, shake, caption "The Dark Gods take notice"
- `03` → success even vs tiny target; caption "01–05 always succeeds"; big bounce
- `97` → failure even vs huge target; caption "96–00 always fails"; shake
- `44` vs a target ≥44 → gold CRITICAL! with big bounce; vs a target <44 → red FUMBLE! with shake

Switch language to Spanish in Settings and re-check the captions.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/WfrpRollModal.tsx src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(wfrp4e): special-roll animations (chaos 88, crit/fumble, auto bands)"
```

---

### Task 6: Feature — translatable characteristic abbreviations

Replace hardcoded `CHARACTERISTIC_ABBREV[k]` display usages with typed `tr(\`wfrp.char.${k}\`)`. The template-literal key is a union of 10 valid `TKey`s, so no cast is needed. Spanish uses the Devir abbreviations.

**Files:**
- Modify: `src/i18n/en.ts` (new `wfrp.char` sub-tree), `src/i18n/es.ts`
- Modify: `src/components/wfrp4e/Characteristics.tsx:36`
- Modify: `src/components/wfrp4e/CharacteristicsDetail.tsx:97`
- Modify: `src/components/wfrp4e/WfrpSkills.tsx:73,137`
- Modify: `src/components/wfrp4e/SpeciesEditor.tsx:124`
- Modify: `src/components/wfrp4e/GrantedListsFields.tsx:50,61`
- Modify: `src/components/wfrp4e/Buffs.tsx:27`

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en.ts`, inside the top-level `wfrp` object, add a `char` sub-object (verify no existing `char` key first — `grep -n "char:" src/i18n/en.ts`):

```typescript
    char: {
      ws: 'WS', bs: 'BS', s: 'S', t: 'T', i: 'I',
      ag: 'Ag', dex: 'Dex', int: 'Int', wp: 'WP', fel: 'Fel',
    },
```

In `src/i18n/es.ts`, inside `wfrp` (Devir Spanish edition abbreviations):

```typescript
    char: {
      ws: 'HA', bs: 'HP', s: 'F', t: 'R', i: 'I',
      ag: 'Ag', dex: 'Des', int: 'Int', wp: 'V', fel: 'Em',
    },
```

- [ ] **Step 2: Replace display usages**

In each file below, change `CHARACTERISTIC_ABBREV[x]` to `` tr(`wfrp.char.${x}`) `` (the variable name differs per file). All of these components already call `useTranslation()` — if one doesn't (check `GrantedListsFields.tsx` and `SpeciesEditor.tsx`), add `const tr = useTranslation();` with the import `import { useTranslation } from '@/i18n';`.

- `Characteristics.tsx:36` — `{tr(\`wfrp.char.${k}\`)}`
- `CharacteristicsDetail.tsx:97` — `{tr(\`wfrp.char.${k}\`)}`
- `WfrpSkills.tsx:73` — `{tr(\`wfrp.char.${s.characteristic}\`)}`
- `WfrpSkills.tsx:137` — `{tr(\`wfrp.char.${c}\`)}`
- `SpeciesEditor.tsx:124` — `{tr(\`wfrp.char.${k}\`)}`
- `GrantedListsFields.tsx:50` — `{tr(\`wfrp.char.${s.characteristic}\`)}`
- `GrantedListsFields.tsx:61` — `{tr(\`wfrp.char.${skillChar}\`)}`
- `Buffs.tsx:27` (inside `targetLabel(target, tr)` which already receives `tr: TFunc`) — `return tr(\`wfrp.char.${target}\`);`

Then remove the now-unused `CHARACTERISTIC_ABBREV` import from each file where nothing else uses it.

- [ ] **Step 3: Decide fate of the constant**

Run: `grep -rn "CHARACTERISTIC_ABBREV" src/`
If only the definition in `src/types/wfrp4e.ts` remains (no test/component usage), delete the constant. If tests use it, leave it and note in the PR body.

- [ ] **Step 4: Typecheck + tests + visual check**

Run: `npm run typecheck && npm test 2>&1 | tail -5`
Expected: clean. Then in the browser preview, switch to Spanish and confirm the characteristics grid shows HA/HP/F/R/I/Ag/Des/Int/V/Em, and the skills list + buff chips follow.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts src/components/wfrp4e/ src/types/wfrp4e.ts
git commit -m "feat(wfrp4e): translatable characteristic abbreviations (ES: HA/HP/F/R...)"
```

---

### Task 7: Final verification + ship

**Files:**
- Modify: `TODO.md` (mark shipped items / adjust backlog wording if these items are listed)

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test 2>&1 | tail -5 && npm run typecheck`
Expected: all green.

- [ ] **Step 2: End-to-end browser pass (Spanish locale)**

In the preview, with language = Español:
1. Add two armour pieces with Spanish locations (e.g. "Cabeza", "Torso, Brazos"), equip only one, tap AP auto-fill → only the equipped piece's AP appears.
2. Open a book spell's wiki popup → subtitle shows Spanish range/duration (e.g. "Toque · … · Bonificación de Voluntad asaltos").
3. Roll and manually enter 88 / 03 / 97 / 44 → flairs as specified.
4. Characteristics grid shows HA/HP/F/R/…

- [ ] **Step 3: Update TODO.md**

Mark/record the five shipped items in the appropriate section (follow the existing `- [x] **Title.** description` style).

- [ ] **Step 4: Push, open PR, merge (user standing preference: always merge)**

```bash
git add TODO.md docs/superpowers/plans/2026-07-14-wfrp-sheet-fixes.md -- ':!CLAUDE.md'
git commit -m "docs: TODO update + implementation plan for WFRP sheet fixes"
git push -u origin feat/wfrp-sheet-fixes
gh pr create --title "fix/feat(wfrp4e): equipped-only AP, ES locations, ES spell range/duration, special-roll flair, translatable abbrevs" --body "$(cat <<'EOF'
- fix: AP auto-fill counts only equipped armour
- fix: armour location matching recognizes Spanish names (synonym table, extensible per language)
- feat: Spanish range/duration on all 579 book spells (seed es-6, generator script in scripts/)
- feat: RAW auto-success 01-05 / auto-failure 96-00 in the dice engine
- feat: roll-modal flair — chaos 88 (purple + shake), gold crit bounce, fumble shake, auto-band captions (EN/ES)
- feat: characteristic abbreviations via i18n (ES: HA/HP/F/R/I/Ag/Des/Int/V/Em)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --squash --delete-branch
```

Expected: PR merged into `main`.
