import { Platform, View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useTheme, useThemeMode, type ThemeMode } from '@/hooks/useTheme';
import { setHapticsEnabled } from '@/lib/haptics';
import { setSoundEnabled } from '@/lib/sound';
import { useTranslation, useLocale, type Locale, type TKey } from '@/i18n';
import { textStyle } from '@/tokens/typography';
import { useAuth } from '@/auth/AuthProvider';
import { AccountSheet } from '@/components/ui/AccountSheet';

let useDb: (() => SQLiteDatabase) | null = null;
if (Platform.OS !== 'web') {
  useDb = require('expo-sqlite').useSQLiteContext;
}
let getSettingFn: ((db: SQLiteDatabase, k: string) => Promise<string | null>) | null = null;
let setSettingFn: ((db: SQLiteDatabase, k: string, v: string) => Promise<void>) | null = null;
if (Platform.OS !== 'web') {
  getSettingFn = require('@/db/queries').getSetting;
  setSettingFn = require('@/db/queries').setSetting;
}

const MODES: { id: ThemeMode; labelKey: TKey }[] = [
  { id: 'system', labelKey: 'settings.system' },
  { id: 'light', labelKey: 'settings.light' },
  { id: 'dark', labelKey: 'settings.dark' },
];

const LANGS: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const { mode, setMode } = useThemeMode();
  const { locale, setLocale } = useLocale();
  const db = useDb ? useDb() : null;
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    if (db && getSettingFn) getSettingFn(db, 'haptics_enabled').then(h => setHaptics(h !== 'false'));
  }, [db]);

  useEffect(() => {
    if (db && getSettingFn) getSettingFn(db, 'sound_enabled').then(s => setSound(s !== 'false'));
  }, [db]);

  function toggleHaptics(v: boolean) {
    setHaptics(v);
    setHapticsEnabled(v);
    if (db && setSettingFn) setSettingFn(db, 'haptics_enabled', v ? 'true' : 'false');
  }

  function toggleSound(v: boolean) {
    setSound(v);
    setSoundEnabled(v);
    if (db && setSettingFn) setSettingFn(db, 'sound_enabled', v ? 'true' : 'false');
  }

  const { session, loading, configured } = useAuth();
  const [showAccount, setShowAccount] = useState(false);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('settings.title')}</Text>

      <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.appearance')}</Text>
      <View style={styles.segment}>
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <TouchableOpacity key={m.id}
              style={[styles.segBtn, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
              onPress={() => setMode(m.id)} activeOpacity={0.7}>
              <Text style={[styles.segText, { color: active ? t.colors.accent : t.colors.text }]}>{tr(m.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.language')}</Text>
      <View style={styles.segment}>
        {LANGS.map(l => {
          const active = locale === l.id;
          return (
            <TouchableOpacity key={l.id}
              style={[styles.segBtn, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
              onPress={() => setLocale(l.id)} activeOpacity={0.7}>
              <Text style={[styles.segText, { color: active ? t.colors.accent : t.colors.text }]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.feedback')}</Text>
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>{tr('settings.haptics')}</Text>
        <Switch value={haptics} onValueChange={toggleHaptics} />
      </View>
      <View style={[styles.row, { borderColor: t.colors.border, marginTop: 8 }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>{tr('settings.sound')}</Text>
        <Switch value={sound} onValueChange={toggleSound} />
      </View>

      {configured && (
        <>
          <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.account.title')}</Text>
          <TouchableOpacity
            style={[styles.row, { borderColor: t.colors.border }]}
            onPress={() => setShowAccount(true)}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={t.colors.accent} />
            ) : (
              <Text style={[styles.rowLabel, { color: t.colors.text }]} numberOfLines={1}>
                {session
                  ? tr('settings.account.signedInAs', { email: session.user.email ?? '' })
                  : tr('settings.account.signIn')}
              </Text>
            )}
            <ChevronRight size={18} color={t.colors.textMuted} />
          </TouchableOpacity>
          <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
        </>
      )}

      <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.about')}</Text>
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>{tr('settings.version')}</Text>
        <Text style={[styles.rowValue, { color: t.colors.textMuted }]}>1.0.0 · demo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '700', paddingTop: 16, paddingBottom: 12 },
  section: { ...textStyle.sectionHeader, marginTop: 20, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14 },
});
