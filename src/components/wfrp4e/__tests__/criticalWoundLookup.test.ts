import { findCriticalWound } from '../criticalWoundLookup';
import type { ContentRecord } from '@/data/wfrp-content';

const HEAD_ROWS: ContentRecord[] = [
  { id: 'head_1', name: 'Dramatic Injury', location: 'head', rollMin: 1, rollMax: 10, wounds: 1, description: 'x' },
  { id: 'head_11', name: 'Minor Cut', location: 'head', rollMin: 11, rollMax: 20, wounds: 1, description: 'y' },
  { id: 'head_100', name: 'Decapitated', location: 'head', rollMin: 100, rollMax: 100, wounds: 'death', description: 'z' },
];

describe('findCriticalWound', () => {
  it('finds the row whose range contains the roll', () => {
    expect(findCriticalWound(HEAD_ROWS, 5)?.name).toBe('Dramatic Injury');
    expect(findCriticalWound(HEAD_ROWS, 10)?.name).toBe('Dramatic Injury');
    expect(findCriticalWound(HEAD_ROWS, 11)?.name).toBe('Minor Cut');
  });

  it('finds a "00" result stored as roll 100', () => {
    expect(findCriticalWound(HEAD_ROWS, 100)?.name).toBe('Decapitated');
  });

  it('returns null for a number with no matching row', () => {
    expect(findCriticalWound(HEAD_ROWS, 50)).toBeNull();
  });

  it('returns null for an out-of-range number', () => {
    expect(findCriticalWound(HEAD_ROWS, 0)).toBeNull();
    expect(findCriticalWound(HEAD_ROWS, 101)).toBeNull();
  });
});
