import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';
import { authStorage } from '@/lib/secureStorage';

// Falls back to harmless placeholders when unconfigured so imports never throw;
// `supabaseConfig.enabled` gates all real use.
export const supabase = createClient(
  supabaseConfig.url ?? 'http://localhost',
  supabaseConfig.anonKey ?? 'anon-placeholder',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  }
);
