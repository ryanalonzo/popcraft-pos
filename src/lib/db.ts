/**
 * Local SQLite connection used by the catalog cache, sync state, and the
 * offline-sale queue. The database lives in the app's documents directory
 * and is opened once per app lifetime — callers get the same connection
 * back from `openDatabase()`.
 *
 * Schema changes go in `MIGRATIONS`. Each entry is a string of one or
 * more statements; on startup we read `PRAGMA user_version` and run only
 * the migrations newer than the stored version, then bump it.
 */

import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'popcraft_pos.db';

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
    CREATE TABLE IF NOT EXISTS renters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      renter_id TEXT NOT NULL,
      price_centavos INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      FOREIGN KEY (renter_id) REFERENCES renters(id)
    );

    CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
    CREATE INDEX IF NOT EXISTS idx_items_renter ON items(renter_id);
    CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_sales (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `,

  // v2 — store the raw numeric barcode so hardware-scanner lookups
  // resolve. Karl's API returns both `sku` (used as the friendly `code`)
  // and `barcode_value` (the actual scanned digits); we need both
  // columns to satisfy manual entry AND scanner input.
  `
    ALTER TABLE items ADD COLUMN barcode_value TEXT;
    CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode_value);
  `,
];

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Open (or reuse) the local SQLite connection, running migrations first. */
export function openDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Apply every migration newer than the database's current `user_version`. */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;',
  );
  const current = row?.user_version ?? 0;
  for (let v = current + 1; v <= MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v - 1];
    if (!sql) continue;
    await db.execAsync(sql);
    // PRAGMA user_version doesn't support parameter binding.
    await db.execAsync(`PRAGMA user_version = ${v};`);
  }
}

/**
 * Test-only escape hatch — clears the singleton so the next `openDatabase`
 * call returns a fresh connection. Production code should never call this.
 */
export function resetDatabaseHandleForTests(): void {
  dbPromise = null;
}
