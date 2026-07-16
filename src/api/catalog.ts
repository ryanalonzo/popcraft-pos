/**
 * Catalog data access — all reads and writes hit local SQLite, never the
 * network. The sync layer is the only thing that pulls fresh data from
 * the server and feeds it through `upsertItems` / `upsertRenters`.
 *
 * Keeping reads local-only is what makes the cashier flow snappy and
 * offline-tolerant: scanning an item is a single primary-key lookup, not
 * a round trip.
 */

import { openDatabase } from '@/lib/db';
import type { Item, ItemMarkdown, PriceTier, Renter } from '@/types';

const LAST_SYNC_KEY = 'last_sync_at';

interface RenterRow {
  id: string;
  name: string;
  is_active: number;
  created_at: string;
  synced_at: string;
}

interface ItemRow {
  id: string;
  code: string;
  barcode_value: string | null;
  name: string;
  description: string | null;
  renter_id: string;
  price_centavos: number;
  stock: number | null;
  price_tiers_json: string | null;
  markdown_json: string | null;
  is_active: number;
  updated_at: string;
  synced_at: string;
}

/**
 * Parse the stored tiers JSON, defending against malformed/legacy rows: any
 * tier missing numeric fields is dropped, and the result is sorted ascending
 * by `min_quantity` so the cart's tier-selection logic gets a clean array.
 * Returns undefined when there are no usable tiers.
 */
function parsePriceTiers(json: string | null): PriceTier[] | undefined {
  if (!json) return undefined;
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return undefined;
    const tiers = raw
      .filter(
        (t): t is PriceTier =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as PriceTier).min_quantity === 'number' &&
          typeof (t as PriceTier).unit_price_centavos === 'number',
      )
      .map((t) => ({
        min_quantity: t.min_quantity,
        unit_price_centavos: t.unit_price_centavos,
      }))
      .sort((a, b) => a.min_quantity - b.min_quantity);
    return tiers.length > 0 ? tiers : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse the stored markdown JSON, defending against malformed/legacy rows:
 * a `percentage` outside 0–100 (or non-numeric) is rejected, and the date
 * bounds fall back to null ("open-ended") when absent or the wrong type.
 * Returns undefined when there's no usable markdown.
 */
function parseMarkdown(json: string | null): ItemMarkdown | undefined {
  if (!json) return undefined;
  try {
    const raw = JSON.parse(json) as unknown;
    if (typeof raw !== 'object' || raw === null) return undefined;
    const m = raw as Partial<ItemMarkdown>;
    if (typeof m.percentage !== 'number' || !(m.percentage > 0)) return undefined;
    return {
      percentage: m.percentage,
      date_from: typeof m.date_from === 'string' ? m.date_from : null,
      date_to: typeof m.date_to === 'string' ? m.date_to : null,
    };
  } catch {
    return undefined;
  }
}

function rowToRenter(row: RenterRow): Renter {
  return {
    id: row.id,
    name: row.name,
    is_active: row.is_active === 1,
    created_at: row.created_at,
  };
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    code: row.code,
    barcode_value: row.barcode_value,
    name: row.name,
    description: row.description ?? '',
    renter_id: row.renter_id,
    price_centavos: row.price_centavos,
    stock: row.stock ?? null,
    price_tiers: parsePriceTiers(row.price_tiers_json),
    markdown: parseMarkdown(row.markdown_json),
    is_active: row.is_active === 1,
    updated_at: row.updated_at,
  };
}

/**
 * Look up a single item by either its SKU (`code`) or its raw scanner
 * barcode (`barcode_value`). Manual entry hits `code`; hardware scanner
 * input hits `barcode_value`. Returns null for unknown values.
 */
export async function getItemByCode(code: string): Promise<Item | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE (code = ? OR barcode_value = ?) AND is_active = 1 LIMIT 1',
    [code, code],
  );
  return row ? rowToItem(row) : null;
}

/** All active items belonging to a single renter, ordered by code. */
export async function getItemsByRenter(renterId: string): Promise<Item[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM items WHERE renter_id = ? AND is_active = 1 ORDER BY code',
    [renterId],
  );
  return rows.map(rowToItem);
}

/**
 * Case-insensitive substring search on item name. Results favour exact
 * matches, then prefix matches, then anything containing the query —
 * shorter names ranked higher within each tier.
 */
export async function searchItems(
  query: string,
  limit: number = 25,
): Promise<Item[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const db = await openDatabase();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT *,
        CASE
          WHEN lower(name) = lower(?) THEN 0
          WHEN lower(name) LIKE lower(?) || '%' THEN 1
          ELSE 2
        END AS relevance
     FROM items
     WHERE is_active = 1
       AND lower(name) LIKE '%' || lower(?) || '%'
     ORDER BY relevance, length(name), name
     LIMIT ?`,
    [trimmed, trimmed, trimmed, limit],
  );
  return rows.map(rowToItem);
}

/** Every renter in the catalog (active and inactive), ordered by name. */
export async function getAllRenters(): Promise<Renter[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<RenterRow>(
    'SELECT * FROM renters ORDER BY name',
  );
  return rows.map(rowToRenter);
}

/** Insert-or-update a batch of items in a single transaction. */
export async function upsertItems(items: Item[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDatabase();
  const syncedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO items
            (id, code, barcode_value, name, description, renter_id,
             price_centavos, stock, price_tiers_json, markdown_json, is_active, updated_at, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            barcode_value = excluded.barcode_value,
            name = excluded.name,
            description = excluded.description,
            renter_id = excluded.renter_id,
            price_centavos = excluded.price_centavos,
            stock = excluded.stock,
            price_tiers_json = excluded.price_tiers_json,
            markdown_json = excluded.markdown_json,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at,
            synced_at = excluded.synced_at`,
        [
          item.id,
          item.code,
          item.barcode_value,
          item.name,
          item.description,
          item.renter_id,
          item.price_centavos,
          item.stock ?? null,
          item.price_tiers && item.price_tiers.length > 0
            ? JSON.stringify(item.price_tiers)
            : null,
          item.markdown ? JSON.stringify(item.markdown) : null,
          item.is_active ? 1 : 0,
          item.updated_at,
          syncedAt,
        ],
      );
    }
  });
}

/**
 * Optimistically decrement cached on-hand stock after a sale, so the cart's
 * stock cap reflects what's already been sold without waiting for a catalog
 * sync. Local-only and clamped at 0; rows with unknown stock (NULL) are left
 * alone. The next catalog sync overwrites these with the server's absolute
 * count, reconciling any drift (e.g. sales from another terminal).
 */
export async function decrementItemStock(
  deltas: { itemId: string; quantity: number }[],
): Promise<void> {
  if (deltas.length === 0) return;
  const db = await openDatabase();
  await db.withTransactionAsync(async () => {
    for (const { itemId, quantity } of deltas) {
      if (quantity <= 0) continue;
      await db.runAsync(
        `UPDATE items
            SET stock = MAX(0, stock - ?)
          WHERE id = ? AND stock IS NOT NULL`,
        [quantity, itemId],
      );
    }
  });
}

/** Insert-or-update a batch of renters in a single transaction. */
export async function upsertRenters(renters: Renter[]): Promise<void> {
  if (renters.length === 0) return;
  const db = await openDatabase();
  const syncedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const renter of renters) {
      await db.runAsync(
        `INSERT INTO renters (id, name, is_active, created_at, synced_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            is_active = excluded.is_active,
            created_at = excluded.created_at,
            synced_at = excluded.synced_at`,
        [
          renter.id,
          renter.name,
          renter.is_active ? 1 : 0,
          renter.created_at,
          syncedAt,
        ],
      );
    }
  });
}

/** ISO timestamp of the last successful sync, or null if never synced. */
export async function getLastSyncTime(): Promise<string | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [LAST_SYNC_KEY],
  );
  return row?.value ?? null;
}

/** Persist the timestamp of a successful sync. */
export async function setLastSyncTime(iso: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LAST_SYNC_KEY, iso],
  );
}

export interface CatalogStats {
  items: number;
  activeItems: number;
  renters: number;
  activeRenters: number;
}

/**
 * Wipe local catalog. Used by the settings screen to force a full re-sync
 * after switching API base URLs or recovering from corruption.
 */
export async function clearCatalog(): Promise<void> {
  const db = await openDatabase();
  await db.execAsync('BEGIN');
  try {
    await db.runAsync('DELETE FROM items');
    await db.runAsync('DELETE FROM renters');
    await db.runAsync('DELETE FROM sync_state WHERE key = ?', [LAST_SYNC_KEY]);
    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }
}

/** Lightweight counts for the debug screen. */
export async function getCatalogStats(): Promise<CatalogStats> {
  const db = await openDatabase();
  const itemsRow = await db.getFirstAsync<{ total: number; active: number }>(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM items',
  );
  const rentersRow = await db.getFirstAsync<{ total: number; active: number }>(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM renters',
  );
  return {
    items: itemsRow?.total ?? 0,
    activeItems: itemsRow?.active ?? 0,
    renters: rentersRow?.total ?? 0,
    activeRenters: rentersRow?.active ?? 0,
  };
}
