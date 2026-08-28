import { submitBugReport } from '../bugReports';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/lib/config', () => ({
  supabaseConfig: { enabled: true },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';

const validInput = {
  category: 'bug' as const,
  message: 'Something is broken',
  contactEmail: null,
  system: null,
  locale: 'en',
};

describe('submitBugReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fails when sync is not configured', async () => {
    (supabaseConfig as any).enabled = false;
    const result = await submitBugReport(validInput);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false });
    (supabaseConfig as any).enabled = true;
  });

  it('inserts into bug_reports and returns ok on success', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const result = await submitBugReport(validInput);

    expect(supabase.from).toHaveBeenCalledWith('bug_reports');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'bug',
        message: 'Something is broken',
        app_version: '1.0.0',
        locale: 'en',
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('never sends user_id — the database default and RLS policy own that column', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await submitBugReport(validInput);

    expect(insert.mock.calls[0][0]).not.toHaveProperty('user_id');
  });

  it('trims the message and normalizes an empty contact email to null', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await submitBugReport({ ...validInput, message: '  padded  ', contactEmail: '   ' });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'padded', contact_email: null }),
    );
  });

  it('returns ok:false when the insert fails', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const result = await submitBugReport(validInput);

    expect(result).toEqual({ ok: false });
  });
});
