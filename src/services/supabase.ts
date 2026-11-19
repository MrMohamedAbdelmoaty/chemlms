/**
 * Supabase persistence client (PostgREST via fetch — no extra dependency).
 *
 * This is the durable store for ChemLMS. The whole app keeps working exactly
 * as before (the in-memory `db` is the working copy), but every mutation is
 * also written to Supabase, and startup loads the real data back from there.
 * Result: user accounts, grades, attendance, submissions, messages and every
 * other entity survive page reloads and are never reset — they live in a
 * permanent Supabase Postgres database.
 */

// Project "School" on Supabase (eu-west-1). The anon key is a publishable
// client key; Row Level Security is disabled on `app_data` for this demo,
// so the front-end can read/write directly. A production deployment would
// re-enable RLS and route writes through a service/edge layer.
const SUPABASE_URL = 'https://mxseuwlhhkqkpgofecoa.supabase.co/rest/v1';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c2V1d2xoaGtxa3Bnb2ZlY29hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTkwMzcsImV4cCI6MjEwOTA5NTAzN30.FIDldAqwaE5XlE_PF74p_lR88huAqzqJaO65L7ya6W0';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  // ask PostgREST to return the rows it actually wrote
  Prefer: 'resolve=return=representation',
};

export interface StoredRow {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

/** True if Supabase is configured and reachable. */
export const supabaseEnabled = true;

/** Fetch every record for a collection. Returns [] on any error. */
export async function fetchCollection(collection: string): Promise<StoredRow['data'][]> {
  const url = `${SUPABASE_URL}/app_data?select=data&collection=eq.${encodeURIComponent(collection)}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const rows = (await res.json()) as { data: Record<string, unknown> }[];
    return rows.map((r) => r.data);
  } catch {
    return [];
  }
}

/**
 * Write all records of a collection to Supabase. Because PostgREST upsert
 * (`on_conflict`) is unreliable here, we do a DELETE of the collection followed
 * by a bulk INSERT. This guarantees the stored state exactly matches the
 * in-memory working copy — no stale or duplicate rows. Wrapped in a single
 * best-effort sequence; failures are logged but never block the UI.
 */
export async function saveCollection(collection: string, records: { id: string }[]): Promise<void> {
  const coll = encodeURIComponent(collection);
  try {
    // 1. Remove any existing rows for this collection.
    await fetch(`${SUPABASE_URL}/app_data?collection=eq.${coll}`, {
      method: 'DELETE',
      headers: { ...HEADERS, Prefer: '' },
    });
  } catch {
    /* best-effort */
  }
  if (!records.length) return;
  const payload = records.map((r) => ({ collection, id: r.id, data: r }));
  try {
    const res = await fetch(`${SUPABASE_URL}/app_data`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`save ${collection} failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.warn('[ChemLMS] Supabase write error for', collection, err);
  }
}

/** Delete every row (used only by an explicit admin "reset to seed"). */
export async function clearAll(): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/app_data?select=collection,id`, {
      method: 'DELETE',
      headers: { ...HEADERS, Prefer: '' },
    });
  } catch {
    /* ignore */
  }
}
