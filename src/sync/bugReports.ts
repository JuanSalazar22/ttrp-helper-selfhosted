import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';
import type { GameSystem } from '@/types';

export type ReportCategory = 'bug' | 'content' | 'suggestion';

export type BugReportInput = {
  category: ReportCategory;
  message: string;
  contactEmail: string | null;
  system: GameSystem | null;
  locale: string;
};

/** Submit a beta tester's bug report. Never throws.
 *
 *  Unlike the cloud-sync helpers, an unconfigured Supabase is reported as a failure
 *  rather than a silent no-op: the user pressed Send and their report went nowhere,
 *  which they need to know. (The Report tab is hidden when unconfigured, so this is
 *  a defensive guard rather than a path users normally reach.)
 *
 *  `user_id` is deliberately absent from the payload — the column's `default auth.uid()`
 *  supplies it server-side, and the RLS policy rejects any client-supplied value that
 *  isn't the caller's own id. */
export async function submitBugReport(input: BugReportInput): Promise<{ ok: boolean }> {
  if (!supabaseConfig.enabled) return { ok: false };

  const { error } = await supabase.from('bug_reports').insert({
    category: input.category,
    message: input.message.trim(),
    contact_email: input.contactEmail?.trim() || null,
    system: input.system,
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    locale: input.locale,
  });

  if (error) {
    console.warn('[report] submit failed:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
