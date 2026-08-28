import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as api from '@/lib/api';
import { createPasskey, getPasskey } from '@/auth/webauthn';

type Session = { user: api.ApiUser };

type AuthState = {
  session: Session | null;
  loading: boolean;
  displayName: string | null;
  registerPasskey: (name: string) => Promise<{ error: string | null }>;
  loginWithPasskey: () => Promise<{ error: string | null }>;
  startDeviceLink: () => Promise<{ code: string | null; error: string | null }>;
  linkDevice: (code: string, options: any) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | null>(null);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — the browser sends the HttpOnly cookie automatically;
  // we just ask the server who (if anyone) it belongs to. Native has no passkey UI
  // yet (web-only for this pass), so skip the network call entirely there rather
  // than hitting a relative URL that isn't valid for React Native's fetch.
  useEffect(() => {
    if (Platform.OS !== 'web') { setLoading(false); return; }
    api.getMe().then((user) => { setSession(user ? { user } : null); setLoading(false); });
  }, []);

  const registerPasskey = useCallback(async (name: string) => {
    try {
      const { cid, options } = await api.registerOptions(name);
      const credential = await createPasskey(options);
      const user = await api.registerVerify(cid, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const loginWithPasskey = useCallback(async () => {
    try {
      const { cid, options } = await api.loginOptions();
      const credential = await getPasskey(options);
      const user = await api.loginVerify(cid, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const startDeviceLink = useCallback(async () => {
    try {
      const { code } = await api.startDeviceLinkOptions();
      return { code, error: null };
    } catch (e) {
      return { code: null, error: errorMessage(e) };
    }
  }, []);

  // The receiving device only has a 6-digit code, no session — it fetches its
  // registration options via api.exchangeLinkCode(code) *before* calling this
  // (see AccountSheet.tsx), then completes the ceremony and verifies here.
  const linkDevice = useCallback(async (code: string, options: any) => {
    try {
      const credential = await createPasskey(options);
      const user = await api.verifyDeviceLink(code, credential);
      setSession({ user });
      return { error: null };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => { await api.logout(); setSession(null); }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const { error } = await api.updateMe(name.trim());
    if (!error) setSession((s) => (s ? { user: { ...s.user, name: name.trim() } } : s));
    return { error };
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!session) return { error: 'Not signed in' };
    const { error } = await api.deleteAccountRequest();
    if (!error) setSession(null);
    return { error };
  }, [session]);

  return (
    <AuthContext.Provider value={{
      session, loading,
      displayName: session?.user.name ?? null,
      registerPasskey, loginWithPasskey, startDeviceLink, linkDevice,
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
