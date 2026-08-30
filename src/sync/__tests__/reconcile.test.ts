import { cloudRowToLocalParams, needsPortraitPull, reconcilePull, type CloudCharacter, type LocalRef } from '../reconcile';

const row = (id: string, over: Partial<CloudCharacter> = {}): CloudCharacter => ({
  id, system: 'wfrp4e', data: { name: 'Grim', system: 'wfrp4e' },
  updated_at: '2026-06-29T20:00:00.000Z', deleted_at: null, portrait_updated_at: null, ...over,
});

describe('cloudRowToLocalParams', () => {
  it('maps a cloud row to local insert params', () => {
    const p = cloudRowToLocalParams(row('a', { updated_at: '2026-06-29T20:00:00.000Z' }));
    expect(p).toEqual({
      id: 'a', system: 'wfrp4e', name: 'Grim',
      dataJson: JSON.stringify({ name: 'Grim', system: 'wfrp4e' }),
      updatedAtMs: Date.parse('2026-06-29T20:00:00.000Z'),
    });
  });
  it('falls back to empty name and now() when data/timestamp are odd', () => {
    const p = cloudRowToLocalParams(row('a', { data: {}, updated_at: 'not-a-date' }));
    expect(p.name).toBe('');
    expect(typeof p.updatedAtMs).toBe('number');
    expect(Number.isNaN(p.updatedAtMs)).toBe(false);
  });
});

const cloudRow = (id: string, over: Partial<CloudCharacter> = {}): CloudCharacter => ({
  id, system: 'wfrp4e', data: { name: 'Grim', system: 'wfrp4e' },
  updated_at: 't1', deleted_at: null, portrait_updated_at: null, ...over,
});
const localMap = (entries: Array<[string, string | null]>) =>
  new Map<string, LocalRef>(entries.map(([id, cloudUpdatedAt]) => [id, { id, cloudUpdatedAt }]));

describe('reconcilePull', () => {
  it('inserts a cloud row missing locally', () => {
    const a = reconcilePull(localMap([]), [cloudRow('a')]);
    expect(a).toEqual([{ kind: 'insert', row: cloudRow('a') }]);
  });
  it('updates when cloud updated_at differs from the last-synced value', () => {
    const a = reconcilePull(localMap([['a', 't0']]), [cloudRow('a', { updated_at: 't1' })]);
    expect(a).toEqual([{ kind: 'update', row: cloudRow('a', { updated_at: 't1' }) }]);
  });
  it('skips when cloud is unchanged since last sync', () => {
    expect(reconcilePull(localMap([['a', 't1']]), [cloudRow('a', { updated_at: 't1' })])).toEqual([]);
  });
  it('deletes locally when the cloud row is tombstoned', () => {
    const a = reconcilePull(localMap([['a', 't1']]), [cloudRow('a', { deleted_at: 't2' })]);
    expect(a).toEqual([{ kind: 'delete', id: 'a' }]);
  });
  it('ignores a tombstoned row that is not present locally', () => {
    expect(reconcilePull(localMap([]), [cloudRow('a', { deleted_at: 't2' })])).toEqual([]);
  });
});

describe('needsPortraitPull', () => {
  it('is false when neither side has a portrait', () => {
    expect(needsPortraitPull(null, null)).toBe(false);
  });

  it('is true when the cloud has a portrait and the local side has none', () => {
    expect(needsPortraitPull(null, '2026-08-29T00:00:00.000Z')).toBe(true);
  });

  it('is true when the cloud portrait is newer than the local one', () => {
    expect(needsPortraitPull('2026-08-28T00:00:00.000Z', '2026-08-29T00:00:00.000Z')).toBe(true);
  });

  it('is false when local is already up to date with cloud', () => {
    expect(needsPortraitPull('2026-08-29T00:00:00.000Z', '2026-08-29T00:00:00.000Z')).toBe(false);
  });

  it('is false when the cloud has no portrait (removed) even if local still has one — removal is handled separately, this only decides whether to FETCH', () => {
    expect(needsPortraitPull('2026-08-29T00:00:00.000Z', null)).toBe(false);
  });
});
