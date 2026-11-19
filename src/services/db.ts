/**
 * In-memory "database".
 *
 * In a real deployment this module is the single seam to swap for a REST/
 * database backend: components and the api.ts service layer only ever touch
 * `db` through the service functions, so replacing it with `fetch()` calls
 * later leaves the UI untouched.
 */
import { createDatabase } from '../data/seed';
import type { Database } from '../types';

export const db: Database = createDatabase();

/** Rebuild the database from seed (used by the "Reset demo data" action). */
export function resetDatabase(): void {
  const fresh = createDatabase();
  for (const key of Object.keys(db) as (keyof Database)[]) {
    (db[key] as unknown) = fresh[key];
  }
}
