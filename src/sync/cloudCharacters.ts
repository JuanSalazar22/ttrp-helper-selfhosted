import type { Session } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import { setCloudUpdatedAt } from '@/db/queries';
import type { CloudCharacter } from '@/sync/reconcile';

/** Upsert one character; the DB trigger sets updated_at, which we read back and store
 *  locally as cloud_updated_at. No-op when unconfigured/signed out; never throws. */
export async function pushCharacter(
  db: SQLiteDatabase,
  session: Session | null,
  c: { id: string; system: string; data: any },
): Promise<{ ok: boolean }> {
  if (!supabaseConfig.enabled || !session) return { ok: true }; // no-op is not a failure
  const { data, error } = await supabase
    .from('characters')
    .upsert({ id: c.id, user_id: session.user.id, system: c.system, data: c.data, deleted_at: null })
    .select('updated_at')
    .single();
  if (error) { console.warn('[sync] push failed:', error.message); return { ok: false }; }
  if (data?.updated_at) await setCloudUpdatedAt(db, c.id, data.updated_at as string);
  return { ok: true };
}

/** Fetch ALL of the user's rows, including tombstones (needed to propagate deletes). */
export async function pullCharacters(session: Session | null): Promise<CloudCharacter[]> {
  if (!supabaseConfig.enabled || !session) return [];
  const { data, error } = await supabase
    .from('characters')
    .select('id,system,data,updated_at,deleted_at');
  if (error) { console.warn('[sync] pull failed:', error.message); return []; }
  return (data ?? []) as CloudCharacter[];
}

/** Soft-delete a character in the cloud so the deletion propagates to other devices. */
export async function softDeleteCharacterCloud(session: Session | null, id: string): Promise<void> {
  if (!supabaseConfig.enabled || !session) return;
  const { error } = await supabase
    .from('characters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('[sync] soft-delete failed:', error.message);
}

/** Soft-delete every one of the signed-in user's characters — the reversible half of
 *  account deletion ("Remove cloud data"). Scoped by user_id in addition to relying on
 *  RLS, so the intent is explicit even though RLS alone would already enforce it. */
export async function softDeleteAllCharacters(session: Session | null): Promise<{ ok: boolean }> {
  if (!supabaseConfig.enabled || !session) return { ok: true }; // no-op is not a failure
  const { error } = await supabase
    .from('characters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', session.user.id);
  if (error) { console.warn('[sync] soft-delete-all failed:', error.message); return { ok: false }; }
  return { ok: true };
}
