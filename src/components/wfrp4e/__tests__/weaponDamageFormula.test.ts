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
