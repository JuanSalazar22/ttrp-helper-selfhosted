import { getMe } from '../api';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; jest.resetAllMocks(); });

describe('getMe', () => {
  it('returns the user when signed in', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ user: { id: 'u1', name: 'Alice' } }),
    }) as any;
    const result = await getMe();
    expect(result).toEqual({ id: 'u1', name: 'Alice' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('returns null when signed out (401)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as any;
    const result = await getMe();
    expect(result).toBeNull();
  });
});
