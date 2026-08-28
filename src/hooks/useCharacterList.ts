import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as queries from '@/db/queries';
import { defaultDnd5eCharacter } from '@/types/dnd5e';
import { defaultWfrp4eCharacter } from '@/types/wfrp4e';
import type { CharacterRow, GameSystem } from '@/types';
import { pickAndParseCharacter } from '@/lib/transfer';
import { useAuth } from '@/auth/AuthProvider';
import { pullCharacters, softDeleteCharacterCloud } from '@/sync/cloudCharacters';
import { reconcilePull, cloudRowToLocalParams, type LocalRef } from '@/sync/reconcile';

export function useCharacterList() {
  const db = useSQLiteContext();
  const { session } = useAuth();
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await queries.getAllCharacters(db);
    setCharacters(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => { refresh(); }, [refresh]);

  // On sign-in / list mount while signed in: pull the user's cloud rows and apply
  // inserts, updates (cloud newer than last sync), and tombstone deletes; then refresh.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const cloud = await pullCharacters(session);
      const refs = await queries.getCharacterSyncRefs(db);
      const localMap = new Map<string, LocalRef>(
        refs.map(r => [r.id, { id: r.id, cloudUpdatedAt: r.cloud_updated_at }]),
      );
      const actions = reconcilePull(localMap, cloud);
      if (actions.length === 0) return;
      for (const a of actions) {
        if (cancelled) return;
        if (a.kind === 'delete') {
          await queries.deleteCharacter(db, a.id);
        } else {
          const p = cloudRowToLocalParams(a.row);
          await queries.upsertLocalCharacter(db, { ...p, cloudUpdatedAt: a.row.updated_at });
        }
      }
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [session, db, refresh]);

  const create = useCallback(async (system: GameSystem, name: string): Promise<string> => {
    const data = system === 'dnd5e'
      ? defaultDnd5eCharacter(name)
      : defaultWfrp4eCharacter(name);
    const id = await queries.createCharacter(db, system, name, data);
    await refresh();
    return id;
  }, [db, refresh]);

  const remove = useCallback(async (id: string) => {
    await queries.deleteCharacter(db, id);
    void softDeleteCharacterCloud(session, id);
    await refresh();
  }, [db, refresh, session]);

  const duplicate = useCallback(async (id: string): Promise<string> => {
    const newId = await queries.duplicateCharacter(db, id);
    await refresh();
    return newId;
  }, [db, refresh]);

  const importCharacter = useCallback(async (): Promise<string | null> => {
    const picked = await pickAndParseCharacter();
    if (!picked) return null;
    const id = await queries.createCharacter(db, picked.system, picked.data.name, picked.data);
    await refresh();
    return id;
  }, [db, refresh]);

  return { characters, loading, refresh, create, remove, duplicate, importCharacter };
}
