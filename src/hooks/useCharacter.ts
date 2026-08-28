import { useState, useEffect, useRef, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getCharacter, updateCharacter } from '@/db/queries';
import type { CharacterRow } from '@/types';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { migrateWfrp4eCharacter } from '@/types/wfrp4e';
import { useSync } from '@/sync/SyncProvider';

export type EditableCharacter = Dnd5eCharacter | Wfrp4eCharacter;

export function useCharacter(id: string) {
  const db = useSQLiteContext();
  const { pushNow } = useSync();
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

  return { row, data, loading, saving, patch, flush };
}
