import { softDeleteAllCharacters, pushCharacter, pullCharacters, softDeleteCharacterCloud } from '../cloudCharacters';

jest.mock('@/lib/api', () => ({
  clearCharactersRequest: jest.fn(),
  putCharacter: jest.fn(),
  getCharacters: jest.fn(),
  deleteCharacterRequest: jest.fn(),
}));

import * as api from '@/lib/api';

describe('cloudCharacters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('softDeleteAllCharacters no-ops when there is no session', async () => {
    const result = await softDeleteAllCharacters(null);
    expect(api.clearCharactersRequest).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('softDeleteAllCharacters calls the clear endpoint when signed in', async () => {
    (api.clearCharactersRequest as jest.Mock).mockResolvedValue({ ok: true });
    const result = await softDeleteAllCharacters({ user: { id: 'u1', name: 'A' } } as any);
    expect(api.clearCharactersRequest).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('pushCharacter no-ops when there is no session', async () => {
    const dbStub = {} as any;
    const result = await pushCharacter(dbStub, null, { id: 'c1', system: 'dnd5e', data: {} });
    expect(api.putCharacter).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('pullCharacters returns [] when there is no session', async () => {
    const result = await pullCharacters(null);
    expect(api.getCharacters).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('softDeleteCharacterCloud no-ops when there is no session', async () => {
    await softDeleteCharacterCloud(null, 'c1');
    expect(api.deleteCharacterRequest).not.toHaveBeenCalled();
  });

  it('softDeleteCharacterCloud calls the delete endpoint when signed in', async () => {
    await softDeleteCharacterCloud({ user: { id: 'u1', name: 'A' } } as any, 'c1');
    expect(api.deleteCharacterRequest).toHaveBeenCalledWith('c1');
  });
});
