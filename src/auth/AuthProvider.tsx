import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';

type AuthState = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  displayName: string | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore + subscribe to session changes.
  useEffect(() => {
    if (!supabaseConfig.enabled) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Native: turn the magic-link redirect (?code=…) into a session. Web is handled by
  // detectSessionInUrl in the client config.
  useEffect(() => {
    if (!supabaseConfig.enabled || Platform.OS === 'web') return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const code = Linking.parse(url).queryParams?.code;
      if (typeof code === 'string') await supabase.auth.exchangeCodeForSession(code);
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabaseConfig.enabled) return { error: 'Sync is not configured' };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabaseConfig.enabled) return { error: 'Sync is not configured', needsConfirmation: false };
    const emailRedirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });
    // session is null when email-confirmation is required by the project.
    return { error: error?.message ?? null, needsConfirmation: !!data && data.session == null };
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabaseConfig.enabled) return { error: 'Sync is not configured' };
    const redirectTo = Linking.createURL('auth/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!supabaseConfig.enabled) return { error: 'Sync is not configured' };
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    return { error: error?.message ?? null };
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabaseConfig.enabled || !session) return { error: 'Not signed in' };
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    return { error: null };
  }, [session]);

  const displayName: string | null =
    (session?.user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <AuthContext.Provider value={{
      session, loading, configured: supabaseConfig.enabled,
      displayName,
      signInWithPassword, signUp, sendPasswordReset,
      signOut, updateDisplayName, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
