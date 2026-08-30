// Transform the raw Foundry-style WFRP4e book dumps in json_book_information/ into
// trimmed, normalized seed records under src/data/wfrp-content/<category>.json.
// These are bundled and seeded into the SQLite content_library table on first launch.
//
//   node scripts/build-wfrp-content.mjs
//
// Re-run whenever json_book_information/ changes, then bump CONTENT_SEED_VERSION.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'json_book_information');
const OUT = join(ROOT, 'src', 'data', 'wfrp-content');

// Foundry stores the characteristic as a 1-based index in standard WFRP order.
const CHAR_KEYS = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
const attrKey = (n) => (n >= 1 && n <= 10 ? CHAR_KEYS[n - 1] : null);

const clean = (s) => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim() : '');
const page = (src) => (src && typeof src === 'object' ? Object.values(src)[0] ?? '' : '');

// Keep only non-zero attribute modifiers, as { ws: 10, t: -5 }.
function trimModifiers(mods) {
  const out = {};
  const a = mods?.attributes ?? {};
  // raw uses capitalized keys (Ag, BS, …); map to our lowercase keys by position
  const RAW = { WS: 'ws', BS: 'bs', S: 's', T: 't', I: 'i', Ag: 'ag', Dex: 'dex', Int: 'int', WP: 'wp', Fel: 'fel' };
  for (const [rk, v] of Object.entries(a)) {
    const k = RAW[rk];
    if (k && v) out[k] = v;
  }
  const extra = {};
  if (mods?.movement) extra.movement = mods.movement;
  if (mods?.size) extra.size = mods.size;
  return { ...(Object.keys(out).length ? { attributes: out } : {}), ...extra };
}

const TRANSFORMS = {
  skills(o, id) {
    return {
      id, name: clean(o.name),
      characteristic: attrKey(o.attribute),
      isAdvanced: o.type === 1,
      isGroup: !!o.isGroup,
      description: clean(o.description),
      page: page(o.source),
    };
  },
  talents(o, id) {
    const mods = trimModifiers(o.modifiers);
    return {
      id, name: clean(o.name),
      characteristic: attrKey(o.attribute),
      maxRank: o.maxRank || 0,            // 0 = derived from characteristic bonus
      tests: clean(o.tests),
      description: clean(o.description),
      ...(Object.keys(mods).length ? { modifiers: mods } : {}),
      page: page(o.source),
    };
  },
  spells(o, id) {
    return {
      id, name: clean(o.name),
      cn: o.cn ?? 0,
      range: clean(o.range), target: clean(o.target), duration: clean(o.duration),
      lore: o.classification?.type ?? null,
      description: clean(o.description),
      page: page(o.source),
    };
  },
  prayers(o, id) {
    return {
      id, name: clean(o.name),
      range: clean(o.range), target: clean(o.target), duration: clean(o.duration),
      description: clean(o.description),
      page: page(o.source),
    };
  },
  trappings(o, id) {
    const sub = {};
    if (o.melee?.dmg || o.melee?.group) sub.melee = o.melee;
    if (o.ranged?.dmg || o.ranged?.group) sub.ranged = o.ranged;
    if (o.armour?.points || o.armour?.location?.length) sub.armour = o.armour;
    if (o.ammunition?.dmg || o.ammunition?.group) sub.ammunition = o.ammunition;
    return {
      id, name: clean(o.name),
      enc: o.enc ?? 0, price: o.price ?? 0, availability: o.availability ?? 0,
      properties: o.properties ?? [],
      ...sub,
      description: clean(o.description),
      page: page(o.source),
    };
  },
  qualities_and_flaws(o, id) {
    return {
      id, name: clean(o.name),
      kind: o.type === 1 ? 'flaw' : 'quality',
      applicableTo: o.applicableTo ?? [],
      description: clean(o.description),
      page: page(o.source),
    };
  },
  mutations(o, id) {
    const mods = trimModifiers(o.modifiers);
    return {
      id, name: clean(o.name),
      kind: o.type === 1 ? 'mental' : 'physical',
      ...(Object.keys(mods).length ? { modifiers: mods } : {}),
      description: clean(o.description),
      page: page(o.source),
    };
  },
  creature_traits(o, id) {
    const mods = trimModifiers(o.modifiers);
    return {
      id, name: clean(o.name),
      ...(Object.keys(mods).length ? { modifiers: mods } : {}),
      description: clean(o.description),
      page: page(o.source),
    };
  },
  runes(o, id) {
    return {
      id, name: clean(o.name),
      applicableTo: o.applicableTo ?? [],
      description: clean(o.description),
      page: page(o.source),
    };
  },
  careers(o, id) {
    const levels = [];
    for (const lvl of ['level1', 'level2', 'level3', 'level4']) {
      const L = o[lvl];
      if (!L?.exists) continue;
      levels.push({
        name: clean(L.name),
        status: L.status ?? 0, standing: L.standing ?? 0,
        attributes: (L.attributes ?? []).map(attrKey).filter(Boolean),
        skills: L.skills ?? [],     // raw skill ids (resolved later if needed)
        talents: L.talents ?? [],
        items: clean(L.items),
      });
    }
    return {
      id, name: clean(o.name ?? o.level1?.name),
      class: o.class ?? 0,
      description: clean(o.description),
      levels,
      page: page(o.source),
    };
  },
};

/** critical_wounds.json isn't a Foundry dump like the others (it's hand-transcribed
 *  from a fan reference sheet) — nested by location, no id/object wrapper — so it
 *  gets its own flattening step instead of joining the generic TRANSFORMS loop below. */
async function buildCriticalWounds() {
  const raw = JSON.parse(await readFile(join(SRC, 'critical_wounds.json'), 'utf8'));
  const rows = [];
  for (const location of ['head', 'body', 'arm', 'leg']) {
    for (const entry of raw[location]) {
      rows.push({
        id: `${location}_${entry.rollMin}`,
        name: clean(entry.name),
        location,
        rollMin: entry.rollMin,
        rollMax: entry.rollMax,
        wounds: entry.wounds,
        description: clean(entry.description),
      });
    }
  }
  return rows;
}

const CATEGORY = {
  skills: 'skill', talents: 'talent', spells: 'spell', prayers: 'prayer',
  trappings: 'trapping', qualities_and_flaws: 'quality', mutations: 'mutation',
  creature_traits: 'creature_trait', runes: 'rune', careers: 'career',
};

async function run() {
  await mkdir(OUT, { recursive: true });
  const index = {};
  for (const [file, transform] of Object.entries(TRANSFORMS)) {
    const raw = JSON.parse(await readFile(join(SRC, `${file}.json`), 'utf8'));
    const rows = (raw.data ?? [])
      .map((r) => transform(r.object ?? {}, r.id))
      .filter((r) => r.name);
    // de-dup by id (some dumps repeat)
    const seen = new Set();
    const deduped = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const category = CATEGORY[file];
    await writeFile(join(OUT, `${category}.json`), JSON.stringify(deduped));
    index[category] = deduped.length;
    console.log(`${category.padEnd(16)} ${deduped.length} records`);
  }

  const criticalWounds = await buildCriticalWounds();
  await writeFile(join(OUT, 'critical_wound.json'), JSON.stringify(criticalWounds));
  index.critical_wound = criticalWounds.length;
  console.log(`${'critical_wound'.padEnd(16)} ${criticalWounds.length} records`);

  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log('Total categories:', Object.keys(index).length);
}

run().catch((e) => { console.error(e); process.exit(1); });
