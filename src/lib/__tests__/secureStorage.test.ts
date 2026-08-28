import { makeSecureStoreAdapter } from '../secureStorage';

// In-memory mock of expo-secure-store
// Variable must be prefixed with "mock" to be accessible inside jest.mock() factory
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => Promise.resolve(mockStore.has(k) ? mockStore.get(k)! : null),
  setItemAsync: (k: string, v: string) => { mockStore.set(k, v); return Promise.resolve(); },
  deleteItemAsync: (k: string) => { mockStore.delete(k); return Promise.resolve(); },
}));

beforeEach(() => mockStore.clear());

describe('secure store adapter', () => {
  const a = makeSecureStoreAdapter();

  it('round-trips a small value', async () => {
    await a.setItem('k', 'hello');
    expect(await a.getItem('k')).toBe('hello');
  });

  it('round-trips a value larger than one chunk', async () => {
    const big = 'x'.repeat(5000);
    await a.setItem('sess', big);
    expect(await a.getItem('sess')).toBe(big);
    expect(mockStore.size).toBeGreaterThan(1); // stored as multiple chunks
  });

  it('removeItem clears all chunks', async () => {
    await a.setItem('sess', 'y'.repeat(5000));
    await a.removeItem('sess');
    expect(await a.getItem('sess')).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('overwriting a multi-chunk value with a short one leaves no orphan chunks', async () => {
    await a.setItem('sess', 'x'.repeat(5000)); // multiple chunks
    await a.setItem('sess', 'short');
    expect(await a.getItem('sess')).toBe('short');
    expect(mockStore.size).toBe(1); // only the head/scalar key remains
  });

  it('shrinking a 5-chunk value to 2 chunks leaves exactly head + .0 + .1', async () => {
    await a.setItem('sess', 'x'.repeat(1800 * 5)); // 5 chunks
    await a.setItem('sess', 'y'.repeat(1800 * 2)); // 2 chunks
    expect(await a.getItem('sess')).toBe('y'.repeat(1800 * 2));
    expect([...mockStore.keys()].sort()).toEqual(['sess', 'sess.0', 'sess.1']);
  });
});
