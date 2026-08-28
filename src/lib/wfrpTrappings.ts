// Map seeded book trapping records (Foundry-style melee/ranged/armour sub-objects with
// numeric enums) into the character's weapon/armour shapes for the Combat add-flows.
import type { ContentRecord } from '@/data/wfrp-content';

const MELEE_GROUPS = ['Basic', 'Cavalry', 'Fencing', 'Brawling', 'Flail', 'Parry', 'Polearm', 'Two-Handed'];
const RANGED_GROUPS = ['Blackpowder', 'Bow', 'Crossbow', 'Engineering', 'Entangling', 'Explosives', 'Sling', 'Throwing'];
const REACH = ['Personal', 'Very Short', 'Short', 'Average', 'Long', 'Very Long', 'Massive'];
const ARMOUR_LOC = ['Body', 'Arms', 'Legs', 'Head'];

const at = (arr: string[], i: unknown) => (typeof i === 'number' && arr[i] != null ? arr[i] : '');

type WeaponDraft = { name: string; group: string; damage: string; range: string; encumbrance: number; qualities: string; notes: string; equipped: boolean };
type ArmourDraft = { name: string; locations: string[]; encumbrance: number; ap: number; qualities: string; equipped: boolean };

export const isWeapon = (r: ContentRecord) => !!(r.melee || r.ranged);
export const isArmour = (r: ContentRecord) => !!r.armour;

/** Trimmed trapping record → weapon draft. Handles both melee and ranged profiles. */
export function weaponFromRecord(r: ContentRecord): WeaponDraft {
  const melee = r.melee as { dmg?: number; dmgSbMult?: number; group?: number; reach?: number } | undefined;
  const ranged = r.ranged as { dmg?: number; dmgSbMult?: number; group?: number; rng?: number } | undefined;
  const w = melee ?? ranged ?? {};
  const dmg = w.dmg ?? 0;
  const damage = w.dmgSbMult ? `SB+${dmg}` : String(dmg);
  const group = melee ? at(MELEE_GROUPS, w.group) : at(RANGED_GROUPS, w.group);
  const range = melee ? at(REACH, (melee as { reach?: number }).reach) : (ranged?.rng ? `${ranged.rng} yds` : '');
  return {
    name: r.name,
    group,
    damage,
    range,
    encumbrance: (r.enc as number) ?? 0,
    qualities: '',
    notes: (r.description as string) ?? '',
    equipped: false,
  };
}

/** Trimmed trapping record → armour draft (location enum array → region names). */
export function armourFromRecord(r: ContentRecord): ArmourDraft {
  const a = r.armour as { points?: number; location?: number[] } | undefined;
  const locations = (a?.location ?? []).map((i) => at(ARMOUR_LOC, i)).filter(Boolean);
  return {
    name: r.name,
    locations,
    encumbrance: (r.enc as number) ?? 0,
    ap: a?.points ?? 0,
    qualities: '',
    equipped: false,
  };
}
