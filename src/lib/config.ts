const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase connection config. `enabled` is false when keys are absent, so the app
 *  degrades to fully-local (the Account UI hides) instead of crashing. */
export const supabaseConfig = {
  url,
  anonKey,
  enabled: Boolean(url && anonKey),
};
