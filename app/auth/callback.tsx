import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { session, loading } = useAuth();
  const t = useTheme();
  const tr = useTranslation();

  const authError = typeof params.error === 'string' ? params.error : null;

  useEffect(() => {
    if (authError) return;
    if (!loading && session) {
      router.replace('/(tabs)/settings');
    }
  }, [authError, loading, session, router]);

  if (authError) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <Text style={[styles.text, { color: t.colors.text }]}>
          {tr('settings.account.linkExpired')}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')}>
          <Text style={{ color: t.colors.accent, fontWeight: '600', marginTop: 16 }}>
            {tr('settings.account.backToSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      <ActivityIndicator color={t.colors.accent} />
      <Text style={{ color: t.colors.textSecondary, marginTop: 12 }}>
        {tr('settings.account.signingIn')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 16, textAlign: 'center' },
});
