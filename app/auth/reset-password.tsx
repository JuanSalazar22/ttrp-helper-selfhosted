import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { isValidPassword } from '@/auth/password';

/** Landing route for the Supabase password-reset email link. The web client
 *  exchanges the recovery token automatically (detectSessionInUrl: true); native
 *  goes through the existing AuthProvider deep-link handler. Either way the user
 *  arrives here with a session and we ask for a new password. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const params = useLocalSearchParams<{ error?: string }>();
  const { session, loading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const linkError = typeof params.error === 'string' ? params.error : null;

  async function onSubmit() {
    if (!isValidPassword(password)) { setError(tr('settings.account.passwordTooShort')); return; }
    if (password !== confirm) { setError(tr('settings.account.passwordMismatch')); return; }
    setSubmitting(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (e) { setError(e.message); return; }
    setDone(true);
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator color={t.colors.accent} />
      </View>
    );
  }

  // Link invalid (carried as ?error=…) or no session present after load — Supabase
  // didn't establish a recovery session.
  if (linkError || !session) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <Text style={[styles.title, { color: t.colors.text }]}>
          {tr('settings.account.linkExpiredReset')}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')}>
          <Text style={[styles.link, { color: t.colors.accent }]}>
            {tr('settings.account.backToSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <Text style={[styles.title, { color: t.colors.text }]}>{tr('settings.account.passwordUpdated')}</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/')}>
          <Text style={[styles.link, { color: t.colors.accent }]}>
            {tr('settings.account.backToSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      <Text style={[styles.title, { color: t.colors.text }]}>{tr('settings.account.newPassword')}</Text>
      <TextInput
        style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
        value={password}
        onChangeText={(v) => { setPassword(v); if (error) setError(null); }}
        placeholder={tr('settings.account.passwordPlaceholder')}
        placeholderTextColor={t.colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoFocus
      />
      <TextInput
        style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
        value={confirm}
        onChangeText={(v) => { setConfirm(v); if (error) setError(null); }}
        placeholder={tr('settings.account.confirmPassword')}
        placeholderTextColor={t.colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
      />
      {error && <Text style={[styles.errorText, { color: t.colors.danger }]}>{error}</Text>}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: t.colors.accent, opacity: submitting ? 0.6 : 1 }]}
        onPress={onSubmit}
        disabled={submitting}
      >
        <Text style={[styles.btnText, { color: t.colors.accentText }]}>
          {submitting ? tr('settings.account.signingIn') : tr('settings.account.updatePassword')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnText: { fontSize: 15, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  errorText: { fontSize: 12 },
});
