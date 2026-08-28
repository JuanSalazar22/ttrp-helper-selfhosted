export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type Dnd5eCharacter = {
  system: 'dnd5e';
  schemaVer: 1;

  // Bio
  name: string;
  class: string;
  race: string;
  background: string;
  alignment: string;
  level: number;
  xp: number;

  // Core stats
  abilities: Record<AbilityKey, number>;
  proficiencyBonus: number;

  saves: Record<AbilityKey, { proficient: boolean }>;

  skills: Record<string, {
    ability: AbilityKey;
    proficient: boolean;
    expertise: boolean;
    miscBonus: number;
  }>;

  // Combat
  ac: number;
  initiativeBonus: number;
  speed: number;
  hp: { current: number; max: number; temp: number };
  hitDice: { current: number; max: number; die: 'd6' | 'd8' | 'd10' | 'd12' };
  deathSaves: { successes: number; failures: number };

  attacks: Array<{
    id: string;
    name: string;
    attackBonus: number;
    damage: string;
    notes?: string;
  }>;

  spellcasting?: {
    ability: AbilityKey;
    slots: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, { current: number; max: number }>;
    spells: Array<{
      id: string;
      name: string;
      level: number;
      prepared: boolean;
      notes?: string;
    }>;
  };

  inventory: Array<{
    id: string;
    name: string;
    qty: number;
    weight: number;
    equipped?: boolean;
    notes?: string;
  }>;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };

  featuresAndTraits: string;
  proficienciesAndLanguages: string;
  backstory: string;

  conditions: Array<{ name: string; notes?: string }>;
  exhaustionLevel: number;

  tags: string[];
};

export const DND5E_SKILLS = [
  { key: 'acrobatics',     ability: 'dex' },
  { key: 'animalHandling', ability: 'wis' },
  { key: 'arcana',         ability: 'int' },
  { key: 'athletics',      ability: 'str' },
  { key: 'deception',      ability: 'cha' },
  { key: 'history',        ability: 'int' },
  { key: 'insight',        ability: 'wis' },
  { key: 'intimidation',   ability: 'cha' },
  { key: 'investigation',  ability: 'int' },
  { key: 'medicine',       ability: 'wis' },
  { key: 'nature',         ability: 'int' },
  { key: 'perception',     ability: 'wis' },
  { key: 'performance',    ability: 'cha' },
  { key: 'persuasion',     ability: 'cha' },
  { key: 'religion',       ability: 'int' },
  { key: 'sleightOfHand',  ability: 'dex' },
  { key: 'stealth',        ability: 'dex' },
  { key: 'survival',       ability: 'wis' },
] as const satisfies Array<{ key: string; ability: AbilityKey }>;

export type SkillKey = typeof DND5E_SKILLS[number]['key'];

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function defaultDnd5eCharacter(name: string): Dnd5eCharacter {
  const skills = Object.fromEntries(
    DND5E_SKILLS.map(({ key, ability }) => [
      key,
      { ability, proficient: false, expertise: false, miscBonus: 0 },
    ])
  ) as Dnd5eCharacter['skills'];

  const saves = Object.fromEntries(
    (['str', 'dex', 'con', 'int', 'wis', 'cha'] as AbilityKey[]).map(k => [
      k,
      { proficient: false },
    ])
  ) as Dnd5eCharacter['saves'];

  return {
    system: 'dnd5e',
    schemaVer: 1,
    name,
    class: '',
    race: '',
    background: '',
    alignment: '',
    level: 1,
    xp: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    saves,
    skills,
    ac: 10,
    initiativeBonus: 0,
    speed: 30,
    hp: { current: 8, max: 8, temp: 0 },
    hitDice: { current: 1, max: 1, die: 'd8' },
    deathSaves: { successes: 0, failures: 0 },
    attacks: [],
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    featuresAndTraits: '',
    proficienciesAndLanguages: '',
    backstory: '',
    conditions: [],
    exhaustionLevel: 0,
    tags: [],
  };
}
