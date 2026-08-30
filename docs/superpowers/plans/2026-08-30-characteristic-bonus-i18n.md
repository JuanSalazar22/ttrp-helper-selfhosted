# Characteristic Bonus i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WFRP4e's "characteristic bonus" abbreviations (SB, TB, WPB, etc.) follow the active locale everywhere they appear, for all 10 characteristics, instead of being hardcoded in English.

**Architecture:** Ten new translated labels (`wfrp.charBonus.*`) alongside the existing `wfrp.char.*` block; three display sites swap their hardcoded English text for a `tr()` lookup (always correct, recomputed every render); one data-transform function (`weaponFromRecord`) gains a parameter so newly-picked weapons bake in the correct label at pick time.

**Tech Stack:** Existing i18n system (`src/i18n/{en,es}.ts`), no new dependencies.

**Reference doc:** [2026-08-30-characteristic-bonus-i18n-design.md](../specs/2026-08-30-characteristic-bonus-i18n-design.md)

**Working directory:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted`.

---

## Task 1: i18n keys in both locale files

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Find the existing `char` block in both files**

```bash
grep -n "char: {" src/i18n/en.ts src/i18n/es.ts
```

- [ ] **Step 2: Add `charBonus` to `src/i18n/en.ts`**

Find:
```typescript
    char: {
      ws: 'WS', bs: 'BS', s: 'S', t: 'T', i: 'I',
      ag: 'Ag', dex: 'Dex', int: 'Int', wp: 'WP', fel: 'Fel',
    },
```
Change to:
```typescript
    char: {
      ws: 'WS', bs: 'BS', s: 'S', t: 'T', i: 'I',
      ag: 'Ag', dex: 'Dex', int: 'Int', wp: 'WP', fel: 'Fel',
    },
    charBonus: {
      ws: 'WSB', bs: 'BSB', s: 'SB', t: 'TB', i: 'IB',
      ag: 'AgB', dex: 'DexB', int: 'IntB', wp: 'WPB', fel: 'FelB',
    },
```

- [ ] **Step 3: Add `charBonus` to `src/i18n/es.ts`**

Find:
```typescript
    char: {
      ws: 'HA', bs: 'HP', s: 'F', t: 'R', i: 'I',
      ag: 'Ag', dex: 'Des', int: 'Int', wp: 'V', fel: 'Em',
    },
```
Change to:
```typescript
    char: {
      ws: 'HA', bs: 'HP', s: 'F', t: 'R', i: 'I',
      ag: 'Ag', dex: 'Des', int: 'Int', wp: 'V', fel: 'Em',
    },
    charBonus: {
      ws: 'BHA', bs: 'BHP', s: 'BF', t: 'BR', i: 'BI',
      ag: 'BAg', dex: 'BDes', int: 'BInt', wp: 'BV', fel: 'BEm',
    },
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(i18n): charBonus abbreviations for all 10 characteristics, EN+ES"
```

---

## Task 2: `weaponFromRecord` takes a locale-aware label; wire up its call sites

**Files:**
- Modify: `src/lib/wfrpTrappings.ts`
- Modify: `src/components/wfrp4e/Combat.tsx`

- [ ] **Step 1: Read both files' relevant sections first**

```bash
grep -n "weaponFromRecord" src/lib/wfrpTrappings.ts src/components/wfrp4e/Combat.tsx
```

- [ ] **Step 2: Add the `sbLabel` parameter**

In `src/lib/wfrpTrappings.ts`, find:
```typescript
/** Trimmed trapping record → weapon draft. Handles both melee and ranged profiles. */
export function weaponFromRecord(r: ContentRecord): WeaponDraft {
  const melee = r.melee as { dmg?: number; dmgSbMult?: number; group?: number; reach?: number } | undefined;
  const ranged = r.ranged as { dmg?: number; dmgSbMult?: number; group?: number; rng?: number } | undefined;
  const w = melee ?? ranged ?? {};
  const dmg = w.dmg ?? 0;
  const damage = w.dmgSbMult ? `SB+${dmg}` : String(dmg);
```
Change to:
```typescript
/** Trimmed trapping record → weapon draft. Handles both melee and ranged profiles.
 *  `sbLabel` is the caller's already-locale-resolved Strength Bonus abbreviation
 *  (e.g. tr('wfrp.charBonus.s')) — this file has no i18n import of its own, since
 *  it's otherwise a pure data-transform utility. Only affects newly-picked weapons;
 *  a weapon's damage text, once saved, is free text like any other and doesn't
 *  re-localize retroactively (same as manually-typed damage). */
export function weaponFromRecord(r: ContentRecord, sbLabel: string): WeaponDraft {
  const melee = r.melee as { dmg?: number; dmgSbMult?: number; group?: number; reach?: number } | undefined;
  const ranged = r.ranged as { dmg?: number; dmgSbMult?: number; group?: number; rng?: number } | undefined;
  const w = melee ?? ranged ?? {};
  const dmg = w.dmg ?? 0;
  const damage = w.dmgSbMult ? `${sbLabel}+${dmg}` : String(dmg);
```

- [ ] **Step 3: Update both call sites in `Combat.tsx`**

Find:
```typescript
      <ContentPicker
        visible={weaponPicking}
        category="trapping"
        title={tr('wfrp.combat.weapons')}
        filter={isWeapon}
        subtitle={(r) => { const w = weaponFromRecord(r); return [w.group, w.damage].filter(Boolean).join(' · '); }}
        onSelect={(r) => setWeaponDraft(weaponFromRecord(r))}
        onClose={() => setWeaponPicking(false)}
      />
```
Change to:
```typescript
      <ContentPicker
        visible={weaponPicking}
        category="trapping"
        title={tr('wfrp.combat.weapons')}
        filter={isWeapon}
        subtitle={(r) => { const w = weaponFromRecord(r, tr('wfrp.charBonus.s')); return [w.group, w.damage].filter(Boolean).join(' · '); }}
        onSelect={(r) => setWeaponDraft(weaponFromRecord(r, tr('wfrp.charBonus.s')))}
        onClose={() => setWeaponPicking(false)}
      />
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: clean — this also confirms there are no OTHER call sites of `weaponFromRecord` left with the old single-argument signature anywhere in the codebase (a stale call site would now be a type error, since `sbLabel` is a required parameter).

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```
Expected: all passing, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wfrpTrappings.ts src/components/wfrp4e/Combat.tsx
git commit -m "feat(i18n): weaponFromRecord uses the locale-resolved Strength Bonus label"
```

---

## Task 3: Fix the 3 render-time display sites

**Files:**
- Modify: `src/components/wfrp4e/Resources.tsx`
- Modify: `src/components/wfrp4e/Trappings.tsx`
- Modify: `src/components/wfrp4e/SpeciesEditor.tsx`

- [ ] **Step 1: Read all three files' relevant sections first**

```bash
grep -n "SB\|TB\|WPB" src/components/wfrp4e/Resources.tsx src/components/wfrp4e/Trappings.tsx src/components/wfrp4e/SpeciesEditor.tsx
```

- [ ] **Step 2: Fix `Resources.tsx`**

Find:
```typescript
            {coeffs.sb}×SB {sb} + {coeffs.tb}×TB {tb} + {coeffs.wpb}×WPB {wpb} + mod {character.wounds.modifier}
```
Change to:
```typescript
            {coeffs.sb}×{tr('wfrp.charBonus.s')} {sb} + {coeffs.tb}×{tr('wfrp.charBonus.t')} {tb} + {coeffs.wpb}×{tr('wfrp.charBonus.wp')} {wpb} + mod {character.wounds.modifier}
```

- [ ] **Step 3: Fix `Trappings.tsx`**

Find:
```typescript
          SB {sb} + TB {tb} + mod {encMod}{capBonus !== 0 ? ` + cap ${capBonus}` : ''}
```
Change to:
```typescript
          {tr('wfrp.charBonus.s')} {sb} + {tr('wfrp.charBonus.t')} {tb} + mod {encMod}{capBonus !== 0 ? ` + cap ${capBonus}` : ''}
```

- [ ] **Step 4: Fix `SpeciesEditor.tsx`**

Find:
```typescript
  const coeffFields: Array<{ label: string; value: string; set: (v: string) => void }> = [
    { label: '× SB', value: coeffs.sb, set: (v) => setCoeffs(c => ({ ...c, sb: v })) },
    { label: '× TB', value: coeffs.tb, set: (v) => setCoeffs(c => ({ ...c, tb: v })) },
    { label: '× WPB', value: coeffs.wpb, set: (v) => setCoeffs(c => ({ ...c, wpb: v })) },
  ];
```
Change to:
```typescript
  const coeffFields: Array<{ label: string; value: string; set: (v: string) => void }> = [
    { label: `× ${tr('wfrp.charBonus.s')}`, value: coeffs.sb, set: (v) => setCoeffs(c => ({ ...c, sb: v })) },
    { label: `× ${tr('wfrp.charBonus.t')}`, value: coeffs.tb, set: (v) => setCoeffs(c => ({ ...c, tb: v })) },
    { label: `× ${tr('wfrp.charBonus.wp')}`, value: coeffs.wpb, set: (v) => setCoeffs(c => ({ ...c, wpb: v })) },
  ];
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
Expected: all passing, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/wfrp4e/Resources.tsx src/components/wfrp4e/Trappings.tsx src/components/wfrp4e/SpeciesEditor.tsx
git commit -m "feat(i18n): Resources/Trappings/SpeciesEditor use translated characteristic-bonus labels"
```

---

## Task 4: Manual verification

No new files — this exercises all 3 prior tasks together.

- [ ] **Step 1: Start the app**

```bash
npx expo start --web
```

- [ ] **Step 2: Switch to Spanish and verify the live-updating sites**

Open a WFRP4e character, switch the app's locale to Spanish (Settings tab). Verify, without reloading:
- The Max Wounds breakdown (Resources section) shows `BF`/`BR`/`BV` instead of `SB`/`TB`/`WPB`.
- The Trappings/encumbrance breakdown shows `BF`/`BR` instead of `SB`/`TB`.
- Open the species editor (wherever the Max-Wounds-coefficient fields are reachable from — check `SpeciesEditor.tsx`'s actual entry point in the running app if not obvious) and confirm the coefficient labels show `× BF` / `× BR` / `× BV`.

- [ ] **Step 3: Verify the weapon pick-time fix**

While still in Spanish, add a weapon via the book-content picker whose damage includes a Strength Bonus (search for one known to have it, e.g. a common melee weapon — confirm by checking the resulting damage text). Confirm the saved weapon shows `BF+N`, not `SB+N`.

- [ ] **Step 4: Verify switching back to English**

Switch the locale back to English. Confirm Resources/Trappings/SpeciesEditor immediately show `SB`/`TB`/`WPB` again (live sections). Confirm the weapon added in Step 3 still shows `BF+N` (unchanged — matches the documented non-goal that existing weapon text doesn't retroactively re-localize).

- [ ] **Step 5: Push**

```bash
git push
```
