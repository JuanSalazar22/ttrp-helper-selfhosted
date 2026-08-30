import { useState, useEffect, useRef, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getCharacter, updateCharacter, updatePortrait } from '@/db/queries';
import type { CharacterRow } from '@/types';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { migrateWfrp4eCharacter } from '@/types/wfrp4e';
import { useSync } from '@/sync/SyncProvider';
import { useAuth } from '@/auth/AuthProvider';
import { saveLocalPortrait, deleteLocalPortrait, readLocalPortraitBase64 } from '@/lib/portraitStorage';
import { pushPortrait, deletePortraitCloud } from '@/sync/cloudCharacters';
import { enqueue } from '@/sync/outbox';

export type EditableCharacter = Dnd5eCharacter | Wfrp4eCharacter;

export function useCharacter(id: string) {
  const db = useSQLiteContext();
  const { pushNow } = useSync();
  const { session } = useAuth();
  const [row, setRow] = useState<CharacterRow | null>(null);
  const [data, setData] = useState<EditableCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const latestData = useRef<EditableCharacter | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save locally, then mirror to the cloud (fire-and-forget; never blocks the save).
  const saveAndPush = useCallback(async (next: EditableCharacter) => {
    await updateCharacter(db, id, next);
    void pushNow({ id, system: next.system, data: next });
  }, [db, id, pushNow]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCharacter(db, id).then(r => {
      if (cancelled) return;
      setRow(r);
      let parsed = r ? (JSON.parse(r.data) as EditableCharacter) : null;
      if (parsed && parsed.system === 'wfrp4e') {
        parsed = migrateWfrp4eCharacter(parsed);
      }
      setData(parsed);
      latestData.current = parsed;
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (latestData.current) {
      setSaving(true);
      await saveAndPush(latestData.current);
      setSaving(false);
    }
  }, [saveAndPush]);

  const patch = useCallback((updates: Partial<EditableCharacter>) => {
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates } as EditableCharacter;
      latestData.current = next;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        await saveAndPush(next);
        setSaving(false);
      }, 800);

      return next;
    });
  }, [saveAndPush]);

  // Flush on unmount
  useEffect(() => () => { flush(); }, [flush]);

  /** Save a newly-cropped portrait: always locally (works with no account), and
   *  to the cloud when signed in — enqueuing a retry via the existing outbox on
   *  upload failure, same as a failed character-data push. Pass `croppedUri`
   *  null to remove the portrait instead. */
  const setPortrait = useCallback(async (croppedUri: string | null) => {
    if (croppedUri === null) {
      await deleteLocalPortrait(id);
      await updatePortrait(db, id, null, null);
      setRow(prev => prev ? { ...prev, portrait_uri: null, portrait_updated_at: null } : prev);
      void deletePortraitCloud(session, id);
      return;
    }
    const localUri = await saveLocalPortrait(id, croppedUri);
    await updatePortrait(db, id, localUri, null);
    setRow(prev => prev ? { ...prev, portrait_uri: localUri, portrait_updated_at: null } : prev);
    const base64 = readLocalPortraitBase64(localUri);
    if (!base64) return;
    const { ok, portraitUpdatedAt } = await pushPortrait(session, id, base64);
    if (!ok) { enqueue(id); return; }
    if (portraitUpdatedAt) {
      await updatePortrait(db, id, localUri, portraitUpdatedAt);
      setRow(prev => prev ? { ...prev, portrait_updated_at: portraitUpdatedAt } : prev);
    }
  }, [db, id, session]);

  return { row, data, loading, saving, patch, flush, setPortrait };
}
