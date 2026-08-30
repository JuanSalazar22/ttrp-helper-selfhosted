import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as queries from '@/db/queries';
import { defaultDnd5eCharacter } from '@/types/dnd5e';
import { defaultWfrp4eCharacter } from '@/types/wfrp4e';
import type { CharacterRow, GameSystem } from '@/types';
import { pickAndParseCharacter } from '@/lib/transfer';
import { useAuth } from '@/auth/AuthProvider';
import { pullCharacters, softDeleteCharacterCloud, pullPortrait } from '@/sync/cloudCharacters';
import { reconcilePull, cloudRowToLocalParams, needsPortraitPull, type LocalRef } from '@/sync/reconcile';

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
      const localPortraitMap = new Map(refs.map(r => [r.id, r.portrait_updated_at]));
      const localMap = new Map<string, LocalRef>(
        refs.map(r => [r.id, { id: r.id, cloudUpdatedAt: r.cloud_updated_at }]),
      );
      const actions = reconcilePull(localMap, cloud);
      if (actions.length > 0) {
        for (const a of actions) {
          if (cancelled) return;
          if (a.kind === 'delete') {
            await queries.deleteCharacter(db, a.id);
          } else {
            const p = cloudRowToLocalParams(a.row);
            await queries.upsertLocalCharacter(db, { ...p, cloudUpdatedAt: a.row.updated_at });
          }
        }
      }
      // Independent of insert/update/delete: any cloud row with a newer portrait
      // than what this device has cached gets fetched and saved locally. This
      // runs for every non-deleted cloud row, not just ones reconcilePull acted
      // on, since a character's DATA can be unchanged while its portrait isn't.
      for (const c of cloud) {
        if (cancelled) return;
        if (c.deleted_at) continue;
        const localPortraitUpdatedAt = localPortraitMap.get(c.id) ?? null;
        if (needsPortraitPull(localPortraitUpdatedAt, c.portrait_updated_at)) {
          const base64 = await pullPortrait(session, c.id);
          if (!base64 || cancelled) continue;
          // The fetched base64 IS the image — no file write/copy needed, portraits
          // are stored as data: URIs directly (see portraitStorage.ts for why).
          await queries.updatePortrait(db, c.id, `data:image/jpeg;base64,${base64}`, c.portrait_updated_at);
        } else if (localPortraitUpdatedAt && !c.portrait_updated_at) {
          // The other direction needsPortraitPull deliberately never reports:
          // cloud has no portrait but this device still has one cached, meaning
          // it was removed elsewhere — clear it here too instead of leaving a
          // stale photo showing indefinitely.
          await queries.updatePortrait(db, c.id, null, null);
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
