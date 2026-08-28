import { applyOverlay } from '../queries';
import type { ContentRecord } from '../queries';

const base = { id: '1', name: 'Merchant', description: 'Buy low, sell high.' } as unknown as ContentRecord;

describe('applyOverlay', () => {
  test('returns the base unchanged when there is no overlay', () => {
    expect(applyOverlay(base, null)).toEqual(base);
  });

  test('overlays translated display fields onto the base', () => {
    const result = applyOverlay(base, { name: 'Mercader', description: 'Compra barato, vende caro.' });
    expect(result.name).toBe('Mercader');
    expect((result as any).description).toBe('Compra barato, vende caro.');
    expect(result.id).toBe('1');
  });

  test('keeps base fields that the overlay does not specify', () => {
    const result = applyOverlay(base, { name: 'Mercader' });
    expect(result.name).toBe('Mercader');
    expect((result as any).description).toBe('Buy low, sell high.');
  });
});
