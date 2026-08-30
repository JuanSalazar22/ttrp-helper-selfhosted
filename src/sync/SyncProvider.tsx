import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { getCharacter, updatePortrait } from '@/db/queries';
import { useAuth } from '@/auth/AuthProvider';
import { pushCharacter, pushPortrait } from '@/sync/cloudCharacters';
import { readLocalPortraitBase64 } from '@/lib/portraitStorage';
import { enqueue, size as outboxSize, dequeueAll } from '@/sync/outbox';
import { nextStatus, type SyncStatus } from '@/sync/syncStatus';

type SyncState = {
  status: SyncStatus;
  /** Push one character to the cloud, tracking status and queueing on failure. */
  pushNow: (c: { id: string; system: string; data: any }) => Promise<void>;
  /** Re-attempt every queued (failed) push. */
  retry: () => void;
};

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { session } = useAuth();
  const onlineRef = useRef(true);
  const inFlight = useRef(0);
  const [status, setStatus] = useState<SyncStatus>('idle');

  const recompute = useCallback(() => {
    setStatus(nextStatus({ online: onlineRef.current, inFlight: inFlight.current, queueSize: outboxSize() }));
  }, []);

  const pushNow = useCallback(async (c: { id: string; system: string; data: any }) => {
    if (!session) return; // signed out: cloud push is a no-op, keep status idle
    inFlight.current++; recompute();
    const { ok } = await pushCharacter(db, session, c);
    inFlight.current--;
    if (!ok) enqueue(c.id);
    recompute();
  }, [db, session, recompute]);

  const drain = useCallback(async () => {
    if (!session) return;
    for (const id of dequeueAll()) {
      const row = await getCharacter(db, id);
      if (!row) continue;
      inFlight.current++; recompute();
      const { ok } = await pushCharacter(db, session, { id, system: row.system, data: JSON.parse(row.data) });
      inFlight.current--;
      if (!ok) enqueue(id);

      // A queued id might also have a portrait that failed to push (setPortrait
      // enqueues the same id on portrait failure as on data failure) — retry it
      // too. Re-uploading an already-synced portrait is harmless, so this runs
      // unconditionally rather than tracking exactly which failure queued the id.
      if (row.portrait_uri) {
        const base64 = await readLocalPortraitBase64(id);
        if (base64) {
          const portraitResult = await pushPortrait(session, id, base64);
          if (portraitResult.ok && portraitResult.portraitUpdatedAt) {
            await updatePortrait(db, id, row.portrait_uri, portraitResult.portraitUpdatedAt);
          } else if (!portraitResult.ok) {
            enqueue(id);
          }
        }
      }
      recompute();
    }
  }, [db, session, recompute]);

  // Drain any queued pushes when a session appears (sign-in / restore).
  useEffect(() => { if (session) void drain(); }, [session, drain]);

  // Web: track connectivity and drain on reconnect. Native assumes online
  // (avoids a NetInfo dependency); failed pushes still retry on next save/sign-in.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    onlineRef.current = navigator.onLine;
    recompute();
    const update = () => { onlineRef.current = navigator.onLine; recompute(); if (navigator.onLine) void drain(); };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [recompute, drain]);

  return (
    <SyncContext.Provider value={{ status, pushNow, retry: () => { void drain(); } }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
