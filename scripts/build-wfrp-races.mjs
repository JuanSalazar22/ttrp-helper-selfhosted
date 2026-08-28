// Transform json_book_information/races_starting_attributes.json (the user-maintained
// source of truth) into src/data/wfrp-races.json — the BASE_RACES consumed by the app.
// Resolves skill/talent slugs to real names (and skills to their characteristic) against
// the seeded book content, parses the wounds formula into {sb,tb,wpb} coefficients, and
// flattens the structured attributes (2d10+base) to racial base values.
//
//   node scripts/build-wfrp-races.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'json_book_information', 'races_starting_attributes.json');
const CONTENT = join(ROOT, 'src', 'data', 'wfrp-content');
const OUT = join(ROOT, 'src', 'data', 'wfrp-races.json');
const OUT_TRAPPINGS = join(ROOT, 'src', 'data', 'wfrp-class-trappings.json');
const OUT_RANDOM = join(ROOT, 'src', 'data', 'wfrp-random-talents.json');

// career.class index → classTrappings key (verified against the seeded careers).
const CLASS_KEYS = ['academics', 'burghers', 'courtiers', 'peasants', 'rangers', 'riverfolk', 'rogues', 'warriors'];

const ATTR_KEY = { WS: 'ws', BS: 'bs', S: 's', T: 't', I: 'i', Ag: 'ag', Dex: 'dex', Int: 'int', WP: 'wp', Fel: 'fel' };
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
const prettify = (slug) => slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Slugs the source uses that don't slugify 1:1 from the canonical skill name.
const SKILL_ALIASES = {
  entertain_sing: 'Entertain - Singing',
  lore_reikland: 'Lore - Local - Reikland',
};

// "SB+(2*TB)+WPB" / "(2*TB)+WPB" → {sb,tb,wpb}. Coefficient is the number multiplying the
// bonus, or 1 if the bonus appears bare, or 0 if it's absent.
function parseWoundsFormula(f) {
  const coeff = (abbr) => {
    const mult = new RegExp(`(\\d+)\\s*\\*\\s*${abbr}\\b`).exec(f);
    if (mult) return Number(mult[1]);
    return new RegExp(`\\b${abbr}\\b`).test(f) ? 1 : 0;
  };
  return { sb: coeff('SB'), tb: coeff('TB'), wpb: coeff('WPB') };
}

async function run() {
  const src = JSON.parse(await readFile(SRC, 'utf8'));
  const skills = JSON.parse(await readFile(join(CONTENT, 'skill.json'), 'utf8'));
  const talents = JSON.parse(await readFile(join(CONTENT, 'talent.json'), 'utf8'));

  const skillBySlug = new Map();
  for (const s of skills) skillBySlug.set(slugify(s.name), s);
  const talentBySlug = new Map();
  for (const t of talents) talentBySlug.set(slugify(t.name), t);

  const resolveSkill = (raw) => {
    if (SKILL_ALIASES[raw]) {
      const rec = skillBySlug.get(slugify(SKILL_ALIASES[raw]));
      if (rec) return { name: rec.name, characteristic: rec.characteristic ?? 'ws' };
    }
    const key = raw.endsWith('_any') ? raw.slice(0, -4) : raw;
    const rec = skillBySlug.get(key);
    if (rec) return { name: rec.name, characteristic: rec.characteristic ?? 'ws' };
    return { name: prettify(key), characteristic: 'ws' }; // homebrew fallback
  };
  const resolveTalent = (raw) => {
    const key = raw.endsWith('_any') ? raw.slice(0, -4) : raw;
    return talentBySlug.get(key)?.name ?? prettify(key);
  };

  const races = src.species.map((r) => {
    const modifiers = {};
    for (const [K, key] of Object.entries(ATTR_KEY)) modifiers[key] = r.attributes[K]?.base ?? 0;
    const d = r.derived;
    const talentNames = [...(r.talents?.fixed ?? []), ...(r.talents?.choice ?? [])].map(resolveTalent);
    return {
      name: r.name,
      modifiers,
      woundsCoeffs: parseWoundsFormula(d.woundsFormula),
      fate: d.fate ?? 0,
      resilience: d.resilience ?? 0,
      extraPoints: d.extraPoints ?? 0,
      movement: d.movement ?? 4,
      skills: r.skills.map(resolveSkill),
      talents: talentNames,
      randomTalents: r.talents?.random ?? 0,
    };
  });

  await writeFile(OUT, JSON.stringify(races, null, 2));
  for (const r of races) {
    console.log(`${r.name.padEnd(10)} wounds=${JSON.stringify(r.woundsCoeffs)} skills=${r.skills.length} talents=${r.talents.length} M${r.movement} F${r.fate} R${r.resilience}`);
  }

  // ── Class trappings ("objects"): keyed by class, applied when a career is chosen ──
  const trappings = JSON.parse(await readFile(join(CONTENT, 'trapping.json'), 'utf8'));
  const trappingBySlug = new Map();
  for (const tr of trappings) trappingBySlug.set(slugify(tr.name), tr);

  const resolveItem = (entry) => {
    // entry is a slug string, {item, quantity|days}, or {choice: [...]}.
    if (typeof entry === 'string') {
      const rec = trappingBySlug.get(entry);
      return { name: rec?.name ?? prettify(entry), qty: 1, enc: rec?.enc ?? 0 };
    }
    if (entry.choice) {
      return { name: entry.choice.map(prettify).join(' or '), qty: 1, enc: 0, notes: 'choose one' };
    }
    const rec = trappingBySlug.get(entry.item);
    const qty = typeof entry.quantity === 'number' ? entry.quantity : 1;
    const notes = typeof entry.quantity === 'string' ? `×${entry.quantity}`
      : entry.days != null ? `${entry.days} day(s) rations` : undefined;
    return { name: rec?.name ?? prettify(entry.item), qty, enc: rec?.enc ?? 0, ...(notes ? { notes } : {}) };
  };

  const classTrappings = {};
  for (const [key, items] of Object.entries(src.classTrappings ?? {})) {
    classTrappings[key] = items.map(resolveItem);
  }
  await writeFile(OUT_TRAPPINGS, JSON.stringify({ classKeys: CLASS_KEYS, byClass: classTrappings }, null, 2));
  console.log('class trappings:', Object.keys(classTrappings).map(k => `${k}:${classTrappings[k].length}`).join('  '));

  // ── Random talent table (d100 roll → talent), for the random-talent roller ──
  const randomTable = (src.randomTalentTable ?? []).map((e) => {
    const [lo, hi] = e.roll.split('-');
    const min = Number(lo);
    const max = hi === '00' ? 100 : Number(hi);
    return { min, max, name: resolveTalent(e.talent) };
  });
  await writeFile(OUT_RANDOM, JSON.stringify(randomTable, null, 2));
  console.log('random talent table:', randomTable.length, 'entries; covers',
    randomTable.reduce((s, e) => s + (e.max - e.min + 1), 0), 'of 100');
}

run().catch((e) => { console.error(e); process.exit(1); });
