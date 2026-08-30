/** A character row as returned from the cloud backend's characters endpoint. */
export type CloudCharacter = {
  id: string;
  system: string;
  data: any; // jsonb → JS object (the per-character JSON)
  updated_at: string; // ISO timestamp
  deleted_at: string | null;
  portrait_updated_at: string | null;
};

/** A local row's identity + the cloud updated_at we last synced for it. */
export type LocalRef = { id: string; cloudUpdatedAt: string | null };

/** What a pull should do for a cloud row, after comparing against local state. */
export type PullAction =
  | { kind: 'insert'; row: CloudCharacter }
  | { kind: 'update'; row: CloudCharacter }
  | { kind: 'delete'; id: string };

/** Decide per cloud row: tombstoned → delete local (if present); missing local → insert;
 *  cloud changed since last sync (updated_at != stored cloudUpdatedAt) → update; else skip.
 *  Compares server-time to stored-server-time, so device clock skew can't misorder. */
export function reconcilePull(local: Map<string, LocalRef>, cloud: CloudCharacter[]): PullAction[] {
  const actions: PullAction[] = [];
  for (const c of cloud) {
    const l = local.get(c.id);
    if (c.deleted_at != null) {
      if (l) actions.push({ kind: 'delete', id: c.id });
      continue;
    }
    if (!l) { actions.push({ kind: 'insert', row: c }); continue; }
    if (c.updated_at !== l.cloudUpdatedAt) actions.push({ kind: 'update', row: c });
  }
  return actions;
}

/** Map a cloud row to the params used to insert it into local SQLite. */
export function cloudRowToLocalParams(c: CloudCharacter) {
  const name = (c.data && typeof c.data === 'object' && typeof c.data.name === 'string') ? c.data.name : '';
  const parsedMs = Date.parse(c.updated_at);
  return {
    id: c.id,
    system: c.system,
    name,
    dataJson: JSON.stringify(c.data ?? {}),
    updatedAtMs: Number.isNaN(parsedMs) ? Date.now() : parsedMs,
  };
}

/** Whether a device needs to fetch the cloud's portrait: cloud has one and it's
 *  either missing locally or newer than what's locally recorded. Removal (cloud
 *  went from having one to not) is a separate concern handled where this is
 *  called — this only ever says "go fetch," never "go delete." */
export function needsPortraitPull(localPortraitUpdatedAt: string | null, cloudPortraitUpdatedAt: string | null): boolean {
  if (!cloudPortraitUpdatedAt) return false;
  if (!localPortraitUpdatedAt) return true;
  return cloudPortraitUpdatedAt !== localPortraitUpdatedAt;
}
