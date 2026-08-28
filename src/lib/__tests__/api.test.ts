import { getMe } from '../api';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.resetAllMocks(); });

describe('getMe', () => {
  it('returns the user when signed in', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ user: { id: 'u1', name: 'Alice' } }),
    }) as any;
    const result = await getMe();
    expect(result).toEqual({ id: 'u1', name: 'Alice' });
    expect(global.fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('returns null when signed out (401)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as any;
    const result = await getMe();
    expect(result).toBeNull();
  });
});
