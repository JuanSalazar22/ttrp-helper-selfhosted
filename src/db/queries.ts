import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import type { CharacterRow, CharacterData, GameSystem, RollHistoryRow } from '../types';
import {
  CONTENT_SOURCES, CONTENT_SEED_VERSION,
  type ContentCategory, type ContentRecord,
} from '../data/wfrp-content';
import { WFRP_CONTENT_ES, ES_CONTENT_SEED_VERSION } from '../data/wfrp-content/es';
import type { Locale } from '@/i18n/types';

export type { ContentRecord };

// ─── Characters ───────────────────────────────────────────────────────────────

export async function getAllCharacters(db: SQLite.SQLiteDatabase): Promise<CharacterRow[]> {
  return db.getAllAsync<CharacterRow>(
    'SELECT * FROM characters ORDER BY updated_at DESC'
  );
}

export async function getCharactersBySystem(
  db: SQLite.SQLiteDatabase,
  system: GameSystem
): Promise<CharacterRow[]> {
  return db.getAllAsync<CharacterRow>(
    'SELECT * FROM characters WHERE system = ? ORDER BY updated_at DESC',
    [system]
  );
}

export async function getCharacter(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<CharacterRow | null> {
  return db.getFirstAsync<CharacterRow>(
    'SELECT * FROM characters WHERE id = ?',
    [id]
  );
}

export async function createCharacter(
  db: SQLite.SQLiteDatabase,
  system: GameSystem,
  name: string,
  data: CharacterData
): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO characters (id, system, name, portrait_uri, data, schema_ver, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, 1, ?, ?)`,
    [id, system, name, JSON.stringify(data), now, now]
  );
  return id;
}

export async function updateCharacter(
  db: SQLite.SQLiteDatabase,
  id: string,
  data: CharacterData
): Promise<void> {
  await db.runAsync(
    'UPDATE characters SET data = ?, name = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(data), data.name, Date.now(), id]
  );
}

export async function updatePortrait(
  db: SQLite.SQLiteDatabase,
  id: string,
  uri: string | null,
  portraitUpdatedAt: string | null = null
): Promise<void> {
  await db.runAsync(
    'UPDATE characters SET portrait_uri = ?, portrait_updated_at = ?, updated_at = ? WHERE id = ?',
    [uri, portraitUpdatedAt, Date.now(), id]
  );
}

export async function deleteCharacter(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM characters WHERE id = ?', [id]);
}

export async function duplicateCharacter(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<string> {
  const original = await getCharacter(db, id);
  if (!original) throw new Error(`Character ${id} not found`);

  const data: CharacterData = JSON.parse(original.data);
  data.name = `${data.name} (copy)`;
  const newId = uuidv4();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO characters (id, system, name, portrait_uri, data, schema_ver, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    [newId, original.system, data.name, JSON.stringify(data), original.schema_ver, now, now]
  );
  return newId;
}

/** Local rows' id + last-synced cloud timestamp, for building the pull reconcile map. */
export async function getCharacterSyncRefs(
  db: SQLite.SQLiteDatabase,
): Promise<Array<{ id: string; cloud_updated_at: string | null; portrait_updated_at: string | null }>> {
  return db.getAllAsync<{ id: string; cloud_updated_at: string | null; portrait_updated_at: string | null }>(
    'SELECT id, cloud_updated_at, portrait_updated_at FROM characters',
  );
}

/** Insert or replace a character pulled from the cloud, recording the cloud timestamp.
 *  Used for both 'insert' and 'update' pull actions. Preserves created_at on conflict. */
export async function upsertLocalCharacter(
  db: SQLite.SQLiteDatabase,
  r: { id: string; system: string; name: string; dataJson: string; updatedAtMs: number; cloudUpdatedAt: string },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO characters (id, system, name, portrait_uri, data, schema_ver, created_at, updated_at, cloud_updated_at)
     VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       system = excluded.system, name = excluded.name, data = excluded.data,
       updated_at = excluded.updated_at, cloud_updated_at = excluded.cloud_updated_at`,
    [r.id, r.system, r.name, r.dataJson, r.updatedAtMs, r.updatedAtMs, r.cloudUpdatedAt],
  );
}

/** Record the cloud timestamp we last synced for a local row (called after a push). */
export async function setCloudUpdatedAt(
  db: SQLite.SQLiteDatabase,
  id: string,
  cloudUpdatedAt: string,
): Promise<void> {
  await db.runAsync('UPDATE characters SET cloud_updated_at = ? WHERE id = ?', [cloudUpdatedAt, id]);
}

// ─── Roll history ─────────────────────────────────────────────────────────────

export async function addRoll(
  db: SQLite.SQLiteDatabase,
  characterId: string,
  label: string,
  expression: string,
  result: number,
  breakdown: object
): Promise<void> {
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO roll_history (id, character_id, label, expression, result, breakdown, rolled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, characterId, label, expression, result, JSON.stringify(breakdown), Date.now()]
  );
  // Keep only last 50 rolls per character
  await db.runAsync(
    `DELETE FROM roll_history WHERE character_id = ? AND id NOT IN (
       SELECT id FROM roll_history WHERE character_id = ?
       ORDER BY rolled_at DESC LIMIT 50
     )`,
    [characterId, characterId]
  );
}

export async function getRollHistory(
  db: SQLite.SQLiteDatabase,
  characterId: string
): Promise<RollHistoryRow[]> {
  return db.getAllAsync<RollHistoryRow>(
    'SELECT * FROM roll_history WHERE character_id = ? ORDER BY rolled_at DESC LIMIT 50',
    [characterId]
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(
  db: SQLite.SQLiteDatabase,
  key: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// ─── Content library (WFRP4e book reference for autocomplete) ───────────────────

const SEED_VERSION_KEY = 'content_seed_version';

/**
 * Populate content_library from the bundled JSON. No-op once the current
 * CONTENT_SEED_VERSION is already seeded. Runs once on launch; safe to call repeatedly.
 * Uses a prepared statement inside one transaction (~3k rows) so it's fast even on web.
 */
export async function seedContentLibrary(db: SQLite.SQLiteDatabase): Promise<void> {
  const current = await getSetting(db, SEED_VERSION_KEY);
  if (current === CONTENT_SEED_VERSION) return;

  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO content_library (id, category, name, attribute, data)
     VALUES ($id, $category, $name, $attribute, $data)`
  );
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM content_library');
      for (const category of Object.keys(CONTENT_SOURCES) as ContentCategory[]) {
        for (const r of CONTENT_SOURCES[category]) {
          await stmt.executeAsync({
            $id: r.id,
            $category: category,
            $name: r.name,
            $attribute: (r.characteristic as string | null) ?? null,
            $data: JSON.stringify(r),
          });
        }
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
  await setSetting(db, SEED_VERSION_KEY, CONTENT_SEED_VERSION);
}

/** Partial display-field overlay stored per (content_id, locale). */
export type ContentOverlay = Partial<ContentRecord>;

/** Pure merge: overlay translated fields onto a base record. Null overlay → base. */
export function applyOverlay(base: ContentRecord, overlay: ContentOverlay | null): ContentRecord {
  return overlay ? { ...base, ...overlay } : base;
}

/** Resolve content records by id, overlaying the given locale's translations when present. */
export async function getContentByIds(
  db: SQLite.SQLiteDatabase,
  ids: string[],
  locale: Locale = 'en'
): Promise<ContentRecord[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.id IN (${placeholders})`,
    [locale, ...ids]
  );
  return rows.map((r) =>
    applyOverlay(JSON.parse(r.data) as ContentRecord, r.overlay ? JSON.parse(r.overlay) : null)
  );
}

/** Look up records of one category by exact name (case-insensitive). Used to enrich race/origin
 *  talent grants and Hammergen-imported talents/skills — those sources store names as plain
 *  strings, so this maps them back to the library entries carrying `description` and `tests`.
 *  Missing names are simply absent from the result (custom / non-book entries keep empty
 *  descriptions upstream). */
export async function getContentByNames(
  db: SQLite.SQLiteDatabase,
  category: ContentCategory,
  names: string[],
  locale: Locale = 'en'
): Promise<ContentRecord[]> {
  if (names.length === 0) return [];
  const placeholders = names.map(() => '?').join(',');
  const lowered = names.map(n => n.toLowerCase());
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.category = ? AND lower(c.name) IN (${placeholders})`,
    [locale, category, ...lowered]
  );
  return rows.map((r) =>
    applyOverlay(JSON.parse(r.data) as ContentRecord, r.overlay ? JSON.parse(r.overlay) : null)
  );
}

/** Case-insensitive name search within one category, overlaying locale translations on
 *  results. `limit` should comfortably exceed the category's total row count when the
 *  caller means to let the user browse everything (e.g. an empty query) — the query
 *  itself is a plain indexed-friendly LIKE scan, so a generous limit costs nothing on a
 *  local SQLite DB; it's the row COUNT actually returned to the UI that matters. */
export async function searchContent(
  db: SQLite.SQLiteDatabase,
  category: ContentCategory,
  query: string,
  limit = 30,
  locale: Locale = 'en'
): Promise<ContentRecord[]> {
  const trimmed = query.trim();
  const q = `%${trimmed}%`;
  const nameExpr = 'COALESCE(t.name, c.name)';
  // Careers carry rank-specific level names inside `data` (e.g. "Doktor" for Physician);
  // match those too so a search by rank title finds the parent career.
  const matchData = category === 'career';
  const dataClause = matchData ? ' OR c.data LIKE ? COLLATE NOCASE' : '';
  // Once there's something to match, rank exact hits ahead of prefix hits ahead of plain
  // substring hits (still alphabetical within each tier) — so typing more of a name
  // surfaces it immediately instead of it being buried among hundreds of alphabetically
  // earlier matches in a large category (e.g. Trappings, 600+ entries). An empty query
  // (browsing) has nothing to rank against, so it stays plain alphabetical.
  const orderBy = trimmed
    ? `CASE WHEN ${nameExpr} LIKE ? COLLATE NOCASE THEN 0 WHEN ${nameExpr} LIKE ? COLLATE NOCASE THEN 1 ELSE 2 END, ${nameExpr}`
    : nameExpr;
  const params: (string | number)[] = [locale, category, q, q];
  if (matchData) params.push(q);
  if (trimmed) params.push(trimmed, `${trimmed}%`);
  params.push(limit);
  const rows = await db.getAllAsync<{ data: string; overlay: string | null }>(
    `SELECT c.data AS data, t.overlay AS overlay
       FROM content_library c
       LEFT JOIN content_translations t ON t.content_id = c.id AND t.locale = ?
      WHERE c.category = ? AND (c.name LIKE ? COLLATE NOCASE OR t.name LIKE ? COLLATE NOCASE${dataClause})
      ORDER BY ${orderBy} LIMIT ?`,
    params
  );
  return rows.map((r) =>
    applyOverlay(JSON.parse(r.data) as ContentRecord, r.overlay ? JSON.parse(r.overlay) : null)
  );
}

/**
 * Seed per-locale content overlays from an optional bundle. No-op for English or an
 * empty bundle. Gated by a per-locale seed-version setting so it runs once per version.
 * No Spanish bundle ships today; this exists so content can be slotted in without
 * touching the resolver.
 */
export async function seedContentTranslations(
  db: SQLite.SQLiteDatabase,
  locale: Locale,
  bundle: { id: string; overlay: ContentOverlay }[],
  version: string
): Promise<void> {
  if (locale === 'en' || bundle.length === 0) return;
  const key = `content_translation_seed_version_${locale}`;
  if ((await getSetting(db, key)) === version) return;

  const stmt = await db.prepareAsync(
    `INSERT OR REPLACE INTO content_translations (content_id, locale, name, overlay)
     VALUES ($id, $locale, $name, $overlay)`
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const row of bundle) {
        await stmt.executeAsync({
          $id: row.id,
          $locale: locale,
          $name: (row.overlay.name as string | undefined) ?? null,
          $overlay: JSON.stringify(row.overlay),
        });
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
  await setSetting(db, key, version);
}

/** Seed the bundled Spanish name overlays. Idempotent (gated by ES_CONTENT_SEED_VERSION). */
export async function seedWfrpContentTranslations(db: SQLite.SQLiteDatabase): Promise<void> {
  const bundle = WFRP_CONTENT_ES.map((r) => ({
    id: r.id,
    overlay: { name: r.name, description: r.description, page: r.page, range: r.range, duration: r.duration },
  }));
  await seedContentTranslations(db, 'es', bundle, ES_CONTENT_SEED_VERSION);
}
