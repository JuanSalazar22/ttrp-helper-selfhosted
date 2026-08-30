# Computed Final Weapon Damage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the resolved damage total next to each weapon's free-text damage formula, computed live from the character's current stats, supporting multi-characteristic expressions with `+`, `x`/`*` multiplication (higher precedence), and parentheses, in either English or Spanish characteristic-bonus abbreviations.

**Architecture:** A new pure module, `weaponDamageFormula.ts`, tokenizes and parses the formula string into an arithmetic expression (numbers, characteristic-bonus abbreviations, `+`, `x`/`*`, parens) and evaluates it directly against the character via the existing `characteristicBonus()`. `Combat.tsx` calls it per weapon at render time and appends the result to the row's subtitle.

**Tech Stack:** TypeScript, no new dependencies.

---

### Task 1: `weaponDamageFormula.ts` — tokenizer, parser, evaluator

**Files:**
- Create: `src/components/wfrp4e/weaponDamageFormula.ts`
- Test: `src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts`:

```typescript
import { resolveWeaponDamage } from '../weaponDamageFormula';
import { defaultWfrp4eCharacter } from '@/types/wfrp4e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

// SB = 3, TB = 4, WPB = 5, DexB = 6 — round numbers chosen so expected totals
// are easy to verify by hand.
function testChar(): Wfrp4eCharacter {
  const char = defaultWfrp4eCharacter('Test');
  char.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 };
  char.characteristics.t = { roll: 40, racial: 0, other: 0, advances: 0 };
  char.characteristics.wp = { roll: 50, racial: 0, other: 0, advances: 0 };
  char.characteristics.dex = { roll: 60, racial: 0, other: 0, advances: 0 };
  return char;
}

describe('resolveWeaponDamage', () => {
  test('single characteristic plus a flat number', () => {
    expect(resolveWeaponDamage(testChar(), 'SB+4')).toBe(7);
  });

  test('Spanish abbreviation resolves the same characteristic', () => {
    expect(resolveWeaponDamage(testChar(), 'BF+4')).toBe(7);
  });

  test('a bonus-alone formula (no flat number) resolves to just the bonus', () => {
    expect(resolveWeaponDamage(testChar(), 'WPB')).toBe(5);
  });

  test('multiple characteristic terms plus a flat number', () => {
    expect(resolveWeaponDamage(testChar(), 'SB+TB+4')).toBe(11); // 3+4+4
  });

  test('multiplication binds tighter than addition', () => {
    expect(resolveWeaponDamage(testChar(), 'SBx2+TB+4')).toBe(14); // (3*2)+4+4
  });

  test('explicit parentheses produce the same result as implicit precedence', () => {
    expect(resolveWeaponDamage(testChar(), '(SBx2)+TB+4')).toBe(14);
  });

  test('a literal * also works as multiply', () => {
    expect(resolveWeaponDamage(testChar(), 'SB*2+TB+4')).toBe(14);
  });

  test('repeating a characteristic sums its bonus each time', () => {
    expect(resolveWeaponDamage(testChar(), 'SB+SB+4')).toBe(10); // 3+3+4
  });

  test('DexB is read as one token, not split on its internal "x"', () => {
    expect(resolveWeaponDamage(testChar(), 'DexB+2')).toBe(8); // 6+2, not a De*B misparse
  });

  test('a bare number has nothing new to show, so it resolves to null', () => {
    expect(resolveWeaponDamage(testChar(), '6')).toBeNull();
  });

  test('a pure-numeric expression with no characteristic term also resolves to null', () => {
    expect(resolveWeaponDamage(testChar(), '4+2')).toBeNull();
  });

  test('unparseable text resolves to null', () => {
    expect(resolveWeaponDamage(testChar(), 'a fistful of pain')).toBeNull();
  });

  test('an unmatched parenthesis resolves to null', () => {
    expect(resolveWeaponDamage(testChar(), '(SB+4')).toBeNull();
  });

  test('an empty or whitespace-only formula resolves to null', () => {
    expect(resolveWeaponDamage(testChar(), '')).toBeNull();
    expect(resolveWeaponDamage(testChar(), '   ')).toBeNull();
  });

  test('is case-insensitive and tolerates stray whitespace', () => {
    expect(resolveWeaponDamage(testChar(), 'sb + 4')).toBe(7);
    expect(resolveWeaponDamage(testChar(), '  SB+4  ')).toBe(7);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts`
Expected: FAIL — `Cannot find module '../weaponDamageFormula'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `weaponDamageFormula.ts`**

Create `src/components/wfrp4e/weaponDamageFormula.ts`:

```typescript
import { characteristicBonus } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

// Fixed rulebook abbreviations for each characteristic bonus, English and
// Spanish (mirrors wfrp.charBonus in src/i18n/en.ts and src/i18n/es.ts — keep
// these in sync if those ever change). Matched case-insensitively.
const ABBREV_TO_KEY: Record<string, CharacteristicKey> = {
  WSB: 'ws', BSB: 'bs', SB: 's', TB: 't', IB: 'i',
  AGB: 'ag', DEXB: 'dex', INTB: 'int', WPB: 'wp', FELB: 'fel',
  BHA: 'ws', BHP: 'bs', BF: 's', BR: 't', BI: 'i',
  BAG: 'ag', BDES: 'dex', BINT: 'int', BV: 'wp', BEM: 'fel',
};

// Sorted longest-first so the tokenizer greedily matches e.g. "BINT" before
// falling back to the shorter "BI" (a real prefix collision in the table
// above), and so "DEXB" is consumed as one token instead of splitting off
// its internal "x" as a multiply operator.
const ABBREV_ENTRIES: Array<[string, CharacteristicKey]> = Object.entries(ABBREV_TO_KEY).sort(
  (a, b) => b[0].length - a[0].length,
);

type Token =
  | { type: 'NUMBER'; value: number }
  | { type: 'ABBREV'; key: CharacteristicKey }
  | { type: 'PLUS' }
  | { type: 'TIMES' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

/** Turns a formula string into tokens, or null on any unrecognized character. */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '+') { tokens.push({ type: 'PLUS' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }

    let matchedAbbrev = false;
    for (const [abbrev, key] of ABBREV_ENTRIES) {
      if (input.slice(i, i + abbrev.length).toUpperCase() === abbrev) {
        tokens.push({ type: 'ABBREV', key });
        i += abbrev.length;
        matchedAbbrev = true;
        break;
      }
    }
    if (matchedAbbrev) continue;

    if (ch === 'x' || ch === 'X' || ch === '*') { tokens.push({ type: 'TIMES' }); i++; continue; }

    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < n && input[j] >= '0' && input[j] <= '9') j++;
      tokens.push({ type: 'NUMBER', value: parseInt(input.slice(i, j), 10) });
      i = j;
      continue;
    }

    return null; // unrecognized character
  }
  return tokens;
}

type ParseState = { tokens: Token[]; pos: number; usedAbbrev: boolean };

function peek(state: ParseState): Token | undefined {
  return state.tokens[state.pos];
}

// expr := term ('+' term)*
function parseExpr(state: ParseState, char: Wfrp4eCharacter): number | null {
  let value = parseTerm(state, char);
  if (value === null) return null;
  while (peek(state)?.type === 'PLUS') {
    state.pos++;
    const rhs = parseTerm(state, char);
    if (rhs === null) return null;
    value += rhs;
  }
  return value;
}

// term := factor (('x'|'X'|'*') factor)*
function parseTerm(state: ParseState, char: Wfrp4eCharacter): number | null {
  let value = parseFactor(state, char);
  if (value === null) return null;
  while (peek(state)?.type === 'TIMES') {
    state.pos++;
    const rhs = parseFactor(state, char);
    if (rhs === null) return null;
    value *= rhs;
  }
  return value;
}

// factor := NUMBER | ABBREV | '(' expr ')'
function parseFactor(state: ParseState, char: Wfrp4eCharacter): number | null {
  const tok = peek(state);
  if (!tok) return null;
  if (tok.type === 'NUMBER') { state.pos++; return tok.value; }
  if (tok.type === 'ABBREV') {
    state.pos++;
    state.usedAbbrev = true;
    return characteristicBonus(char, tok.key);
  }
  if (tok.type === 'LPAREN') {
    state.pos++;
    const value = parseExpr(state, char);
    if (value === null) return null;
    if (peek(state)?.type !== 'RPAREN') return null;
    state.pos++;
    return value;
  }
  return null;
}

/**
 * Resolves a weapon's free-text damage formula (e.g. "SB+4", "(SBx2)+TB+4")
 * against a character's current stats. Recognizes any of the 10
 * characteristic-bonus abbreviations in English or Spanish, `+` for addition,
 * `x`/`X`/`*` for multiplication (binds tighter than `+`), and parentheses
 * for grouping.
 *
 * Returns null — meaning "nothing new to show" — when the formula has no
 * characteristic term at all (a bare number already shows its own final
 * value), or when it fails to parse (unknown token, unmatched parenthesis,
 * trailing garbage, empty string). Never throws.
 */
export function resolveWeaponDamage(char: Wfrp4eCharacter, formula: string): number | null {
  const trimmed = formula.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return null;

  const state: ParseState = { tokens, pos: 0, usedAbbrev: false };
  const value = parseExpr(state, char);
  if (value === null) return null;
  if (state.pos !== tokens.length) return null; // trailing tokens after a valid expression
  if (!state.usedAbbrev) return null;

  return value;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts`
Expected: PASS — all 16 tests green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors (ignore any pre-existing errors under `.worktrees/native-passkeys` — a known, unrelated stray worktree checked out inside this same repo).

- [ ] **Step 6: Commit**

```bash
git add src/components/wfrp4e/weaponDamageFormula.ts src/components/wfrp4e/__tests__/weaponDamageFormula.test.ts
git commit -m "feat(wfrp): parse and resolve weapon damage formulas (SB+4, multi-term, x/parens)"
```

---

### Task 2: Wire into `Combat.tsx`

**Files:**
- Modify: `src/components/wfrp4e/Combat.tsx`

- [ ] **Step 1: Add the import**

In `src/components/wfrp4e/Combat.tsx`, find this existing import block near the top of the file:

```typescript
import { isWeapon, isArmour, weaponFromRecord, armourFromRecord } from '@/lib/wfrpTrappings';
import { armourPointsByLocation } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, ArmourLocation } from '@/types/wfrp4e';
```

Add one line right after it:

```typescript
import { isWeapon, isArmour, weaponFromRecord, armourFromRecord } from '@/lib/wfrpTrappings';
import { armourPointsByLocation } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, ArmourLocation } from '@/types/wfrp4e';
import { resolveWeaponDamage } from './weaponDamageFormula';
```

- [ ] **Step 2: Show the resolved value in the weapon row**

Find this exact block (the weapons list, inside the `<Section title={tr('wfrp.combat.weapons')}>`):

```typescript
        {character.weapons.map(w => (
          <View key={w.id} style={[styles.row, { borderColor: t.colors.border }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditWeapon(w)}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{w.name}</Text>
              <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
                {[w.damage, w.group].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.encLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.enc', { n: w.encumbrance })}</Text>
            <TouchableOpacity
              onPress={() => toggleWeaponEquipped(w.id)}
              style={[styles.equipChip, {
                borderColor: w.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: w.equipped ? t.colors.accent : 'transparent',
              }]}
              accessibilityLabel={tr(w.equipped ? 'wfrp.equip.unequipA11y' : 'wfrp.equip.equipA11y', { name: w.name })}
            >
              <Text style={[styles.equipChipText, { color: w.equipped ? t.colors.accentText : t.colors.textSecondary }]}>
                {tr(w.equipped ? 'wfrp.equip.equipped' : 'wfrp.equip.equip')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeWeapon(w.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
```

Replace it with (only the `.map()` callback signature and the first `<Text>`'s content change — everything else is unchanged):

```typescript
        {character.weapons.map(w => {
          const resolved = resolveWeaponDamage(character, w.damage);
          const damageLabel = resolved !== null ? `${w.damage} (${resolved})` : w.damage;
          return (
            <View key={w.id} style={[styles.row, { borderColor: t.colors.border }]}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditWeapon(w)}>
                <Text style={[styles.itemName, { color: t.colors.text }]}>{w.name}</Text>
                <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
                  {[damageLabel, w.group].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.encLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.enc', { n: w.encumbrance })}</Text>
              <TouchableOpacity
                onPress={() => toggleWeaponEquipped(w.id)}
                style={[styles.equipChip, {
                  borderColor: w.equipped ? t.colors.accent : t.colors.border,
                  backgroundColor: w.equipped ? t.colors.accent : 'transparent',
                }]}
                accessibilityLabel={tr(w.equipped ? 'wfrp.equip.unequipA11y' : 'wfrp.equip.equipA11y', { name: w.name })}
              >
                <Text style={[styles.equipChipText, { color: w.equipped ? t.colors.accentText : t.colors.textSecondary }]}>
                  {tr(w.equipped ? 'wfrp.equip.equipped' : 'wfrp.equip.equip')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeWeapon(w.id)} style={styles.del}>
                <Trash2 size={14} color={t.colors.danger} />
              </TouchableOpacity>
            </View>
          );
        })}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors (same caveat about `.worktrees/native-passkeys` as above).

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites pass (the count may appear roughly doubled if `.worktrees/native-passkeys` is still checked out inside this repo — expected, not a regression).

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/Combat.tsx
git commit -m "feat(wfrp): show resolved weapon damage next to the formula"
```

---

### Task 3: Manual verification

Run directly by the controller with Browser tools (not dispatched to a subagent) — matches how prior plans in this session handled their final manual-verification task.

- [ ] **Step 1:** Start the web dev server and open a WFRP4e character with at least one book-sourced weapon (already shaped like `"SB+N"`, e.g. Dagger or any melee weapon added via "Search the book").

- [ ] **Step 2:** Confirm the weapon row now shows the formula plus a parenthesized resolved number, e.g. `"SB+4 (7) · Basic"`, and that the number matches hand-computed Strength Bonus + the flat part.

- [ ] **Step 3:** Open the character's Strength characteristic and change its value (add advances or edit `other`). Return to the weapon row and confirm the resolved number updated without any other action.

- [ ] **Step 4:** Edit a weapon's damage field to a multi-term formula, e.g. `"SB+TB+4"`, confirm it resolves correctly. Try `"(SBx2)+TB+4"` and confirm it resolves to the same value as `"SBx2+TB+4"`.

- [ ] **Step 5:** Edit a weapon's damage field to a bare number (e.g. `"6"`) and confirm the parenthetical disappears (row shows just `"6 · Basic"`).

- [ ] **Step 6:** Switch the app locale to Spanish, add/edit a weapon with a Spanish-abbreviation formula (e.g. `"BF+4"`), and confirm it still resolves correctly.

- [ ] **Step 7:** Remove the completed TODO.md entry for this feature (the "Show computed final weapon damage" line under "Near-term features") and commit:

```bash
git add TODO.md
git commit -m "docs: mark computed weapon damage as shipped"
```
