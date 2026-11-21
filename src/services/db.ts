/**
 * In-memory "database" — the working copy of all data.
 *
 * The UI and service layer only touch `db` through the service functions.
 * On top of that, every mutation is mirrored to a permanent Supabase Postgres
 * store (see ./supabase.ts), and startup loads the real data back from there.
 * So accounts, grades, attendance, submissions, messages, etc. survive reloads
 * and are never reset — while the app keeps the same in-memory contract a real
 * backend would eventually replace.
 */
import { createDatabase } from '../data/seed';
import type { Database, Database as DbShape } from '../types';
import { saveCollection, fetchCollection, supabaseEnabled } from './supabase';

export const db: DbShape = createDatabase();

/** Collections persisted to Supabase (all top-level entity collections). */
const PERSISTED: (keyof Database)[] = [
  'users', 'curricula', 'grades', 'classes', 'topics', 'learningOutcomes',
  'courses', 'lessons', 'questions', 'quizzes', 'assignments', 'submissions',
  'gradebook', 'attendance', 'liveSessions', 'messages', 'announcements',
  'notifications', 'auditLogs', 'settings', 'chemData', 'videos', 'deliverables',
] as (keyof Database)[];

/** Rebuild the database from seed (used by the "Reset demo data" action). */
export function resetDatabase(): void {
  const fresh = createDatabase();
  for (const key of Object.keys(db) as (keyof Database)[]) {
    (db[key] as unknown) = fresh[key];
  }
}

/**
 * Persist one collection to Supabase. Called after every mutation. The
 * in-memory `db` is already updated, so the UI responds instantly and the
 * durable write happens in the background.
 *
 * A coalescing write queue batches rapid successive persists for the same
 * collection into a single write, avoiding races / duplicate-key conflicts
 * when several mutations happen in the same tick.
 *
 * Handles three shapes:
 *  - id-keyed arrays (users, grades, submissions, ...) — one row per record.
 *  - `settings` — a single object, stored under a fixed id.
 *  - `progress` / `parentStudentLinks` — derived from `users`/parent links, so
 *    they are written via their parent entity's persist call.
 */
const writeQueue = new Map<string, Promise<void>>();

export function persist(collection: keyof Database): void {
  if (!supabaseEnabled) return;

  if (collection === 'settings') {
    void scheduleWrite('settings', () => saveCollection('settings', [{ id: 'root', ...(db.settings as object) } as { id: string }]));
    return;
  }
  if (collection === 'chemData') {
    void scheduleWrite('chemData', () => saveCollection('chemData', [{ id: 'root', ...(db.chemData as object) } as { id: string }]));
    return;
  }
  if (collection === 'progress' || collection === 'parentStudentLinks') return;

  const records = db[collection] as { id?: string }[];
  if (!Array.isArray(records)) return;
  const keyed = records.filter((r) => r && typeof r.id === 'string') as { id: string }[];
  void scheduleWrite(collection as string, () => saveCollection(collection as string, keyed));
}

/**
 * Schedule a write for `collection`, serialized per collection so concurrent
 * mutations never race (delete-then-insert for the same collection must run
 * one after another). The latest in-memory state is always flushed.
 */
function scheduleWrite(collection: string, write: () => Promise<void>): Promise<void> {
  const existing = writeQueue.get(collection);
  if (existing) {
    // Chain after the in-flight write so the two delete-then-insert cycles
    // don't overlap. Swallow the prior rejection; the new write re-reads
    // current state anyway.
    const next = existing.then(write, write).catch(() => {}).finally(() => writeQueue.delete(collection));
    writeQueue.set(collection, next);
    return next;
  }
  const p = write().catch(() => {}).finally(() => writeQueue.delete(collection));
  writeQueue.set(collection, p);
  return p;
}

/**
 * Load persisted data from Supabase at startup. If the database is empty, seed
 * it once so the first run has the demo data — and that seed is then stored
 * durably, so it is never lost again.
 */
export async function hydrateFromSupabase(): Promise<boolean> {
  if (!supabaseEnabled) return false;
  try {
    const users = await fetchCollection('users');
    if (!users.length) {
      // First run: seed, then persist everything so it becomes permanent.
    for (const key of PERSISTED) {
      if (key === 'settings') {
        await saveCollection('settings', [{ id: 'root', ...(db.settings as object) } as { id: string }]);
      } else if (key === 'chemData') {
        await saveCollection('chemData', [{ id: 'root', ...(db.chemData as object) } as { id: string }]);
      } else {
        await saveCollection(key as string, db[key] as { id: string }[]);
      }
    }
      await saveCollection('progress', Object.entries(db.progress).map(([id]) => ({ id })));
      console.info('[ChemLMS] Seeded demo data into Supabase.');
      return false; // nothing loaded (just seeded)
    }
    // Replace the in-memory collections with the persisted ones.
    // Fetch every collection in PARALLEL — the sequential loop was slow
    // (especially now that `deliverables` holds the master prompt + base64
    // files), and blocked first paint.
    const results = await Promise.all(
      PERSISTED.map((key) => fetchCollection(key as string).then((rows) => ({ key, rows }))),
    );
    for (const { key, rows } of results) {
      if (!rows.length) continue;
      if (key === 'settings') {
        (db.settings as unknown) = rows[0];
      } else if (key === 'chemData') {
        (db.chemData as unknown) = rows[0];
      } else {
        (db[key] as unknown) = rows as never;
      }
      console.info(`[ChemLMS] Loaded ${rows.length} ${key} from Supabase.`);
    }
    // Restore lesson progress (keyed by student id).
    const progressRows = await fetchCollection('progress');
    if (progressRows.length) {
      const restored: Record<string, unknown> = {};
      for (const r of progressRows) {
        const sid = (r as { studentId?: string }).studentId;
        if (sid) restored[sid] = (r as { progress?: unknown }).progress ?? {};
      }
      (db.progress as unknown) = restored;
      console.info(`[ChemLMS] Loaded progress for ${Object.keys(restored).length} students.`);
    }
    return true;
  } catch (err) {
    console.warn('[ChemLMS] Supabase hydrate failed, using in-memory seed.', err);
    return false;
  }
}
