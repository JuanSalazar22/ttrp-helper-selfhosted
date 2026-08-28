import type { Dnd5eCharacter } from '../types/dnd5e';

export const sampleDnd5eCharacter: Dnd5eCharacter = {
  system: 'dnd5e',
  schemaVer: 1,

  name: 'Aria Dawnwhisper',
  class: 'Rogue (Arcane Trickster) 5',
  race: 'Wood Elf',
  background: 'Criminal',
  alignment: 'Chaotic Neutral',
  level: 5,
  xp: 6500,

  abilities: { str: 8, dex: 18, con: 14, int: 16, wis: 12, cha: 10 },
  proficiencyBonus: 3,

  saves: {
    str: { proficient: false },
    dex: { proficient: true },
    con: { proficient: false },
    int: { proficient: true },
    wis: { proficient: false },
    cha: { proficient: false },
  },

  skills: {
    acrobatics:     { ability: 'dex', proficient: true,  expertise: true,  miscBonus: 0 },
    animalHandling: { ability: 'wis', proficient: false, expertise: false, miscBonus: 0 },
    arcana:         { ability: 'int', proficient: true,  expertise: false, miscBonus: 0 },
    athletics:      { ability: 'str', proficient: false, expertise: false, miscBonus: 0 },
    deception:      { ability: 'cha', proficient: true,  expertise: false, miscBonus: 0 },
    history:        { ability: 'int', proficient: false, expertise: false, miscBonus: 0 },
    insight:        { ability: 'wis', proficient: false, expertise: false, miscBonus: 0 },
    intimidation:   { ability: 'cha', proficient: false, expertise: false, miscBonus: 0 },
    investigation:  { ability: 'int', proficient: true,  expertise: false, miscBonus: 0 },
    medicine:       { ability: 'wis', proficient: false, expertise: false, miscBonus: 0 },
    nature:         { ability: 'int', proficient: false, expertise: false, miscBonus: 0 },
    perception:     { ability: 'wis', proficient: true,  expertise: false, miscBonus: 0 },
    performance:    { ability: 'cha', proficient: false, expertise: false, miscBonus: 0 },
    persuasion:     { ability: 'cha', proficient: false, expertise: false, miscBonus: 0 },
    religion:       { ability: 'int', proficient: false, expertise: false, miscBonus: 0 },
    sleightOfHand:  { ability: 'dex', proficient: true,  expertise: true,  miscBonus: 0 },
    stealth:        { ability: 'dex', proficient: true,  expertise: true,  miscBonus: 0 },
    survival:       { ability: 'wis', proficient: false, expertise: false, miscBonus: 0 },
  },

  ac: 15,
  initiativeBonus: 0,
  speed: 35,
  hp: { current: 28, max: 35, temp: 0 },
  hitDice: { current: 3, max: 5, die: 'd8' },
  deathSaves: { successes: 0, failures: 0 },

  attacks: [
    { id: '1', name: 'Shortsword', attackBonus: 7, damage: '1d6+4 piercing', notes: 'Finesse, Light' },
    { id: '2', name: 'Shortsword (off-hand)', attackBonus: 7, damage: '1d6 piercing', notes: 'Bonus action, no ability mod to damage' },
    { id: '3', name: 'Hand Crossbow', attackBonus: 7, damage: '1d6+4 piercing', notes: 'Range 30/120 ft, Light' },
    { id: '4', name: 'Sneak Attack', attackBonus: 0, damage: '3d6 piercing', notes: 'Once per turn, adv. or nearby ally' },
  ],

  spellcasting: {
    ability: 'int',
    slots: {
      1: { current: 1, max: 2 },
      2: { current: 1, max: 0 },
      3: { current: 0, max: 0 },
      4: { current: 0, max: 0 },
      5: { current: 0, max: 0 },
      6: { current: 0, max: 0 },
      7: { current: 0, max: 0 },
      8: { current: 0, max: 0 },
      9: { current: 0, max: 0 },
    },
    spells: [
      { id: 's1', name: 'Mage Hand',     level: 0, prepared: true,  notes: 'Cantrip — 30 ft, 10 min' },
      { id: 's2', name: 'Minor Illusion', level: 0, prepared: true,  notes: 'Cantrip — 30 ft, 1 min' },
      { id: 's3', name: 'Disguise Self',  level: 1, prepared: true,  notes: '1st — S/V, 1 hour, self' },
      { id: 's4', name: 'Silent Image',   level: 1, prepared: true,  notes: '1st — 60 ft, Conc. 10 min' },
      { id: 's5', name: 'Blur',           level: 2, prepared: false, notes: '2nd — Self, Conc. 1 min' },
    ],
  },

  inventory: [
    { id: 'i1', name: 'Shortsword',          qty: 2,  weight: 2,  equipped: true  },
    { id: 'i2', name: 'Hand Crossbow',        qty: 1,  weight: 3,  equipped: true  },
    { id: 'i3', name: 'Crossbow Bolts (20)',  qty: 1,  weight: 1.5, equipped: false },
    { id: 'i4', name: 'Studded Leather',      qty: 1,  weight: 13, equipped: true  },
    { id: 'i5', name: "Thieves' Tools",       qty: 1,  weight: 1,  equipped: false },
    { id: 'i6', name: 'Rope, Hempen (50 ft)', qty: 1,  weight: 10, equipped: false },
    { id: 'i7', name: 'Hooded Lantern',       qty: 1,  weight: 2,  equipped: false },
    { id: 'i8', name: 'Oil (flask)',           qty: 5,  weight: 1,  equipped: false },
    { id: 'i9', name: 'Backpack',             qty: 1,  weight: 5,  equipped: false },
  ],
  currency: { cp: 0, sp: 50, ep: 0, gp: 25, pp: 0 },

  featuresAndTraits: `**Darkvision (60 ft)**
You can see in dim light within 60 ft as if it were bright light, and in darkness as if it were dim light.

**Keen Senses**
Proficiency in Perception.

**Fey Ancestry**
Advantage on saves against being charmed; magic can't put you to sleep.

**Trance**
Don't need to sleep; meditate semiconsciously for 4 hours instead.

**Sneak Attack (3d6)**
Once per turn, deal extra 3d6 damage when attacking with advantage or when an ally is adjacent to the target.

**Thieves' Cant**
Secret language of rogues — can hide messages in ordinary conversation.

**Cunning Action**
Bonus action each turn: Dash, Disengage, or Hide.

**Uncanny Dodge**
When an attacker you can see hits you, use your reaction to halve the attack's damage.

**Arcane Trickster — Spellcasting**
You know 3 spells from the wizard list (2 must be enchantment/illusion). Int is your spellcasting ability. Spell save DC 14. Spell attack +6.

**Mage Hand Legerdemain**
Your Mage Hand is invisible. Use Sleight of Hand via the hand, stow/retrieve objects, pick locks, disarm traps — all as a bonus action.`,

  proficienciesAndLanguages: `**Armor:** Light
**Weapons:** Simple, Hand Crossbow, Longsword, Rapier, Shortsword
**Tools:** Thieves' Tools, Disguise Kit
**Languages:** Common, Elvish, Thieves' Cant`,

  backstory: `Aria grew up in the Misty Forest before drifting into Waterdeep's underworld. She worked for the Shadow Syndicate for three years before a botched heist left her on the run. She now works freelance — morally flexible, professionally precise.`,

  conditions: [],
  exhaustionLevel: 0,
  tags: [],
};
