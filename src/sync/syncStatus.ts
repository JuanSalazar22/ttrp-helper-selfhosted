/** UI-facing sync state. */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

/** Derive the current status. Precedence: offline > syncing > error > idle. */
export function nextStatus({
  online,
  inFlight,
  queueSize,
}: {
  online: boolean;
  inFlight: number;
  queueSize: number;
}): SyncStatus {
  if (!online) return 'offline';
  if (inFlight > 0) return 'syncing';
  if (queueSize > 0) return 'error';
  return 'idle';
}
