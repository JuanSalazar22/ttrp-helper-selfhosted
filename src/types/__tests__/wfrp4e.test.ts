import { characteristicTotal, defaultWfrp4eCharacter, healSpeciesLibrary } from '../wfrp4e';
import type { Wfrp4eCharacter, WfrpSpeciesDef, CharacteristicKey } from '../wfrp4e';

describe('characteristicTotal', () => {
  test('sums roll + racial + other + advances', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.ws = { roll: 11, racial: 20, other: 1, advances: 5 };
    expect(characteristicTotal(char, 'ws')).toBe(37);
  });

  test('defaultWfrp4eCharacter starts every characteristic at zero', () => {
    const char = defaultWfrp4eCharacter('Test');
    for (const k of Object.keys(char.characteristics) as Array<keyof Wfrp4eCharacter['characteristics']>) {
      expect(char.characteristics[k]).toEqual({ roll: 0, racial: 0, other: 0, advances: 0 });
      expect(characteristicTotal(char, k)).toBe(0);
    }
  });
});

import { migrateWfrp4eCharacter } from '../wfrp4e';
import { characteristicBonus, woundsMax } from '../wfrp4e';
import { advanceCost } from '../wfrp4e';

describe('migrateWfrp4eCharacter', () => {
  test('maps old base -> roll, zeros racial/other, keeps advances, preserves total', () => {
    const old: any = {
      system: 'wfrp4e',
      schemaVer: 1,
      characteristics: {
        ws: { base: 31, advances: 5 },
        bs: { base: 40, advances: 0 },
        s: { base: 30, advances: 0 }, t: { base: 30, advances: 0 },
        i: { base: 30, advances: 0 }, ag: { base: 30, advances: 0 },
        dex: { base: 30, advances: 0 }, int: { base: 30, advances: 0 },
        wp: { base: 30, advances: 0 }, fel: { base: 30, advances: 0 },
      },
    };
    const migrated = migrateWfrp4eCharacter(old);
    expect(migrated.characteristics.ws).toEqual({ roll: 31, racial: 0, other: 0, advances: 5 });
    expect(characteristicTotal(migrated, 'ws')).toBe(36);
    expect(migrated.schemaVer).toBe(9);
  });

  test('is idempotent on an already-migrated character', () => {
    const current = defaultWfrp4eCharacter('Test');
    current.characteristics.ws = { roll: 11, racial: 20, other: 0, advances: 3 };
    const migrated = migrateWfrp4eCharacter(current);
    expect(migrated.characteristics.ws).toEqual({ roll: 11, racial: 20, other: 0, advances: 3 });
    expect(migrated.schemaVer).toBe(9);
  });
});

describe('characteristicBonus', () => {
  test('is the tens digit of the characteristic total', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 2 }; // total 37
    char.characteristics.t = { roll: 9, racial: 0, other: 0, advances: 0 };  // total 9
    expect(characteristicBonus(char, 's')).toBe(3);
    expect(characteristicBonus(char, 't')).toBe(0);
  });
});

describe('woundsMax', () => {
  test('SB + 2*TB + WPB + modifier', () => {
    const char = defaultWfrp4eCharacter('Test');
    char.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    char.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    char.characteristics.wp = { roll: 28, racial: 0, other: 0, advances: 0 }; // WPB 2
    char.wounds = { current: 0, modifier: 1 };
    expect(woundsMax(char)).toBe(3 + 2 * 4 + 2 + 1); // 14
  });
});

describe('migrateWfrp4eCharacter wounds', () => {
  test('old {current,max} -> {current,modifier:0}, current clamped, max recomputed', () => {
    const old: any = {
      system: 'wfrp4e',
      schemaVer: 2,
      characteristics: {
        ws: { roll: 0, racial: 0, other: 0, advances: 0 },
        bs: { roll: 0, racial: 0, other: 0, advances: 0 },
        s: { roll: 35, racial: 0, other: 0, advances: 0 },  // SB 3
        t: { roll: 42, racial: 0, other: 0, advances: 0 },  // TB 4
        i: { roll: 0, racial: 0, other: 0, advances: 0 },
        ag: { roll: 0, racial: 0, other: 0, advances: 0 },
        dex: { roll: 0, racial: 0, other: 0, advances: 0 },
        int: { roll: 0, racial: 0, other: 0, advances: 0 },
        wp: { roll: 28, racial: 0, other: 0, advances: 0 }, // WPB 2
        fel: { roll: 0, racial: 0, other: 0, advances: 0 },
      },
      wounds: { current: 12, max: 99 },
    };
    const migrated = migrateWfrp4eCharacter(old);
    expect(migrated.wounds).toEqual({ current: 12, modifier: 0 });
    expect(woundsMax(migrated)).toBe(13); // 3 + 2*4 + 2 + 0
    expect(migrated.schemaVer).toBe(9);
  });

  test('clamps current down to the recomputed max', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 2,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 25, max: 25 },
    };
    const migrated = migrateWfrp4eCharacter(old); // all stats 0 -> max 0
    expect(woundsMax(migrated)).toBe(0);
    expect(migrated.wounds.current).toBe(0);
  });

  test('idempotent on an already-migrated character', () => {
    const current = defaultWfrp4eCharacter('Test');
    current.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 }; // TB 3 -> max 6
    current.wounds = { current: 4, modifier: 0 };
    const migrated = migrateWfrp4eCharacter(current);
    expect(migrated.wounds).toEqual({ current: 4, modifier: 0 });
    expect(migrated.schemaVer).toBe(9);
  });
});

describe('advanceCost', () => {
  // a = advances already bought; cost is for the NEXT (a+1)-th advance.
  test('characteristic band cost for the next advance', () => {
    expect(advanceCost('characteristic', 0)).toBe(25);   // 1st
    expect(advanceCost('characteristic', 4)).toBe(25);   // 5th
    expect(advanceCost('characteristic', 5)).toBe(30);   // 6th
    expect(advanceCost('characteristic', 9)).toBe(30);   // 10th
    expect(advanceCost('characteristic', 10)).toBe(40);  // 11th
    expect(advanceCost('characteristic', 44)).toBe(190); // 45th
    expect(advanceCost('characteristic', 45)).toBe(230); // 46th
    expect(advanceCost('characteristic', 100)).toBe(230);
  });
  test('skill column is cheaper', () => {
    expect(advanceCost('skill', 0)).toBe(10);
    expect(advanceCost('skill', 4)).toBe(10);
    expect(advanceCost('skill', 5)).toBe(15);
    expect(advanceCost('skill', 30)).toBe(80);
    expect(advanceCost('skill', 44)).toBe(140);
    expect(advanceCost('skill', 45)).toBe(180);
  });
  test('clamps negative input to the first band', () => {
    expect(advanceCost('characteristic', -3)).toBe(25);
  });
});

import { advancesCostRange, talentCostRange, experienceCurrent } from '../wfrp4e';

describe('advancesCostRange', () => {
  test('sums each step within a band', () => {
    expect(advancesCostRange('characteristic', 0, 5)).toBe(25 * 5);
    expect(advancesCostRange('skill', 0, 5)).toBe(10 * 5);
  });
  test('crosses band boundaries (5 @25 + 5 @30)', () => {
    expect(advancesCostRange('characteristic', 0, 10)).toBe(25 * 5 + 30 * 5);
  });
  test('zero range is free; negative range refunds the same amount', () => {
    expect(advancesCostRange('skill', 7, 7)).toBe(0);
    expect(advancesCostRange('skill', 0, 6)).toBe(10 * 5 + 15);
    expect(advancesCostRange('skill', 6, 0)).toBe(-(10 * 5 + 15));
  });
});

describe('talentCostRange', () => {
  test('N-th rank costs N*100 (triangular)', () => {
    expect(talentCostRange(0, 1)).toBe(100);
    expect(talentCostRange(0, 3)).toBe(100 + 200 + 300);
    expect(talentCostRange(2, 4)).toBe(300 + 400);
    expect(talentCostRange(3, 3)).toBe(0);
    expect(talentCostRange(3, 1)).toBe(-(200 + 300));
  });
});

describe('experienceCurrent', () => {
  test('total minus spent, may go negative', () => {
    const c = defaultWfrp4eCharacter('T');
    c.experience = { total: 100, spent: 40 };
    expect(experienceCurrent(c)).toBe(60);
    c.experience = { total: 50, spent: 90 };
    expect(experienceCurrent(c)).toBe(-40);
  });
});

import { encumbranceMaxValue, armourPointsByLocation } from '../wfrp4e';

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

import { corruptionThreshold } from '../wfrp4e';

describe('corruptionThreshold', () => {
  test('TB + WB + modifier', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };   // TB 4
    c.characteristics.wp = { roll: 35, racial: 0, other: 0, advances: 0 };  // WB 3
    c.corruption.modifier = 1;
    expect(corruptionThreshold(c)).toBe(4 + 3 + 1);
  });
  test('modifier defaults to 0', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 };   // TB 3
    c.characteristics.wp = { roll: 20, racial: 0, other: 0, advances: 0 };  // WB 2
    c.corruption.modifier = 0;
    expect(corruptionThreshold(c)).toBe(5);
  });
});

describe('migrateWfrp4eCharacter — corruption', () => {
  test('legacy { current, threshold } drops threshold; modifier defaults to 0', () => {
    const legacy = {
      ...defaultWfrp4eCharacter('T'),
      corruption: { current: 3, threshold: 7 },
    };
    const migrated = migrateWfrp4eCharacter(legacy);
    expect(migrated.corruption).toEqual({ current: 3, modifier: 0 });
  });
  test('new-shape { current, modifier } passes through', () => {
    const c = { ...defaultWfrp4eCharacter('T'), corruption: { current: 2, modifier: 1 } };
    const migrated = migrateWfrp4eCharacter(c);
    expect(migrated.corruption).toEqual({ current: 2, modifier: 1 });
  });
});

describe('armourPointsByLocation', () => {
  test('sums AP per location; bare Arms/Legs cover both sides', () => {
    const c = defaultWfrp4eCharacter('T');
    c.armour = [
      { id: '1', name: 'Mail Shirt', locations: ['Body', 'Arms'], encumbrance: 1, ap: 2, qualities: '', equipped: true },
      { id: '2', name: 'Leather Jerkin', locations: ['Body'], encumbrance: 1, ap: 1, qualities: '', equipped: true },
      { id: '3', name: 'Helm', locations: ['Head'], encumbrance: 0, ap: 2, qualities: '', equipped: true },
      { id: '4', name: 'Greaves', locations: ['Left Leg', 'Right Leg'], encumbrance: 1, ap: 1, qualities: '', equipped: true },
    ];
    expect(armourPointsByLocation(c)).toEqual({
      head: 2, rightArm: 2, leftArm: 2, body: 3, rightLeg: 1, leftLeg: 1, shield: 0,
    });
  });
  test('left/right sides and shield are independent', () => {
    const c = defaultWfrp4eCharacter('T');
    c.armour = [
      { id: '1', name: 'Pauldron', locations: ['Left Arm'], encumbrance: 0, ap: 3, qualities: '', equipped: true },
      { id: '2', name: 'Shield', locations: ['Shield'], encumbrance: 1, ap: 2, qualities: '', equipped: true },
    ];
    const ap = armourPointsByLocation(c);
    expect(ap.leftArm).toBe(3);
    expect(ap.rightArm).toBe(0);
    expect(ap.shield).toBe(2);
  });
  test('no armour is all zero', () => {
    expect(armourPointsByLocation(defaultWfrp4eCharacter('T'))).toEqual({
      head: 0, rightArm: 0, leftArm: 0, body: 0, rightLeg: 0, leftLeg: 0, shield: 0,
    });
  });
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
});

describe('migrateWfrp4eCharacter armourPoints', () => {
  test('old 4-region AP migrates to 6 locations + shield (arms/legs mirrored)', () => {
    const migrated = migrateWfrp4eCharacter({ armourPoints: { head: 1, body: 3, arms: 2, legs: 4 } });
    expect(migrated.armourPoints).toEqual({
      head: 1, rightArm: 2, leftArm: 2, body: 3, rightLeg: 4, leftLeg: 4, shield: 0,
    });
  });
  test('already-migrated AP passes through unchanged', () => {
    const ap = { head: 1, rightArm: 2, leftArm: 0, body: 3, rightLeg: 1, leftLeg: 4, shield: 5 };
    expect(migrateWfrp4eCharacter({ armourPoints: ap }).armourPoints).toEqual(ap);
  });
});

describe('migrateWfrp4eCharacter experience', () => {
  test('adds experience {0,0} when absent and bumps schemaVer to 9', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 4,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 0, modifier: 0 },
    };
    const m = migrateWfrp4eCharacter(old);
    expect(m.experience).toEqual({ total: 0, spent: 0 });
    expect(m.schemaVer).toBe(9);
  });
  test('preserves existing experience', () => {
    const c = defaultWfrp4eCharacter('T');
    c.experience = { total: 1200, spent: 750 };
    expect(migrateWfrp4eCharacter(c).experience).toEqual({ total: 1200, spent: 750 });
  });
});

import { applySpeciesPatch, upsertByName } from '../wfrp4e';

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
    expect((input[0] as any).v).toBe(1);
  });
});

describe('migrateWfrp4eCharacter origin', () => {
  test('adds origin = "" when absent and bumps schemaVer to 9', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 3,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 0, modifier: 0 },
    };
    const m = migrateWfrp4eCharacter(old);
    expect(m.origin).toBe('');
    expect(m.schemaVer).toBe(9);
  });
  test('preserves an existing origin', () => {
    const c = defaultWfrp4eCharacter('T');
    c.origin = 'Reiklander';
    expect(migrateWfrp4eCharacter(c).origin).toBe('Reiklander');
  });
});

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
    const out = mergeGrantedTalents(existing, [{ name: 'Suave' }, { name: '  ' }, { name: 'Savvy' }], makeId);
    expect(out.map(t => t.name)).toEqual(['Suave', 'Savvy']);
    expect(out[1]).toEqual({ id: 't1', name: 'Savvy', timesTaken: 1, description: '', tests: undefined });
  });

  test('populates description and tests from the granted item', () => {
    let n = 0; const makeId = () => `t${++n}`;
    const out = mergeGrantedTalents(
      [],
      [{ name: 'Doomed', description: 'You have a foretold death.', tests: undefined }],
      makeId,
    );
    expect(out[0].description).toBe('You have a foretold death.');
  });
});

import { mergeGrantedTrappings } from '../wfrp4e';

describe('mergeGrantedTrappings', () => {
  test('adds new items with enc/qty/notes, skips existing names (case-insensitive)', () => {
    let n = 0; const makeId = () => `tr${++n}`;
    const existing = [{ id: 'a', name: 'Dagger', encumbrance: 0, qty: 1, equipped: false }];
    const out = mergeGrantedTrappings(existing, [
      { name: 'dagger', qty: 1, enc: 0 },
      { name: 'Hand Weapon', qty: 1, enc: 1 },
      { name: 'Rations', qty: 1, enc: 0, notes: '1 day(s) rations' },
    ], makeId);
    expect(out.map(x => x.name)).toEqual(['Dagger', 'Hand Weapon', 'Rations']);
    expect(out[1]).toEqual({ id: 'tr1', name: 'Hand Weapon', encumbrance: 1, qty: 1, notes: undefined, equipped: false });
    expect(out[2].notes).toBe('1 day(s) rations');
    expect(existing).toHaveLength(1);
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

  test('applySpecies enriches talents from lookup when provided', () => {
    let n = 0; const makeId = () => `g${++n}`;
    const char = defaultWfrp4eCharacter('Test');
    const def = {
      name: 'Human',
      modifiers: { ws: 20, bs: 20, s: 20, t: 20, i: 20, ag: 20, dex: 20, int: 20, wp: 20, fel: 20 } as Record<import('../wfrp4e').CharacteristicKey, number>,
      skills: [],
      talents: ['Doomed', 'Savvy'],
    };
    const lookup = new Map([
      ['doomed', { name: 'Doomed', description: 'You have a foretold death.', tests: undefined }],
      // 'Savvy' intentionally absent — should still be granted with empty description.
    ]);
    const patch = applySpecies(char, def, makeId, () => 0, lookup);
    const doomed = patch.talents!.find(t => t.name === 'Doomed');
    const savvy = patch.talents!.find(t => t.name === 'Savvy');
    expect(doomed?.description).toBe('You have a foretold death.');
    expect(savvy?.description).toBe(''); // unknown name falls back to empty
  });

  test('applyOrigin enriches talents from lookup when provided', () => {
    let n = 0; const makeId = () => `o${++n}`;
    const char = defaultWfrp4eCharacter('Test');
    const def = { name: 'Reiklander', skills: [], talents: ['Etiquette'] };
    const lookup = new Map([['etiquette', { name: 'Etiquette', description: 'Court manners.', tests: 'Charm' }]]);
    const patch = applyOrigin(char, def, makeId, lookup);
    const et = patch.talents!.find(t => t.name === 'Etiquette');
    expect(et?.description).toBe('Court manners.');
    expect(et?.tests).toBe('Charm');
  });
});

import { DEFAULT_WOUNDS_COEFFS } from '../wfrp4e';
import { BASE_RACES } from '../../data/wfrp-races';

describe('woundsMax with race coefficients', () => {
  test('Halfling coeffs drop SB', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 35, racial: 0, other: 0, advances: 0 };  // SB 3
    c.characteristics.t = { roll: 42, racial: 0, other: 0, advances: 0 };  // TB 4
    c.characteristics.wp = { roll: 28, racial: 0, other: 0, advances: 0 }; // WPB 2
    c.woundsCoeffs = { sb: 0, tb: 2, wpb: 1 };
    expect(woundsMax(c)).toBe(0 * 3 + 2 * 4 + 2 + 0); // 10
  });
  test('defaults to standard {1,2,1} when missing', () => {
    const c: any = { ...defaultWfrp4eCharacter('T') };
    delete c.woundsCoeffs;
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 }; // TB 3
    expect(woundsMax(c)).toBe(2 * 3); // 6
  });
});

describe('applySpecies (race apply)', () => {
  const def = {
    name: 'Dwarf',
    modifiers: { ws: 30, bs: 20, s: 20, t: 30, i: 20, ag: 10, dex: 30, int: 20, wp: 40, fel: 10 } as Record<import('../wfrp4e').CharacteristicKey, number>,
    woundsCoeffs: { sb: 1, tb: 2, wpb: 1 },
    fate: 0, resilience: 2, extraPoints: 2, movement: 3,
    skills: [{ name: 'Trade', characteristic: 'dex' as const }],
    talents: ['Night Vision'],
  };

  test('sets racial from modifiers and rolls into roll', () => {
    const c = defaultWfrp4eCharacter('T');
    const patch = applySpecies(c, def, () => 'id', () => 13);
    expect(patch.characteristics!.wp).toEqual({ roll: 13, racial: 40, other: 0, advances: 0 });
    expect(patch.characteristics!.ag.racial).toBe(10);
  });
  test('sets derived stats and merges grants', () => {
    const c = defaultWfrp4eCharacter('T');
    const patch = applySpecies(c, def, () => 'id', () => 0);
    expect(patch.species).toBe('Dwarf');
    expect(patch.woundsCoeffs).toEqual({ sb: 1, tb: 2, wpb: 1 });
    expect(patch.resilience).toEqual({ current: 2, max: 2 });
    expect(patch.resolve).toEqual({ current: 2, max: 2 });
    expect(patch.fate).toEqual({ current: 0, max: 0 });
    expect(patch.movement).toBe(3);
    expect(patch.extraPoints).toBe(2);
    expect(patch.skills!.some(s => s.name === 'Trade')).toBe(true);
    expect(patch.talents!.some(t => t.name === 'Night Vision')).toBe(true);
  });
});

describe('migrateWfrp4eCharacter race fields', () => {
  test('adds movement/extraPoints/woundsCoeffs defaults at schemaVer 6', () => {
    const old: any = {
      system: 'wfrp4e', schemaVer: 5,
      characteristics: Object.fromEntries(
        ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
      ),
      wounds: { current: 0, modifier: 0 },
    };
    const m = migrateWfrp4eCharacter(old);
    expect(m.movement).toBe(4);
    expect(m.extraPoints).toBe(0);
    expect(m.woundsCoeffs).toEqual(DEFAULT_WOUNDS_COEFFS);
    expect(m.schemaVer).toBe(9);
  });
  test('preserves existing race fields', () => {
    const c = defaultWfrp4eCharacter('T');
    c.movement = 5; c.extraPoints = 2; c.woundsCoeffs = { sb: 0, tb: 2, wpb: 1 };
    const m = migrateWfrp4eCharacter(c);
    expect(m.movement).toBe(5);
    expect(m.extraPoints).toBe(2);
    expect(m.woundsCoeffs).toEqual({ sb: 0, tb: 2, wpb: 1 });
  });
});

describe('BASE_RACES', () => {
  test('has the five base races with correct key values', () => {
    expect(BASE_RACES.map(r => r.name)).toEqual(['Human', 'Dwarf', 'Halfling', 'High Elf', 'Wood Elf']);
    const dwarf = BASE_RACES.find(r => r.name === 'Dwarf')!;
    expect(dwarf.modifiers.wp).toBe(40);
    expect(dwarf.resilience).toBe(2);
    const highElf = BASE_RACES.find(r => r.name === 'High Elf')!;
    expect(highElf.modifiers.i).toBe(40);
    expect(highElf.movement).toBe(5);
    const halfling = BASE_RACES.find(r => r.name === 'Halfling')!;
    expect(halfling.woundsCoeffs).toEqual({ sb: 0, tb: 2, wpb: 1 });
    const human = BASE_RACES.find(r => r.name === 'Human')!;
    expect(human.fate).toBe(2);
    expect(human.extraPoints).toBe(3);
  });

  test('races grant resolved skills (with characteristic) and talents', () => {
    for (const r of BASE_RACES) {
      expect(r.skills.length).toBeGreaterThan(0);
      expect(r.talents.length).toBeGreaterThan(0);
      for (const s of r.skills) {
        expect(typeof s.name).toBe('string');
        expect(['ws','bs','s','t','i','ag','dex','int','wp','fel']).toContain(s.characteristic);
      }
    }
  });
});

import { rollRandomTalents, rollRandomTalentName } from '../../lib/randomTalents';

describe('rollRandomTalents', () => {
  test('maps a d100 roll to the table band', () => {
    expect(rollRandomTalentName(() => 1)).toBe('Acute Sense');     // 01-03
    expect(rollRandomTalentName(() => 100)).toBe('Warrior Born');  // 98-00
  });
  test('rolls N distinct names, re-rolling duplicates and excludes', () => {
    // Always rolls 1 → 'Acute Sense'; with it excluded and only one value, returns none.
    expect(rollRandomTalents(2, () => 1, ['Acute Sense'])).toEqual([]);
    // A sequence yielding two different bands.
    const seq = [1, 1, 100]; let i = 0;
    const out = rollRandomTalents(2, () => seq[i++ % seq.length]);
    expect(out).toEqual(['Acute Sense', 'Warrior Born']);
  });
  test('count 0 returns empty', () => {
    expect(rollRandomTalents(0, () => 50)).toEqual([]);
  });
});

describe('healSpeciesLibrary', () => {
  const M: Record<CharacteristicKey, number> = { ws: 0, bs: 0, s: 0, t: 0, i: 0, ag: 0, dex: 0, int: 0, wp: 0, fel: 0 };
  const baseHuman: WfrpSpeciesDef = {
    name: 'Human', modifiers: M, woundsCoeffs: { sb: 1, tb: 2, wpb: 1 },
    fate: 2, resilience: 1, extraPoints: 3, movement: 4, randomTalents: 3,
    skills: [], talents: [],
  };
  const base = [baseHuman];

  test('backfills fields a legacy entry omits from the matching base race', () => {
    // Legacy "Human" saved before fate/resilience/extraPoints existed (those keys absent).
    const stale: WfrpSpeciesDef = { name: 'Human', modifiers: M, movement: 4, skills: [{ name: 'Charm', characteristic: 'fel' }], talents: [] };
    const [healed] = healSpeciesLibrary([stale], base);
    expect(healed.fate).toBe(2);
    expect(healed.resilience).toBe(1);
    expect(healed.extraPoints).toBe(3);
    expect(healed.woundsCoeffs).toEqual({ sb: 1, tb: 2, wpb: 1 });
    expect(healed.skills).toEqual([{ name: 'Charm', characteristic: 'fel' }]); // stored value preserved
  });

  test('keeps explicitly-set custom fields over the base', () => {
    const custom: WfrpSpeciesDef = { ...baseHuman, fate: 0, extraPoints: 0 };
    const [healed] = healSpeciesLibrary([custom], base);
    expect(healed.fate).toBe(0);
    expect(healed.extraPoints).toBe(0);
  });

  test('matches the base race name case-insensitively', () => {
    const stale: WfrpSpeciesDef = { name: 'human', modifiers: M, skills: [], talents: [] };
    const [healed] = healSpeciesLibrary([stale], base);
    expect(healed.fate).toBe(2);
  });

  test('leaves a custom race with no matching base untouched', () => {
    const ogre: WfrpSpeciesDef = { name: 'Ogre', modifiers: M, fate: 9, skills: [], talents: [] };
    const [healed] = healSpeciesLibrary([ogre], base);
    expect(healed).toEqual(ogre);
  });
});

import { buffTotal } from '../wfrp4e';
import type { Buff } from '../wfrp4e';

describe('buffTotal', () => {
  const mk = (over: Partial<Buff>): Buff => ({
    id: '1', name: 'B', effects: [{ target: 's', value: 10 }], active: true, ...over,
  });

  test('returns 0 when buffs array is missing', () => {
    const c = defaultWfrp4eCharacter('T');
    delete (c as any).buffs;
    expect(buffTotal(c, 's')).toBe(0);
  });

  test('sums only active buff effects targeting the target, honoring sign', () => {
    const c = defaultWfrp4eCharacter('T');
    c.buffs = [
      mk({ id: '1', effects: [{ target: 's', value: 10 }] }),
      mk({ id: '2', effects: [{ target: 's', value: -5 }] }),
      mk({ id: '3', effects: [{ target: 's', value: 99 }], active: false }),
      mk({ id: '4', effects: [{ target: 't', value: 20 }] }),
    ];
    expect(buffTotal(c, 's')).toBe(5);
    expect(buffTotal(c, 't')).toBe(20);
    expect(buffTotal(c, 'ws')).toBe(0);
  });

  test('single buff with multiple effects hits every target', () => {
    const c = defaultWfrp4eCharacter('T');
    c.buffs = [
      { id: '1', name: 'Aura', active: true, effects: [
        { target: 'ws', value: 10 },
        { target: 'bs', value: 10 },
        { target: 'movement', value: 1 },
      ] },
    ];
    expect(buffTotal(c, 'ws')).toBe(10);
    expect(buffTotal(c, 'bs')).toBe(10);
    expect(buffTotal(c, 'movement')).toBe(1);
  });
});

describe('characteristicTotal with buffs', () => {
  test('includes active buffs and excludes inactive ones', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 30, racial: 5, other: 2, advances: 3 }; // base 40
    c.buffs = [
      { id: '1', name: 'Bless', active: true,  effects: [{ target: 's', value: 10 }] },
      { id: '2', name: 'Off',   active: false, effects: [{ target: 's', value: 5 }]  },
    ];
    expect(characteristicTotal(c, 's')).toBe(50); // 40 + 10
    c.buffs[0].active = false;
    expect(characteristicTotal(c, 's')).toBe(40); // buffs off
  });

  test('a Toughness buff cascades to bonus and max wounds', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.t = { roll: 38, racial: 0, other: 0, advances: 0 }; // TB 3
    expect(characteristicBonus(c, 't')).toBe(3);
    const before = woundsMax(c);
    c.buffs = [{ id: '1', name: 'Resolute', active: true, effects: [{ target: 't', value: 10 }] }];
    expect(characteristicBonus(c, 't')).toBe(4);
    expect(woundsMax(c)).toBe(before + 2);
  });
});

describe('migrateWfrp4eCharacter buffs', () => {
  const old = (): any => ({
    system: 'wfrp4e', schemaVer: 6,
    characteristics: Object.fromEntries(
      ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
    ),
    wounds: { current: 0, modifier: 0 },
  });

  test('defaults buffs to [] when absent and bumps schemaVer to 9', () => {
    const m = migrateWfrp4eCharacter(old());
    expect(m.buffs).toEqual([]);
    expect(m.schemaVer).toBe(9);
  });

  test('rewrites legacy {characteristic,value} into effects[] and is idempotent', () => {
    const raw = old();
    raw.buffs = [{ id: '1', name: 'Bless', characteristic: 's', value: 10, active: true }];
    const m = migrateWfrp4eCharacter(raw);
    expect(m.buffs).toEqual([{
      id: '1', name: 'Bless', active: true, effects: [{ target: 's', value: 10 }],
    }]);
    expect(migrateWfrp4eCharacter(m).buffs).toEqual(m.buffs);
  });

  test('drops entries that have neither effects nor legacy shape', () => {
    const raw = old();
    raw.buffs = [{ id: 'a', name: 'Broken' }];
    expect(migrateWfrp4eCharacter(raw).buffs).toEqual([]);
  });
});

describe('migrateWfrp4eCharacter — tags', () => {
  const old = (): any => ({
    system: 'wfrp4e', schemaVer: 6,
    characteristics: Object.fromEntries(
      ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
    ),
    wounds: { current: 0, modifier: 0 },
  });

  test('defaults tags to [] when absent', () => {
    expect(migrateWfrp4eCharacter(old()).tags).toEqual([]);
  });

  test('preserves existing tags and drops non-string / blank entries', () => {
    const raw = old();
    raw.tags = ['party-a', '  ', 'nsfw', 42, null];
    expect(migrateWfrp4eCharacter(raw).tags).toEqual(['party-a', 'nsfw']);
  });

  test('coerces non-array tags to []', () => {
    const raw = old();
    raw.tags = 'not-an-array';
    expect(migrateWfrp4eCharacter(raw).tags).toEqual([]);
  });
});

import {
  encumbranceCarried, encumbranceLevel, encumbrancePenalty, effectiveMovement,
} from '../wfrp4e';

describe('encumbrance', () => {
  function charWith(patch: Partial<Wfrp4eCharacter>): Wfrp4eCharacter {
    const c = defaultWfrp4eCharacter('Test');
    // SB 3, TB 3 → encMax = 6
    c.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 };
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 };
    return { ...c, ...patch };
  }

  test('carried sums trappings × qty + weapons + armour', () => {
    const c = charWith({
      trappings: [{ id: 't1', name: 'Rope', encumbrance: 1, qty: 2, equipped: false }],
      weapons: [{ id: 'w1', name: 'Sword', group: '', encumbrance: 1, range: '', damage: '', qualities: '', equipped: false }],
      armour: [{ id: 'a1', name: 'Mail', locations: [], encumbrance: 2, ap: 0, qualities: '', equipped: false }],
    });
    expect(encumbranceCarried(c)).toBe(2 + 1 + 2);
  });

  test('equipped items count as 1 less enc per piece (min 0)', () => {
    const c = charWith({
      trappings: [
        { id: 't1', name: 'Pouch', encumbrance: 0, qty: 1, equipped: true },   // stays 0
        { id: 't2', name: 'Arrows', encumbrance: 2, qty: 3, equipped: true },   // (2-1)*3 = 3
      ],
      weapons: [{ id: 'w1', name: 'Axe', group: '', encumbrance: 1, range: '', damage: '', qualities: '', equipped: true }], // 0
      armour: [{ id: 'a1', name: 'Plate', locations: [], encumbrance: 3, ap: 0, qualities: '', equipped: true }], // 2
    });
    expect(encumbranceCarried(c)).toBe(0 + 3 + 0 + 2);
  });

  test('level is 0 when carried <= max', () => {
    const c = charWith({
      trappings: [{ id: 't', name: 'x', encumbrance: 6, qty: 1, equipped: false }],
    });
    expect(encumbranceLevel(c)).toBe(0);
  });

  test('level = ceil(excess / 3): 1 for +1..+3, 2 for +4..+6', () => {
    const one = charWith({ trappings: [{ id: 't', name: 'x', encumbrance: 7, qty: 1, equipped: false }] });
    const three = charWith({ trappings: [{ id: 't', name: 'x', encumbrance: 9, qty: 1, equipped: false }] });
    const four = charWith({ trappings: [{ id: 't', name: 'x', encumbrance: 10, qty: 1, equipped: false }] });
    expect(encumbranceLevel(one)).toBe(1);
    expect(encumbranceLevel(three)).toBe(1);
    expect(encumbranceLevel(four)).toBe(2);
  });

  test('penalty is -1 move / -10 test per level', () => {
    const c = charWith({ trappings: [{ id: 't', name: 'x', encumbrance: 10, qty: 1, equipped: false }] });
    expect(encumbrancePenalty(c)).toEqual({ movement: 2, test: 20 });
  });

  test('effectiveMovement clamps to 0', () => {
    const c = charWith({
      movement: 1,
      trappings: [{ id: 't', name: 'x', encumbrance: 20, qty: 1, equipped: false }],
    });
    expect(effectiveMovement(c)).toBe(0);
  });
});

describe('migrateWfrp4eCharacter — equipped', () => {
  const legacy = (): any => ({
    system: 'wfrp4e', schemaVer: 7,
    characteristics: Object.fromEntries(
      ['ws','bs','s','t','i','ag','dex','int','wp','fel'].map(k => [k, { roll: 0, racial: 0, other: 0, advances: 0 }])
    ),
    wounds: { current: 0, modifier: 0 },
    weapons: [{ id: 'w', name: 'Sword', group: '', encumbrance: 1, range: '', damage: '', qualities: '' }],
    armour: [{ id: 'a', name: 'Mail', locations: [], encumbrance: 2, ap: 0, qualities: '' }],
    trappings: [{ id: 't', name: 'Rope', encumbrance: 1, qty: 1 }],
  });

  test('defaults equipped=false on all items', () => {
    const m = migrateWfrp4eCharacter(legacy());
    expect(m.weapons[0].equipped).toBe(false);
    expect(m.armour[0].equipped).toBe(false);
    expect(m.trappings[0].equipped).toBe(false);
    expect(m.schemaVer).toBe(9);
  });

  test('preserves equipped=true when already set', () => {
    const raw = legacy();
    raw.weapons[0].equipped = true;
    raw.armour[0].equipped = true;
    raw.trappings[0].equipped = true;
    const m = migrateWfrp4eCharacter(raw);
    expect(m.weapons[0].equipped).toBe(true);
    expect(m.armour[0].equipped).toBe(true);
    expect(m.trappings[0].equipped).toBe(true);
  });
});

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

import { encumberedBuff, displayBuffs, ENCUMBERED_BUFF_ID } from '../wfrp4e';

describe('encumberedBuff (synthetic)', () => {
  function overloaded(over = 4): Wfrp4eCharacter {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 }; // SB 3
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 }; // TB 3 → max 6
    c.trappings = [{ id: 't', name: 'x', encumbrance: 6 + over, qty: 1, equipped: false }];
    return c;
  }

  test('null when within max', () => {
    const c = defaultWfrp4eCharacter('T');
    c.characteristics.s = { roll: 30, racial: 0, other: 0, advances: 0 };
    c.characteristics.t = { roll: 30, racial: 0, other: 0, advances: 0 };
    expect(encumberedBuff(c)).toBeNull();
  });

  test('level-2 debuff hits movement -2 and WS/BS/Ag/I -20 each', () => {
    const c = overloaded(4); // excess 4 → level 2
    const b = encumberedBuff(c)!;
    expect(b.id).toBe(ENCUMBERED_BUFF_ID);
    expect(b.active).toBe(true);
    const byTarget = Object.fromEntries(b.effects.map(e => [e.target, e.value]));
    expect(byTarget).toEqual({ movement: -2, ws: -20, bs: -20, ag: -20, i: -20 });
  });

  test('effectiveMovement folds Encumbered into buffTotal(movement)', () => {
    const c = overloaded(1); // level 1
    c.movement = 4;
    expect(buffTotal(c, 'movement')).toBe(-1);
    expect(effectiveMovement(c)).toBe(3);
  });

  test('manual +movement buff and Encumbered both apply', () => {
    const c = overloaded(1); // level 1 (-1 move)
    c.movement = 4;
    c.buffs = [{ id: 'boots', name: 'Boots of Striding', active: true, effects: [{ target: 'movement', value: 2 }] }];
    expect(buffTotal(c, 'movement')).toBe(1); // -1 + 2
    expect(effectiveMovement(c)).toBe(5);
  });

  test('displayBuffs prepends synthetic when overloaded and passes through when not', () => {
    const fine = defaultWfrp4eCharacter('T');
    expect(displayBuffs(fine)).toEqual([]);
    const c = overloaded(1);
    c.buffs = [{ id: 'manual', name: 'Bless', active: true, effects: [{ target: 'ws', value: 10 }] }];
    const shown = displayBuffs(c);
    expect(shown[0].id).toBe(ENCUMBERED_BUFF_ID);
    expect(shown[1].id).toBe('manual');
  });
});

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
