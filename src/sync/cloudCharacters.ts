import type { SQLiteDatabase } from 'expo-sqlite';
import * as api from '@/lib/api';
import { setCloudUpdatedAt } from '@/db/queries';
import type { CloudCharacter } from '@/sync/reconcile';

type Session = { user: { id: string; name: string } } | null;

/** Upsert one character; the server sets updated_at, which we read back and
 *  store locally as cloud_updated_at. No-op when signed out; never throws. */
export async function pushCharacter(
  db: SQLiteDatabase,
  session: Session,
  c: { id: string; system: string; data: any },
): Promise<{ ok: boolean }> {
  if (!session) return { ok: true }; // no-op is not a failure
  const result = await api.putCharacter(c.id, c.system, c.data);
  if (!result) { console.warn('[sync] push failed'); return { ok: false }; }
  await setCloudUpdatedAt(db, c.id, result.updated_at);
  return { ok: true };
}

/** Fetch ALL of the user's rows, including tombstones (needed to propagate deletes). */
export async function pullCharacters(session: Session): Promise<CloudCharacter[]> {
  if (!session) return [];
  return api.getCharacters() as Promise<CloudCharacter[]>;
}

/** Soft-delete a character in the cloud so the deletion propagates to other devices. */
export async function softDeleteCharacterCloud(session: Session, id: string): Promise<void> {
  if (!session) return;
  await api.deleteCharacterRequest(id);
}

/** Soft-delete every one of the signed-in user's characters — the reversible half
 *  of account deletion ("Remove cloud data"). */
export async function softDeleteAllCharacters(session: Session): Promise<{ ok: boolean }> {
  if (!session) return { ok: true }; // no-op is not a failure
  return api.clearCharactersRequest();
}
