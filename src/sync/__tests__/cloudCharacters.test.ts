import { softDeleteAllCharacters } from '../cloudCharacters';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/lib/config', () => ({
  supabaseConfig: { enabled: true },
}));

import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';

describe('softDeleteAllCharacters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no-ops when sync is not configured', async () => {
    (supabaseConfig as any).enabled = false;
    await softDeleteAllCharacters({ user: { id: 'u1' } } as any);
    expect(supabase.from).not.toHaveBeenCalled();
    (supabaseConfig as any).enabled = true;
  });

  it('no-ops when there is no session', async () => {
    await softDeleteAllCharacters(null);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('updates deleted_at scoped to the current user when signed in', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    (supabase.from as jest.Mock).mockReturnValue({ update });

    const result = await softDeleteAllCharacters({ user: { id: 'u1' } } as any);

    expect(supabase.from).toHaveBeenCalledWith('characters');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(result).toEqual({ ok: true });
  });

  it('returns ok:false when the update fails', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = jest.fn().mockReturnValue({ eq });
    (supabase.from as jest.Mock).mockReturnValue({ update });

    const result = await softDeleteAllCharacters({ user: { id: 'u1' } } as any);

    expect(result).toEqual({ ok: false });
  });
});
