import type { CharacterRow } from '@/types';

export function extractTags(row: CharacterRow): string[] {
  try {
    const data = JSON.parse(row.data);
    const tags = data?.tags;
    if (!Array.isArray(tags)) return [];
    return tags.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0);
  } catch {
    return [];
  }
}

export function matchesQuery(row: CharacterRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (row.name.toLowerCase().includes(q)) return true;
  return extractTags(row).some(t => t.toLowerCase().includes(q));
}
