// Pure parsing/mapping functions transforming a Hammergen (hammergen.com) WFRP4e
// character export into this app's Wfrp4eCharacter shape. No I/O, no DB access —
// see useCharacterList.ts's importHammergenCharacter() for the file-pick + DB-write
// + content-library enrichment that wraps this. Design: docs/superpowers/specs/2026-08-30-hammergen-import-design.md

import {
  type Wfrp4eCharacter, type CharacteristicKey,
  defaultWfrp4eCharacter,
} from '@/types/wfrp4e';

// ─── Hammergen export shape (subset this import actually reads) ───────────────

export type HammergenCareer = {
  name: string;
  levelName: string;
  className?: string;
};

export type HammergenQuality = { name: string };

export type HammergenItem = {
  name: string;
  enc?: number;
  qualitiesFlaws?: HammergenQuality[];
  number?: number;
  description?: string;
  group?: string;
  rng?: string;
  dmg?: string | number;
  locations?: string[];
  ap?: number;
};

export type HammergenSkill = {
  name: string;
  attributeName: string;
  advances?: number;
};

export type HammergenTalent = { name: string; rank?: number };

// Keyed by Hammergen's characteristic abbreviations: Ag, BS, Dex, Fel, I, Int, S, T, WP, WS.
export type HammergenCharacteristicMap = Record<string, number>;

export type HammergenExport = {
  name?: string;
  description?: string;
  notes?: string;
  species?: string;
  size?: string;
  fate?: number;
  fortune?: number;
  resilience?: number;
  resolve?: number;
  brass?: number;
  silver?: number;
  gold?: number;
  spentExp?: number;
  totalExp?: number;
  sin?: number;
  corruption?: number;
  status?: string;
  standing?: number;
  currentCareer?: HammergenCareer;
  pastCareers?: HammergenCareer[];
  baseAttributes?: HammergenCharacteristicMap;
  attributeAdvances?: HammergenCharacteristicMap;
  otherAttributes?: HammergenCharacteristicMap;
  movement?: number;
  wounds?: number;
  talents?: HammergenTalent[];
  basicSkills?: HammergenSkill[];
  advancedSkills?: HammergenSkill[];
  equippedArmor?: HammergenItem[];
  equippedWeapon?: HammergenItem[];
  equippedOther?: HammergenItem[];
  carried?: HammergenItem[];
  stored?: HammergenItem[];
};

// Hammergen abbreviation -> this app's CharacteristicKey.
const ATTR_KEY_MAP: Record<string, CharacteristicKey> = {
  WS: 'ws', BS: 'bs', S: 's', T: 't', I: 'i',
  Ag: 'ag', Dex: 'dex', Int: 'int', WP: 'wp', Fel: 'fel',
};

/** Hammergen's attributeName ("Ag", "WS", …) -> this app's CharacteristicKey. Unknown
 *  abbreviations fall back to 'ws' rather than throwing — a skill import should never
 *  fail the whole character over one unrecognized characteristic string. */
export function mapSkillCharacteristic(attributeName: string): CharacteristicKey {
  return ATTR_KEY_MAP[attributeName] ?? 'ws';
}

/** Reconstruct the four-part characteristic shape from Hammergen's three parallel maps.
 *  Hammergen has no separate "racial" bonus concept, so racial is always 0 — the
 *  species roll is already folded into `base` (verified arithmetically against
 *  Hammergen's own `attributes` totals for every characteristic in the sample). */
export function mapCharacteristics(
  base: HammergenCharacteristicMap = {},
  advances: HammergenCharacteristicMap = {},
  other: HammergenCharacteristicMap = {},
): Wfrp4eCharacter['characteristics'] {
  const out = {} as Wfrp4eCharacter['characteristics'];
  for (const [hammergenKey, key] of Object.entries(ATTR_KEY_MAP)) {
    out[key] = {
      roll: base[hammergenKey] ?? 0,
      racial: 0,
      other: other[hammergenKey] ?? 0,
      advances: advances[hammergenKey] ?? 0,
    };
  }
  return out;
}

/** Parse the trailing rank digit off a Hammergen career name, e.g. "Brewer 2" -> 2.
 *  No trailing digit, or an out-of-range one, defaults to 1 rather than throwing. */
export function parseCareerRank(name: string): 1 | 2 | 3 | 4 {
  const m = /(\d+)\s*$/.exec(name.trim());
  const n = m ? parseInt(m[1], 10) : 1;
  return (n >= 1 && n <= 4 ? n : 1) as 1 | 2 | 3 | 4;
}

export type ParsedCareer = {
  currentCareer: string;
  careerPath: string[];
  careerRank: 1 | 2 | 3 | 4;
  careerClass?: string;
};

/** Build this app's career fields from Hammergen's currentCareer + pastCareers.
 *  careerPath[rank-1] = levelName for every career line (past and current); currentCareer
 *  is the CURRENT rank's bare levelName ("Brewer", not "Brewer 2"). */
export function buildCareer(current?: HammergenCareer, past: HammergenCareer[] = []): ParsedCareer {
  if (!current) return { currentCareer: '', careerPath: [], careerRank: 1 };
  const careerPath: string[] = [];
  for (const c of [...past, current]) {
    careerPath[parseCareerRank(c.name) - 1] = c.levelName;
  }
  return {
    currentCareer: current.levelName,
    careerPath,
    careerRank: parseCareerRank(current.name),
    careerClass: current.className,
  };
}

/** Split Hammergen's packed "Dwarf (Zhufbar)" into this app's separate species/origin
 *  fields. No parenthetical -> the whole string becomes species, origin stays empty. */
export function parseSpeciesOrigin(raw: string = ''): { species: string; origin: string } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(raw.trim());
  if (!m) return { species: raw.trim(), origin: '' };
  return { species: m[1].trim(), origin: m[2].trim() };
}

function extractBioField(description: string, label: string): string | undefined {
  const m = new RegExp(`${label}:\\s*([^,]+)`, 'i').exec(description);
  return m ? m[1].trim() : undefined;
}

export type ParsedBio = { age: number; height: string; eyeColor: string; hair: string };

/** Parse Hammergen's packed description string ("Age: 61, Height: 5'1\", Eyes: Hazel,
 *  Hair: Dark Brown") into this app's real bio fields. Any piece not found is left at
 *  its normal default rather than failing the whole import. */
export function parseBio(description: string = ''): ParsedBio {
  const ageStr = extractBioField(description, 'Age');
  const age = ageStr ? parseInt(ageStr, 10) : NaN;
  return {
    age: Number.isFinite(age) ? age : 0,
    height: extractBioField(description, 'Height') ?? '',
    eyeColor: extractBioField(description, 'Eyes') ?? '',
    hair: extractBioField(description, 'Hair') ?? '',
  };
}

/** Join Hammergen's `qualitiesFlaws: [{name}]` array into this app's flat qualities string. */
export function joinQualities(qualitiesFlaws: HammergenQuality[] = []): string {
  return qualitiesFlaws.map(q => q.name).join(', ');
}

const REVIEW_NOTE = 'Imported from Hammergen — verify if this should include a Strength Bonus.';

/** Map one Hammergen weapon item (from equippedWeapon) to this app's weapon shape.
 *  Damage is imported as the bare Hammergen number, flagged for manual review — see
 *  the "Weapon damage" decision in the design spec. */
export function mapWeapon(item: HammergenItem, makeId: () => string): Wfrp4eCharacter['weapons'][number] {
  const dmg = typeof item.dmg === 'number' ? item.dmg : (parseInt(String(item.dmg ?? '0'), 10) || 0);
  const notes = [item.description || undefined, REVIEW_NOTE].filter(Boolean).join('\n\n');
  return {
    id: makeId(),
    name: item.name,
    group: item.group ?? '',
    encumbrance: item.enc ?? 0,
    range: item.rng ?? '',
    damage: String(dmg),
    qualities: joinQualities(item.qualitiesFlaws),
    notes,
    equipped: true,
  };
}

/** Map one Hammergen armour item (from equippedArmor) to this app's armour shape. */
export function mapArmour(item: HammergenItem, makeId: () => string): Wfrp4eCharacter['armour'][number] {
  return {
    id: makeId(),
    name: item.name,
    locations: item.locations ?? [],
    encumbrance: item.enc ?? 0,
    ap: item.ap ?? 0,
    qualities: joinQualities(item.qualitiesFlaws),
    equipped: true,
  };
}

/** Map one Hammergen gear item (from equippedOther / carried / stored) to this app's
 *  trapping shape. `equipped` reflects which Hammergen bucket it came from —
 *  equippedOther is true, carried/stored are both false (nothing is excluded). */
export function mapTrapping(
  item: HammergenItem, makeId: () => string, equipped: boolean
): Wfrp4eCharacter['trappings'][number] {
  return {
    id: makeId(),
    name: item.name,
    encumbrance: item.enc ?? 0,
    qty: item.number ?? 1,
    notes: item.description || undefined,
    equipped,
  };
}

/** Map Hammergen's talents array ({name, rank}) to this app's talent shape. Bare —
 *  book description/tests/page are filled in separately via content-library
 *  enrichment (see useCharacterList.ts), since that needs DB access. */
export function mapTalents(talents: HammergenTalent[] = [], makeId: () => string): Wfrp4eCharacter['talents'] {
  return talents.map(t => ({
    id: makeId(),
    name: t.name,
    timesTaken: t.rank ?? 1,
    description: '',
  }));
}

/** Map Hammergen's basicSkills + advancedSkills to this app's flat skills array. Bare —
 *  book description is filled in separately via content-library enrichment. */
export function mapSkills(
  basic: HammergenSkill[] = [],
  advanced: HammergenSkill[] = [],
  makeId: () => string,
): Wfrp4eCharacter['skills'] {
  const build = (list: HammergenSkill[], isAdvanced: boolean) => list.map(s => ({
    id: makeId(),
    name: s.name,
    characteristic: mapSkillCharacteristic(s.attributeName),
    advances: s.advances ?? 0,
    isAdvanced,
  }));
  return [...build(basic, false), ...build(advanced, true)];
}

const STATUS_TIERS: Wfrp4eCharacter['status']['tier'][] = ['Brass', 'Silver', 'Gold'];

function parseTier(status: string | undefined): Wfrp4eCharacter['status']['tier'] {
  return (STATUS_TIERS as string[]).includes(status ?? '')
    ? (status as Wfrp4eCharacter['status']['tier'])
    : 'Brass';
}

/** The full pure transform: Hammergen JSON -> a ready-to-save Wfrp4eCharacter. Talent
 *  and skill entries are bare (no description/tests/page) — the caller enriches them
 *  from the content library afterward, since that needs DB access this module doesn't have. */
export function hammergenToCharacter(raw: HammergenExport, makeId: () => string): Wfrp4eCharacter {
  const base = defaultWfrp4eCharacter(raw.name ?? '');
  const { species, origin } = parseSpeciesOrigin(raw.species);
  const bio = parseBio(raw.description);
  const career = buildCareer(raw.currentCareer, raw.pastCareers ?? []);

  const notes = [
    raw.notes,
    raw.size ? `Imported from Hammergen. Size: ${raw.size}.` : undefined,
  ].filter((s): s is string => !!s && s.trim().length > 0).join('\n\n');

  const fate = raw.fate ?? 0;
  const fortune = raw.fortune ?? 0;
  const resilience = raw.resilience ?? 0;
  const resolve = raw.resolve ?? 0;

  return {
    ...base,
    name: raw.name ?? '',
    species,
    origin,
    currentCareer: career.currentCareer,
    careerPath: career.careerPath,
    careerRank: career.careerRank,
    careerClass: career.careerClass,
    status: { tier: parseTier(raw.status), standing: raw.standing ?? 0 },
    age: bio.age,
    height: bio.height,
    eyeColor: bio.eyeColor,
    hair: bio.hair,
    experience: { total: raw.totalExp ?? 0, spent: raw.spentExp ?? 0 },
    characteristics: mapCharacteristics(raw.baseAttributes, raw.attributeAdvances, raw.otherAttributes),
    talents: mapTalents(raw.talents, makeId),
    skills: mapSkills(raw.basicSkills, raw.advancedSkills, makeId),
    wounds: { current: raw.wounds ?? 0, modifier: 0 },
    movement: raw.movement ?? base.movement,
    fate: { current: fate, max: fate },
    fortune: { current: fortune, max: fortune },
    resilience: { current: resilience, max: resilience },
    resolve: { current: resolve, max: resolve },
    corruption: { current: raw.corruption ?? 0, modifier: 0 },
    sin: raw.sin ?? 0,
    weapons: (raw.equippedWeapon ?? []).map(item => mapWeapon(item, makeId)),
    armour: (raw.equippedArmor ?? []).map(item => mapArmour(item, makeId)),
    trappings: [
      ...(raw.equippedOther ?? []).map(item => mapTrapping(item, makeId, true)),
      ...(raw.carried ?? []).map(item => mapTrapping(item, makeId, false)),
      ...(raw.stored ?? []).map(item => mapTrapping(item, makeId, false)),
    ],
    wealth: { brass: raw.brass ?? 0, silver: raw.silver ?? 0, gold: raw.gold ?? 0 },
    notes,
  };
}
