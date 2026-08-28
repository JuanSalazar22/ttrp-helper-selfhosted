import { extractTags, matchesQuery } from '../characterSearch';
import type { CharacterRow } from '@/types';

function row(overrides: Partial<CharacterRow> & { tags?: unknown; name?: string }): CharacterRow {
  const data = JSON.stringify({ tags: overrides.tags });
  return {
    id: 'id',
    system: 'wfrp4e',
    name: overrides.name ?? 'Test',
    portrait_uri: null,
    data,
    schema_ver: 7,
    created_at: 0,
    updated_at: 0,
  } as CharacterRow;
}

describe('extractTags', () => {
  test('returns tag list from parsed JSON', () => {
    expect(extractTags(row({ tags: ['a', 'b'] }))).toEqual(['a', 'b']);
  });

  test('filters out non-strings and blanks', () => {
    expect(extractTags(row({ tags: ['a', '', 42, null, 'b'] as unknown[] }))).toEqual(['a', 'b']);
  });

  test('returns [] when tags absent or JSON malformed', () => {
    expect(extractTags(row({}))).toEqual([]);
    const bad = { ...row({}), data: '{bad json' };
    expect(extractTags(bad)).toEqual([]);
  });
});

describe('matchesQuery', () => {
  const r = row({ name: 'Gunther Faust', tags: ['party-a', 'noble'] });

  test('empty query matches everything', () => {
    expect(matchesQuery(r, '')).toBe(true);
    expect(matchesQuery(r, '   ')).toBe(true);
  });

  test('matches partial name (case-insensitive)', () => {
    expect(matchesQuery(r, 'gun')).toBe(true);
    expect(matchesQuery(r, 'FAUST')).toBe(true);
  });

  test('matches partial tag (case-insensitive)', () => {
    expect(matchesQuery(r, 'party')).toBe(true);
    expect(matchesQuery(r, 'NOBLE')).toBe(true);
  });

  test('returns false when no field matches', () => {
    expect(matchesQuery(r, 'zzz')).toBe(false);
  });
});
