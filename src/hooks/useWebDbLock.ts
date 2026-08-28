import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// wa-sqlite's OPFS VFS grabs an exclusive SyncAccessHandle per file — only one
// browser tab can hold it at a time. This hook uses the Web Locks API to gate
// which tab is allowed to open the database, so a second tab waits instead of
// crashing when the VFS tries to acquire an already-held handle.
const LOCK_NAME = 'ttrphelper-db-writer';
const BLOCKED_GRACE_MS = 300;

export type WebDbLockStatus = 'checking' | 'granted' | 'blocked';

export function useWebDbLock(): WebDbLockStatus {
  const [status, setStatus] = useState<WebDbLockStatus>(
    Platform.OS === 'web' ? 'checking' : 'granted'
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !navigator.locks) {
      setStatus('granted'); // Locks API unsupported — fail open, same as before this change.
      return;
    }

    let cancelled = false;
    const graceTimer = setTimeout(() => {
      if (!cancelled) setStatus('blocked');
    }, BLOCKED_GRACE_MS);

    navigator.locks
      .request(LOCK_NAME, { mode: 'exclusive' }, () => {
        clearTimeout(graceTimer);
        if (!cancelled) setStatus('granted');
        // Held until the tab closes/navigates away — the browser releases it then.
        return new Promise<void>(() => {});
      })
      .catch(() => {
        if (!cancelled) setStatus('granted'); // Fail open on unexpected Locks API errors.
      });

    return () => {
      cancelled = true;
      clearTimeout(graceTimer);
    };
  }, []);

  return status;
}
