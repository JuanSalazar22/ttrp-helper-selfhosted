export type CharacteristicKey =
  | 'ws' | 'bs' | 's' | 't' | 'i' | 'ag' | 'dex' | 'int' | 'wp' | 'fel';

// A named modifier that can hit any number of targets at once (e.g. "Encumbered ×1"
// hits movement + WS + BS + Ag + I). Each Effect: `target` = a characteristic key or
// `'movement'`; `value` = signed (+ buff, − debuff). `active` toggles the whole set
// without deleting it. Active effects fold into characteristicTotal / effectiveMovement.
export type BuffTarget = CharacteristicKey | 'movement';
export type BuffEffect = { target: BuffTarget; value: number };
export type Buff = {
  id: string;
  name: string;
  effects: BuffEffect[];
  active: boolean;
};

export type Wfrp4eCharacter = {
  system: 'wfrp4e';
  schemaVer: 9;

  // Bio
  name: string;
  species: string;
  origin: string;
  currentCareer: string;
  careerPath: string[];
  careerRank: 1 | 2 | 3 | 4;
  status: { tier: 'Brass' | 'Silver' | 'Gold'; standing: number };
  age: number;
  height: string;
  eyeColor: string;
  hair: string;

  // total = all XP earned (player-entered); spent = running accumulator the advance
  // calculator increments. current/unspent is derived: total - spent.
  experience: { total: number; spent: number };

  characteristics: Record<CharacteristicKey, {
    roll: number;
    racial: number;
    other: number;
    advances: number;
  }>;

  // Named, toggleable modifiers stacked on top of each characteristic's manual `other`.
  buffs: Buff[];

  skills: Array<{
    id: string;
    name: string;
    characteristic: CharacteristicKey;
    advances: number;
    isAdvanced: boolean;
    description?: string;
    page?: string;
  }>;

  talents: Array<{
    id: string;
    name: string;
    timesTaken: number;
    description: string;
    tests?: string;
    page?: string;
  }>;

  wounds: { current: number; modifier: number };
  // Per-race Max-Wounds coefficients: woundsMax = sb·SB + tb·TB + wpb·WPB + wounds.modifier.
  // Default {1,2,1} is the standard SB + 2·TB + WPB; Halflings use {0,2,1}.
  woundsCoeffs: { sb: number; tb: number; wpb: number };
  movement: number;
  extraPoints: number;  // racial points to distribute between Fate & Resilience
  fate: { current: number; max: number };
  fortune: { current: number; max: number };
  resilience: { current: number; max: number };
  resolve: { current: number; max: number };

  // Threshold is derived: TB + WB + modifier. Modifier is a manual +/- adjustment,
  // parallel to wounds.modifier and encumbranceModifier.
  corruption: { current: number; modifier: number };
  sin: number;
  mutations: Array<{
    id: string;
    name: string;
    type: 'physical' | 'mental';
    description?: string;
    page?: string;
  }>;

  encumbranceMax: number;       // legacy manual value; max is now computed (see encumbranceMaxValue)
  encumbranceModifier: number;  // custom +/- on top of SB + TB

  weapons: Array<{
    id: string;
    name: string;
    group: string;
    encumbrance: number;
    range: string;
    damage: string;
    qualities: string;
    notes?: string;
    equipped: boolean;
  }>;

  armour: Array<{
    id: string;
    name: string;
    locations: string[];
    encumbrance: number;
    ap: number;
    qualities: string;
    equipped: boolean;
  }>;
  armourPoints: {
    head: number; rightArm: number; leftArm: number;
    body: number; rightLeg: number; leftLeg: number; shield: number;
  };

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
    // Book reference, carried from the content picker (not user-editable).
    description?: string;
    page?: string;
  }>;
  wealth: { brass: number; silver: number; gold: number };

  spells: Array<{
    id: string;
    name: string;
    lore: string;
    castingNumber: number;
    range: string;
    target: string;
    duration: string;
    effect: string;
    page?: string;
  }>;

  prayers: Array<{
    id: string;
    name: string;
    god: string;
    range: string;
    target: string;
    duration: string;
    effect: string;
    page?: string;
  }>;

  ambitions: { shortTerm: string; longTerm: string };
  partyAmbition: { shortTerm: string; longTerm: string };
  psychology: string;
  notes: string;
  lore: string;
  description: string;
  relations: string;

  tags: string[];
};

export const CHARACTERISTIC_LABELS: Record<CharacteristicKey, string> = {
  ws:  'Weapon Skill',
  bs:  'Ballistic Skill',
  s:   'Strength',
  t:   'Toughness',
  i:   'Initiative',
  ag:  'Agility',
  dex: 'Dexterity',
  int: 'Intelligence',
  wp:  'Willpower',
  fel: 'Fellowship',
};

// Sum of active buff effects hitting `target`, over a specific list. Building block
// for the public buffTotal (which folds the synthetic Encumbered in).
function sumEffects(buffs: Buff[], target: BuffTarget): number {
  let sum = 0;
  for (const b of buffs) {
    if (!b.active) continue;
    for (const e of b.effects) if (e.target === target) sum += e.value;
  }
  return sum;
}

// Base helpers — see PUBLIC characteristicTotal below. These use only stored buffs
// (no synthetic Encumbered), and exist to break a cycle: the synthetic Encumbered
// is derived from carried-vs-max encumbrance, which is derived from S and T.
function baseCharacteristicBonus(char: Wfrp4eCharacter, k: CharacteristicKey): number {
  const { roll, racial, other, advances } = char.characteristics[k];
  return Math.floor((roll + racial + other + advances + sumEffects(char.buffs ?? [], k)) / 10);
}

/**
 * Sum of ACTIVE buff effects hitting `target` (signed), including the synthetic
 * Encumbered debuff. Missing buff list → 0.
 */
export function buffTotal(char: Wfrp4eCharacter, target: BuffTarget): number {
  return sumEffects(displayBuffs(char), target);
}

export function characteristicTotal(
  char: Wfrp4eCharacter,
  key: CharacteristicKey
): number {
  const { roll, racial, other, advances } = char.characteristics[key];
  return roll + racial + other + advances + buffTotal(char, key);
}

export function characteristicBonus(
  char: Wfrp4eCharacter,
  key: CharacteristicKey
): number {
  return Math.floor(characteristicTotal(char, key) / 10);
}

export const DEFAULT_WOUNDS_COEFFS = { sb: 1, tb: 2, wpb: 1 };

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

export function woundsMax(char: Wfrp4eCharacter): number {
  const c = char.woundsCoeffs ?? DEFAULT_WOUNDS_COEFFS;
  return (
    c.sb * characteristicBonus(char, 's') +
    c.tb * characteristicBonus(char, 't') +
    c.wpb * characteristicBonus(char, 'wp') +
    char.wounds.modifier
  );
}

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

// Equipped items count as 1 less enc per piece (min 0). WFRP4e Core p.293.
function itemEnc(enc: number, equipped: boolean, qty: number = 1): number {
  const per = equipped ? Math.max(0, enc - 1) : enc;
  return per * qty;
}

/** Total carried Encumbrance, with a −1 discount per equipped piece (min 0). */
export function encumbranceCarried(char: Wfrp4eCharacter): number {
  const trapEnc = (char.trappings ?? []).reduce(
    (s, i) => s + itemEnc(i.encumbrance, i.equipped === true, i.qty), 0);
  const weapEnc = (char.weapons ?? []).reduce(
    (s, w) => s + itemEnc(w.encumbrance, w.equipped === true), 0);
  const armEnc = (char.armour ?? []).reduce(
    (s, a) => s + itemEnc(a.encumbrance, a.equipped === true), 0);
  return trapEnc + weapEnc + armEnc;
}

/**
 * Encumbrance level: 0 if within max; +1 per Encumbered condition otherwise. RAW
 * (Core p.293): become Encumbered when carried > max, then gain 1 further stack for
 * every 3 more points over max. So excess 1–3 → 1, 4–6 → 2, etc. No upper cap.
 */
export function encumbranceLevel(char: Wfrp4eCharacter): number {
  const excess = encumbranceCarried(char) - encumbranceMaxValue(char);
  if (excess <= 0) return 0;
  return Math.ceil(excess / 3);
}

// A special buff id reserved for the synthetic Encumbered debuff, so the UI can
// spot it and render as read-only.
export const ENCUMBERED_BUFF_ID = 'system:encumbered';

/**
 * Synthetic Encumbered debuff derived from carried encumbrance, or null when at/
 * under max. Each stack: −1 Movement, −10 to WS, BS, Ag, Initiative tests. Not
 * stored — recomputed every render.
 */
export function encumberedBuff(char: Wfrp4eCharacter): Buff | null {
  const level = encumbranceLevel(char);
  if (level === 0) return null;
  return {
    id: ENCUMBERED_BUFF_ID,
    name: `encumbered:${level}`,   // sentinel; the UI translates via i18n
    effects: [
      { target: 'movement', value: -level },
      { target: 'ws', value: -10 * level },
      { target: 'bs', value: -10 * level },
      { target: 'ag', value: -10 * level },
      { target: 'i',  value: -10 * level },
    ],
    active: true,
  };
}

/** All buffs the sheet should render: synthetic Encumbered (if any) then manual. */
export function displayBuffs(char: Wfrp4eCharacter): Buff[] {
  const enc = encumberedBuff(char);
  const manual = char.buffs ?? [];
  return enc ? [enc, ...manual] : manual;
}

/** Convenience: what a buff card would show for total movement penalty from Encumbered. */
export function encumbrancePenalty(char: Wfrp4eCharacter): { movement: number; test: number } {
  const level = encumbranceLevel(char);
  return { movement: level, test: level * 10 };
}

/** Base Movement plus all active movement-target buff effects (Encumbered included); clamped ≥ 0. */
export function effectiveMovement(char: Wfrp4eCharacter): number {
  return Math.max(0, char.movement + buffTotal(char, 'movement'));
}

/**
 * Corruption Threshold (WFRP4e core p.183): TB + WB, plus a custom modifier.
 * When current corruption exceeds this, a mutation check is triggered.
 */
export function corruptionThreshold(char: Wfrp4eCharacter): number {
  return characteristicBonus(char, 't') + characteristicBonus(char, 'wp') + (char.corruption.modifier ?? 0);
}

export const ARMOUR_LOCATIONS = ['head', 'rightArm', 'leftArm', 'body', 'rightLeg', 'leftLeg', 'shield'] as const;
export type ArmourLocation = typeof ARMOUR_LOCATIONS[number];

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

export const CHARACTERISTIC_KEYS: CharacteristicKey[] = [
  'ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel',
];

/**
 * Normalizes a stored WFRP character to the four-part characteristic shape.
 * Old shape `{ base, advances }` becomes `{ roll: base, racial: 0, other: 0, advances }`
 * (total preserved). Already-migrated characters pass through unchanged. Idempotent.
 */
export function migrateWfrp4eCharacter(raw: any): Wfrp4eCharacter {
  const characteristics = Object.fromEntries(
    CHARACTERISTIC_KEYS.map(k => {
      const c = raw?.characteristics?.[k] ?? {};
      if (typeof c.roll === 'number') {
        return [k, {
          roll: c.roll,
          racial: c.racial ?? 0,
          other: c.other ?? 0,
          advances: c.advances ?? 0,
        }];
      }
      return [k, {
        roll: c.base ?? 0,
        racial: 0,
        other: 0,
        advances: c.advances ?? 0,
      }];
    })
  ) as Wfrp4eCharacter['characteristics'];

  const bonus = (k: CharacteristicKey) => {
    const c = characteristics[k];
    return Math.floor((c.roll + c.racial + c.other + c.advances) / 10);
  };
  const modifier = typeof raw?.wounds?.modifier === 'number' ? raw.wounds.modifier : 0;
  const computedMax = bonus('s') + 2 * bonus('t') + bonus('wp') + modifier;
  const current = Math.max(0, Math.min(raw?.wounds?.current ?? 0, computedMax));
  const wounds = { current, modifier };

  const experience = {
    total: typeof raw?.experience?.total === 'number' ? raw.experience.total : 0,
    spent: typeof raw?.experience?.spent === 'number' ? raw.experience.spent : 0,
  };

  const wc = raw?.woundsCoeffs;
  const woundsCoeffs = (wc && typeof wc.sb === 'number')
    ? { sb: wc.sb, tb: wc.tb, wpb: wc.wpb }
    : { ...DEFAULT_WOUNDS_COEFFS };

  // Armour Points: migrate the old 4-region shape {head,body,arms,legs} to the
  // 6-location + shield shape (arms/legs split L/R, mirroring the old shared value).
  const apRaw = raw?.armourPoints ?? {};
  const armourPoints = typeof apRaw.leftArm === 'number'
    ? apRaw
    : {
        head: apRaw.head ?? 0,
        rightArm: apRaw.arms ?? 0,
        leftArm: apRaw.arms ?? 0,
        body: apRaw.body ?? 0,
        rightLeg: apRaw.legs ?? 0,
        leftLeg: apRaw.legs ?? 0,
        shield: 0,
      };

  // Corruption: migrate legacy { current, threshold } shape — threshold is now derived
  // (TB + WB + modifier). Prior manual `threshold` value is dropped, since it no longer has
  // a home in the model.
  const corrRaw = raw?.corruption ?? {};
  const corruption = {
    current: typeof corrRaw.current === 'number' ? corrRaw.current : 0,
    modifier: typeof corrRaw.modifier === 'number' ? corrRaw.modifier : 0,
  };

  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];

  const withEquipped = <T extends { equipped?: unknown }>(xs: T[] | undefined): Array<T & { equipped: boolean }> =>
    (Array.isArray(xs) ? xs : []).map(x => ({ ...x, equipped: x.equipped === true }));

  // Buffs: legacy shape {characteristic, value} → {effects:[{target,value}]}. Already-
  // migrated buffs (with `effects`) pass through. Drops entries that have neither.
  const rawBuffs = Array.isArray(raw?.buffs) ? raw.buffs : [];
  const buffs: Buff[] = rawBuffs.map((b: any): Buff | null => {
    if (Array.isArray(b?.effects)) {
      return { id: b.id, name: b.name, effects: b.effects, active: !!b.active };
    }
    if (typeof b?.characteristic === 'string' && typeof b?.value === 'number') {
      return {
        id: b.id, name: b.name, active: !!b.active,
        effects: [{ target: b.characteristic, value: b.value }],
      };
    }
    return null;
  }).filter((b: Buff | null): b is Buff => b !== null);

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
}

export type AdvanceKind = 'characteristic' | 'skill';

// WFRP4e Core "Cost of Advances". Band is chosen by how many advances are ALREADY
// bought; characteristics and skills use different columns. `rest` applies at 46+.
const COST_BANDS: Record<AdvanceKind, { bands: Array<{ max: number; cost: number }>; rest: number }> = {
  characteristic: {
    bands: [
      { max: 5, cost: 25 }, { max: 10, cost: 30 }, { max: 15, cost: 40 },
      { max: 20, cost: 50 }, { max: 25, cost: 70 }, { max: 30, cost: 90 },
      { max: 35, cost: 120 }, { max: 40, cost: 150 }, { max: 45, cost: 190 },
    ],
    rest: 230,
  },
  skill: {
    bands: [
      { max: 5, cost: 10 }, { max: 10, cost: 15 }, { max: 15, cost: 20 },
      { max: 20, cost: 30 }, { max: 25, cost: 40 }, { max: 30, cost: 60 },
      { max: 35, cost: 80 }, { max: 40, cost: 110 }, { max: 45, cost: 140 },
    ],
    rest: 180,
  },
};

/**
 * XP cost of the NEXT advance, given how many advances of that kind are already bought.
 * Book table is by advance number ("1–5, 6–10, …"): buying the (a+1)-th advance, so the
 * band is chosen by `a + 1`. (Buying the 6th advance — when you already have 5 — costs the
 * 6–10 band.) Note `a < band.max` ⟺ `a + 1 <= band.max`.
 */
export function advanceCost(kind: AdvanceKind, currentAdvances: number): number {
  const a = Math.max(0, Math.floor(currentAdvances));
  const table = COST_BANDS[kind];
  for (const band of table.bands) {
    if (a < band.max) return band.cost;
  }
  return table.rest;
}

/**
 * Total XP to move from `from` advances to `to` advances (sum of each step's banded
 * cost). If `to < from` returns the NEGATIVE of the refund (selling back is XP-neutral).
 */
export function advancesCostRange(kind: AdvanceKind, from: number, to: number): number {
  const f = Math.max(0, Math.floor(from));
  const t = Math.max(0, Math.floor(to));
  if (t === f) return 0;
  const lo = Math.min(f, t);
  const hi = Math.max(f, t);
  let sum = 0;
  for (let a = lo; a < hi; a++) sum += advanceCost(kind, a);
  return t >= f ? sum : -sum;
}

/**
 * XP to buy talent ranks from `fromRank` to `toRank`. Buying the N-th rank costs
 * N × 100. Negative when selling back. (Triangular: ranks are 1-indexed.)
 */
export function talentCostRange(fromRank: number, toRank: number): number {
  const f = Math.max(0, Math.floor(fromRank));
  const t = Math.max(0, Math.floor(toRank));
  if (t === f) return 0;
  const lo = Math.min(f, t);
  const hi = Math.max(f, t);
  let sum = 0;
  for (let r = lo + 1; r <= hi; r++) sum += r * 100;
  return t >= f ? sum : -sum;
}

/** Unspent ("current") XP: total earned minus total spent. May be negative. */
export function experienceCurrent(c: Wfrp4eCharacter): number {
  return (c.experience?.total ?? 0) - (c.experience?.spent ?? 0);
}

/**
 * Flat XP charged to advance to the next career level (rank). WFRP4e gates career-level
 * progression on buying advances rather than a fixed price, but we intentionally ignore
 * those requisites for now and charge a simple per-level cost. Adjust here if desired.
 */
export const CAREER_LEVEL_XP = 100;

export function applySpeciesPatch(
  character: Wfrp4eCharacter,
  species: string,
  racialByKey: Record<CharacteristicKey, number>,
): Partial<Wfrp4eCharacter> {
  const characteristics = { ...character.characteristics };
  for (const k of CHARACTERISTIC_KEYS) {
    characteristics[k] = { ...characteristics[k], racial: racialByKey[k] ?? 0 };
  }
  return { species, characteristics };
}

export type GrantedSkill = { name: string; characteristic: CharacteristicKey };

// A configurable race. `modifiers` are the racial attribute base values (the "+X" added
// on top of the 2d10 roll). The remaining fields fully determine derived starting stats.
// Older library entries may lack the new fields; readers default them.
export type WfrpSpeciesDef = {
  name: string;
  description?: string;
  modifiers: Record<CharacteristicKey, number>;
  woundsCoeffs?: { sb: number; tb: number; wpb: number };
  fate?: number;
  resilience?: number;
  extraPoints?: number;
  movement?: number;
  randomTalents?: number;  // how many talents to roll from the random table on apply
  skills: GrantedSkill[];
  talents: string[];
};

export type WfrpOriginDef = {
  name: string;
  skills: GrantedSkill[];
  talents: string[];
};

export function mergeGrantedSkills(
  existing: Wfrp4eCharacter['skills'],
  granted: GrantedSkill[],
  makeId: () => string,
): Wfrp4eCharacter['skills'] {
  const out = [...existing];
  for (const g of granted) {
    const name = g.name.trim();
    if (name && !out.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      out.push({ id: makeId(), name, characteristic: g.characteristic, advances: 0, isAdvanced: false });
    }
  }
  return out;
}

/** A talent granted by race/origin/career. `description` and `tests` are optional
 *  because custom/user-authored grants (e.g. free-text via SpeciesEditor) don't have
 *  book data — but book-sourced grants should populate them so the sheet shows the
 *  rules text without a manual copy-paste. */
export type GrantedTalent = { name: string; description?: string; tests?: string };

export function mergeGrantedTalents(
  existing: Wfrp4eCharacter['talents'],
  granted: GrantedTalent[],
  makeId: () => string,
): Wfrp4eCharacter['talents'] {
  const out = [...existing];
  for (const g of granted) {
    const name = g.name.trim();
    if (name && !out.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      out.push({
        id: makeId(),
        name,
        timesTaken: 1,
        description: g.description ?? '',
        tests: g.tests,
      });
    }
  }
  return out;
}

/**
 * Apply a race to a character: sets each attribute's racial base (and rolls 2d10 into
 * `roll` via `roll2d10`), the Max-Wounds coefficients, starting Fate/Fortune and
 * Resilience/Resolve, movement, extra points, and merges granted skills/talents.
 * `other`/`advances` on attributes are preserved. Missing race fields fall back to
 * sensible defaults so legacy library entries still apply cleanly.
 */
/** Merge granted starting trappings (from a class) onto a character, skipping names it already has. */
export function mergeGrantedTrappings(
  existing: Wfrp4eCharacter['trappings'],
  granted: Array<{ name: string; qty?: number; enc?: number; notes?: string }>,
  makeId: () => string,
): Wfrp4eCharacter['trappings'] {
  const out = [...existing];
  for (const g of granted) {
    const name = g.name.trim();
    if (name && !out.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      out.push({ id: makeId(), name, encumbrance: g.enc ?? 0, qty: g.qty ?? 1, notes: g.notes, equipped: false });
    }
  }
  return out;
}

/** Look up a talent name in the enrichment map (case-insensitive). Falls back to a
 *  bare-name grant when the lookup is absent or the name isn't in the book. */
function enrichTalents(names: string[], lookup?: Map<string, GrantedTalent>): GrantedTalent[] {
  if (!lookup) return names.map(name => ({ name }));
  return names.map(name => lookup.get(name.toLowerCase()) ?? { name });
}

export function applySpecies(
  character: Wfrp4eCharacter,
  def: WfrpSpeciesDef,
  makeId: () => string,
  roll2d10: () => number = () => 0,
  talentLookup?: Map<string, GrantedTalent>,
): Partial<Wfrp4eCharacter> {
  const characteristics = { ...character.characteristics };
  for (const k of CHARACTERISTIC_KEYS) {
    characteristics[k] = {
      ...characteristics[k],
      roll: roll2d10(),
      racial: def.modifiers?.[k] ?? 0,
    };
  }
  const fate = def.fate ?? 0;
  const resilience = def.resilience ?? 0;
  return {
    species: def.name,
    characteristics,
    woundsCoeffs: def.woundsCoeffs ?? { ...DEFAULT_WOUNDS_COEFFS },
    fate: { current: fate, max: fate },
    fortune: { current: fate, max: fate },
    resilience: { current: resilience, max: resilience },
    resolve: { current: resilience, max: resilience },
    movement: def.movement ?? 4,
    extraPoints: def.extraPoints ?? 0,
    skills: mergeGrantedSkills(character.skills, def.skills ?? [], makeId),
    talents: mergeGrantedTalents(character.talents, enrichTalents(def.talents ?? [], talentLookup), makeId),
  };
}

export function applyOrigin(
  character: Wfrp4eCharacter, def: WfrpOriginDef, makeId: () => string,
  talentLookup?: Map<string, GrantedTalent>,
): Partial<Wfrp4eCharacter> {
  return {
    origin: def.name,
    skills: mergeGrantedSkills(character.skills, def.skills ?? [], makeId),
    talents: mergeGrantedTalents(character.talents, enrichTalents(def.talents ?? [], talentLookup), makeId),
  };
}

export function upsertByName<T extends { name: string }>(list: T[], item: T): T[] {
  const i = list.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase());
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

/**
 * Backfill any fields a stored library race omits from the matching base race
 * (case-insensitive name). Legacy entries saved before fields like fate/
 * resilience/extraPoints/woundsCoeffs existed would otherwise shadow a base race
 * with blank values (rendered as 0). Fields the stored entry actually defines
 * always win, so genuine customisations are preserved.
 */
export function healSpeciesLibrary(
  stored: WfrpSpeciesDef[],
  baseRaces: WfrpSpeciesDef[],
): WfrpSpeciesDef[] {
  return stored.map(s => {
    const base = baseRaces.find(b => b.name.toLowerCase() === s.name.toLowerCase());
    return base ? { ...base, ...s } : s;
  });
}

export function defaultWfrp4eCharacter(name: string): Wfrp4eCharacter {
  const characteristics = Object.fromEntries(
    (['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as CharacteristicKey[]).map(k => [
      k,
      { roll: 0, racial: 0, other: 0, advances: 0 },
    ])
  ) as Wfrp4eCharacter['characteristics'];

  return {
    system: 'wfrp4e',
    schemaVer: 9,
    name,
    species: '',
    origin: '',
    currentCareer: '',
    careerPath: [],
    careerRank: 1,
    status: { tier: 'Brass', standing: 0 },
    age: 0,
    height: '',
    eyeColor: '',
    hair: '',
    experience: { total: 0, spent: 0 },
    characteristics,
    buffs: [],
    skills: [],
    talents: [],
    wounds: { current: 0, modifier: 0 },
    woundsCoeffs: { ...DEFAULT_WOUNDS_COEFFS },
    movement: 4,
    extraPoints: 0,
    fate: { current: 0, max: 0 },
    fortune: { current: 0, max: 0 },
    resilience: { current: 0, max: 0 },
    resolve: { current: 0, max: 0 },
    corruption: { current: 0, modifier: 0 },
    sin: 0,
    mutations: [],
    encumbranceMax: 0,
    encumbranceModifier: 0,
    weapons: [],
    armour: [],
    armourPoints: { head: 0, rightArm: 0, leftArm: 0, body: 0, rightLeg: 0, leftLeg: 0, shield: 0 },
    trappings: [],
    wealth: { brass: 0, silver: 0, gold: 0 },
    spells: [],
    prayers: [],
    ambitions: { shortTerm: '', longTerm: '' },
    partyAmbition: { shortTerm: '', longTerm: '' },
    psychology: '',
    notes: '',
    lore: '',
    description: '',
    relations: '',
    tags: [],
  };
}
