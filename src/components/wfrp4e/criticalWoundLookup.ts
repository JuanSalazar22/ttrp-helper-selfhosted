import type { ContentRecord } from '@/data/wfrp-content';

/** Find the critical-wound record whose [rollMin, rollMax] range contains `n`,
 *  among the given (already location-filtered) rows. Null if none matches —
 *  e.g. n is out of 1-100 range, or the rows list is empty/wrong location. */
export function findCriticalWound(rows: ContentRecord[], n: number): ContentRecord | null {
  return rows.find(r => n >= (r.rollMin as number) && n <= (r.rollMax as number)) ?? null;
}
