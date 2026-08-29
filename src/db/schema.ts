import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'ttrphelper.db';

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // WAL is unsupported by the web (wa-sqlite) VFS — guard it so web init still runs.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {}
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS characters (
      id           TEXT PRIMARY KEY,
      system       TEXT NOT NULL,
      name         TEXT NOT NULL,
      portrait_uri TEXT,
      data         TEXT NOT NULL,
      schema_ver   INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      cloud_updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_characters_system
      ON characters(system);
    CREATE INDEX IF NOT EXISTS idx_characters_updated
      ON characters(updated_at DESC);

    CREATE TABLE IF NOT EXISTS roll_history (
      id           TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      label        TEXT NOT NULL,
      expression   TEXT NOT NULL,
      result       INTEGER NOT NULL,
      breakdown    TEXT NOT NULL,
      rolled_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rolls_character
      ON roll_history(character_id, rolled_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dice_macros (
      id           TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      expression   TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );

    -- Read-only WFRP4e book reference (skills, talents, spells, …), seeded from the
    -- bundled assets in src/data/wfrp-content on first launch. Drives autocomplete.
    CREATE TABLE IF NOT EXISTS content_library (
      id        TEXT PRIMARY KEY,
      category  TEXT NOT NULL,
      name      TEXT NOT NULL,
      attribute TEXT,
      data      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_content_cat_name
      ON content_library(category, name);

    -- Per-locale overlay for content_library display fields (name/description, …).
    -- A missing row means "use the English base". Seeded later from optional
    -- src/data/wfrp-content/<locale>/ bundles; empty today.
    CREATE TABLE IF NOT EXISTS content_translations (
      content_id TEXT NOT NULL,
      locale     TEXT NOT NULL,
      name       TEXT,
      overlay    TEXT NOT NULL,
      PRIMARY KEY (content_id, locale)
    );
  `);

  // content_translations.name was added later; backfill the column on older installs.
  // (New installs get it from the CREATE above; this covers upgrades.)
  try {
    await db.execAsync('ALTER TABLE content_translations ADD COLUMN name TEXT;');
  } catch {
    // Column already exists — ignore the "duplicate column name" error.
  }

  // cloud_updated_at was added in Phase 3; backfill on older installs.
  try {
    await db.execAsync('ALTER TABLE characters ADD COLUMN cloud_updated_at TEXT;');
  } catch {
    // Column already exists — ignore.
  }

  // portrait_updated_at was added for portrait upload; backfill on older installs.
  try {
    await db.execAsync('ALTER TABLE characters ADD COLUMN portrait_updated_at TEXT;');
  } catch {
    // Column already exists — ignore.
  }
}
