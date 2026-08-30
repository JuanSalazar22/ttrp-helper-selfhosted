import {
  parseCareerRank, buildCareer, parseSpeciesOrigin, parseBio, joinQualities,
  mapCharacteristics, mapSkillCharacteristic, mapWeapon, mapArmour, mapTrapping,
  mapTalents, mapSkills, hammergenToCharacter, type HammergenExport,
} from '../hammergenImport';
import olaf from './fixtures/olaf-frostbrew.json';

const raw = olaf as HammergenExport;

function makeIdSeq(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

describe('parseCareerRank', () => {
  test('parses the trailing rank digit off a career name', () => {
    expect(parseCareerRank('Brewer 2')).toBe(2);
    expect(parseCareerRank('Brewer 1')).toBe(1);
  });

  test('defaults to 1 when there is no trailing digit', () => {
    expect(parseCareerRank('Brewer')).toBe(1);
  });

  test('defaults to 1 when the digit is out of range', () => {
    expect(parseCareerRank('Brewer 9')).toBe(1);
  });
});

describe('buildCareer', () => {
  test('builds careerPath from past + current, current levelName as currentCareer', () => {
    const result = buildCareer(raw.currentCareer, raw.pastCareers);
    expect(result).toEqual({
      currentCareer: 'Brewer',
      careerPath: ['Apprentice Brewer', 'Brewer'],
      careerRank: 2,
      careerClass: 'Burghers',
    });
  });

  test('empty result when there is no current career', () => {
    expect(buildCareer(undefined, [])).toEqual({ currentCareer: '', careerPath: [], careerRank: 1 });
  });
});

describe('parseSpeciesOrigin', () => {
  test('splits "Species (Origin)"', () => {
    expect(parseSpeciesOrigin('Dwarf (Zhufbar)')).toEqual({ species: 'Dwarf', origin: 'Zhufbar' });
  });

  test('falls back to the whole string as species when there is no parenthetical', () => {
    expect(parseSpeciesOrigin('Human')).toEqual({ species: 'Human', origin: '' });
  });

  test('handles an empty/undefined string without throwing', () => {
    expect(parseSpeciesOrigin(undefined)).toEqual({ species: '', origin: '' });
  });
});

describe('parseBio', () => {
  test('parses every piece out of the real packed description', () => {
    expect(parseBio(raw.description)).toEqual({
      age: 61,
      height: `5'1"`,
      eyeColor: 'Hazel',
      hair: 'Dark Brown',
    });
  });

  test('leaves a missing piece at its default instead of failing the whole parse', () => {
    expect(parseBio('Age: 30, Eyes: Blue')).toEqual({ age: 30, height: '', eyeColor: 'Blue', hair: '' });
  });

  test('handles an empty/undefined description', () => {
    expect(parseBio(undefined)).toEqual({ age: 0, height: '', eyeColor: '', hair: '' });
  });
});

describe('joinQualities', () => {
  test('joins a qualitiesFlaws array into a flat comma string', () => {
    const cloak = raw.equippedWeapon?.[1];
    expect(joinQualities(cloak?.qualitiesFlaws)).toBe('Defensive, Entangle, Undamaging');
  });

  test('empty/undefined array -> empty string', () => {
    expect(joinQualities([])).toBe('');
    expect(joinQualities(undefined)).toBe('');
  });
});

describe('mapCharacteristics', () => {
  test('reconstructs roll/racial/other/advances so the total matches Hammergen\'s own attributes', () => {
    const chars = mapCharacteristics(raw.baseAttributes, raw.attributeAdvances, raw.otherAttributes);
    // Verify against Hammergen's own precomputed `attributes` totals for every characteristic.
    const attrs = (raw as any).attributes as Record<string, number>;
    const HAMMERGEN_TO_KEY: Record<string, string> = {
      WS: 'ws', BS: 'bs', S: 's', T: 't', I: 'i', Ag: 'ag', Dex: 'dex', Int: 'int', WP: 'wp', Fel: 'fel',
    };
    for (const [hKey, key] of Object.entries(HAMMERGEN_TO_KEY)) {
      const c = chars[key as keyof typeof chars];
      expect(c.roll + c.racial + c.other + c.advances).toBe(attrs[hKey]);
      expect(c.racial).toBe(0);
    }
    // Spot-check one directly.
    expect(chars.dex).toEqual({ roll: 37, racial: 0, other: 0, advances: 3 });
  });
});

describe('mapSkillCharacteristic', () => {
  test('maps every Hammergen abbreviation used in the sample', () => {
    expect(mapSkillCharacteristic('Dex')).toBe('dex');
    expect(mapSkillCharacteristic('Fel')).toBe('fel');
    expect(mapSkillCharacteristic('WS')).toBe('ws');
  });

  test('falls back to ws for an unrecognized abbreviation', () => {
    expect(mapSkillCharacteristic('???')).toBe('ws');
  });
});

describe('mapWeapon', () => {
  test('imports the bare damage number with a review note appended', () => {
    const dagger = raw.equippedWeapon![0];
    const weapon = mapWeapon(dagger, makeIdSeq());
    expect(weapon.damage).toBe('6');
    expect(weapon.equipped).toBe(true);
    expect(weapon.notes).toContain('verify if this should include a Strength Bonus');
    expect(weapon.notes).toContain(dagger.description);
  });

  test('joins qualitiesFlaws into the qualities string', () => {
    const cloak = raw.equippedWeapon![1];
    const weapon = mapWeapon(cloak, makeIdSeq());
    expect(weapon.qualities).toBe('Defensive, Entangle, Undamaging');
  });
});

describe('mapArmour', () => {
  test('maps locations, ap, equipped:true', () => {
    const hat = raw.equippedArmor![0];
    const armour = mapArmour(hat, makeIdSeq());
    expect(armour.locations).toEqual(['Head']);
    expect(armour.ap).toBe(0);
    expect(armour.equipped).toBe(true);
  });
});

describe('mapTrapping', () => {
  test('respects the equipped flag passed in for each bucket', () => {
    const clothing = raw.equippedOther![0];
    expect(mapTrapping(clothing, makeIdSeq(), true).equipped).toBe(true);
    const lunch = raw.carried![0];
    expect(mapTrapping(lunch, makeIdSeq(), false).equipped).toBe(false);
  });
});

describe('mapTalents', () => {
  test('maps name + rank->timesTaken, description left blank for later enrichment', () => {
    const talents = mapTalents(raw.talents, makeIdSeq());
    expect(talents).toHaveLength(8);
    expect(talents[0]).toEqual({ id: 'id-1', name: 'Craftsman - Brewer', timesTaken: 1, description: '' });
  });
});

describe('mapSkills', () => {
  test('flattens basic + advanced with isAdvanced set correctly', () => {
    const skills = mapSkills(raw.basicSkills, raw.advancedSkills, makeIdSeq());
    expect(skills).toHaveLength(raw.basicSkills!.length + raw.advancedSkills!.length);
    expect(skills.filter(s => !s.isAdvanced)).toHaveLength(raw.basicSkills!.length);
    expect(skills.filter(s => s.isAdvanced)).toHaveLength(raw.advancedSkills!.length);
    const brewer = skills.find(s => s.name === 'Trade - Brewer');
    expect(brewer).toMatchObject({ characteristic: 'dex', advances: 5, isAdvanced: true });
  });
});

describe('hammergenToCharacter', () => {
  const character = hammergenToCharacter(raw, makeIdSeq());

  test('bio + career + species/origin', () => {
    expect(character.name).toBe('Olaf Frostbrew');
    expect(character.species).toBe('Dwarf');
    expect(character.origin).toBe('Zhufbar');
    expect(character.currentCareer).toBe('Brewer');
    expect(character.careerPath).toEqual(['Apprentice Brewer', 'Brewer']);
    expect(character.careerRank).toBe(2);
    expect(character.careerClass).toBe('Burghers');
    expect(character.age).toBe(61);
    expect(character.height).toBe(`5'1"`);
    expect(character.eyeColor).toBe('Hazel');
    expect(character.hair).toBe('Dark Brown');
  });

  test('status, wealth, experience, sin/corruption', () => {
    expect(character.status).toEqual({ tier: 'Silver', standing: 2 });
    expect(character.wealth).toEqual({ brass: 23, silver: 0, gold: 0 });
    expect(character.experience).toEqual({ total: 2565, spent: 825 });
    expect(character.sin).toBe(0);
    expect(character.corruption).toEqual({ current: 0, modifier: 0 });
  });

  test('fate/fortune/resilience/resolve import as current = max', () => {
    expect(character.fate).toEqual({ current: 0, max: 0 });
    expect(character.fortune).toEqual({ current: 0, max: 0 });
    expect(character.resilience).toEqual({ current: 2, max: 2 });
    expect(character.resolve).toEqual({ current: 2, max: 2 });
  });

  test('wounds and movement', () => {
    expect(character.wounds).toEqual({ current: 19, modifier: 0 });
    expect(character.movement).toBe(3);
  });

  test('unmapped size field is appended to notes alongside the original notes', () => {
    expect(character.notes).toContain('8 cervezas en mi barril');
    expect(character.notes).toContain('Size: Average');
  });

  test('gear buckets route to the right app arrays with the right equipped flags', () => {
    expect(character.weapons).toHaveLength(2);
    expect(character.weapons.every(w => w.equipped)).toBe(true);
    expect(character.armour).toHaveLength(1);
    expect(character.armour.every(a => a.equipped)).toBe(true);
    // equippedOther (5) + carried (4) + stored (0)
    expect(character.trappings).toHaveLength(9);
    const equippedTrappings = character.trappings.filter(t => t.equipped);
    const looseTrappings = character.trappings.filter(t => !t.equipped);
    expect(equippedTrappings).toHaveLength(5);
    expect(looseTrappings).toHaveLength(4);
  });

  test('talents and skills carry over bare, ready for enrichment', () => {
    expect(character.talents).toHaveLength(8);
    expect(character.skills).toHaveLength(raw.basicSkills!.length + raw.advancedSkills!.length);
  });

  test('every id is unique', () => {
    const ids = [
      ...character.weapons.map(w => w.id),
      ...character.armour.map(a => a.id),
      ...character.trappings.map(t => t.id),
      ...character.talents.map(t => t.id),
      ...character.skills.map(s => s.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
