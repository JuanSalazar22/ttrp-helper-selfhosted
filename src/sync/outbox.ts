/** Failed-push queue: character ids whose cloud push failed and must be retried.
 *  Module-scoped + in-memory — survives across saves within a session, cleared on
 *  drain. Deliberately not persisted: on next sign-in/pull the cloud reconciles. */
const pending = new Set<string>();

export function enqueue(id: string): void {
  pending.add(id);
}

export function size(): number {
  return pending.size;
}

/** Return all queued ids and clear the queue. */
export function dequeueAll(): string[] {
  const ids = [...pending];
  pending.clear();
  return ids;
}
