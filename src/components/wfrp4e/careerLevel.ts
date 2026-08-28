/** Index of the career level whose title matches the search query (case-insensitive
 *  substring) — used so searching a rank title (e.g. "Doktor") starts the character at
 *  that level. Falls back to 0 (level 1) when the query is empty or nothing matches. */
export function matchedLevelIndex(levels: Array<{ name?: string }>, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const i = levels.findIndex((l) => l.name?.toLowerCase().includes(q));
  return i >= 0 ? i : 0;
}
