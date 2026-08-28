// Polyfill crypto.getRandomValues() for Hermes/React Native — must be imported
// before anything that uses `uuid` (e.g. db queries, list/row ids).
import 'react-native-get-random-values';
import { useEffect, useCallback } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase, DB_NAME } from '@/db/schema';
import { getSetting, setSetting, seedContentLibrary, seedWfrpContentTranslations } from '@/db/queries';
import { ThemeProvider, useTheme, useThemeMode, type ThemeMode } from '@/hooks/useTheme';
import { setHapticsEnabled } from '@/lib/haptics';
import { setSoundEnabled } from '@/lib/sound';
import { LocaleProvider, useLocale, type Locale } from '@/i18n';
import { AuthProvider } from '@/auth/AuthProvider';
import { SyncProvider } from '@/sync/SyncProvider';
import { useWebDbLock } from '@/hooks/useWebDbLock';
import { DbLockedScreen } from '@/components/ui/DbLockedScreen';

function AppContent() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function PrefLoader({ db }: { db: ReturnType<typeof useSQLiteContext> }) {
  const { setMode } = useThemeMode();
  const { setLocale } = useLocale();
  useEffect(() => {
    (async () => {
      const m = await getSetting(db, 'theme_mode');
      if (m === 'light' || m === 'dark' || m === 'system') setMode(m as ThemeMode);
      const loc = await getSetting(db, 'locale');
      if (loc === 'en' || loc === 'es') setLocale(loc);
      const h = await getSetting(db, 'haptics_enabled');
      setHapticsEnabled(h !== 'false');
      const snd = await getSetting(db, 'sound_enabled');
      setSoundEnabled(snd !== 'false');
      try { await seedContentLibrary(db); } catch (e) { console.warn('content seed failed', e); }
      try { await seedWfrpContentTranslations(db); } catch (e) { console.warn('es content seed failed', e); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function NativeThemed() {
  const db = useSQLiteContext();
  const persist = useCallback((m: ThemeMode) => { setSetting(db, 'theme_mode', m); }, [db]);
  const persistLocale = useCallback((l: Locale) => { setSetting(db, 'locale', l); }, [db]);
  return (
    <ThemeProvider onModeChange={persist}>
      <LocaleProvider onLocaleChange={persistLocale}>
        <PrefLoader db={db} />
        <SyncProvider>
          <AppContent />
        </SyncProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // expo-sqlite now supports web (wa-sqlite), so the SQLite provider is mounted
  // on every platform — no web-only fallback tree. useWebDbLock gates that mount
  // behind a Web Locks request so a second browser tab doesn't crash wa-sqlite's
  // OPFS VFS (see useWebDbLock).
  const dbLock = useWebDbLock();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {dbLock === 'blocked' ? (
        <DbLockedScreen />
      ) : dbLock === 'granted' ? (
        <AuthProvider>
          <SQLiteProvider databaseName={DB_NAME} onInit={initDatabase}>
            <NativeThemed />
          </SQLiteProvider>
        </AuthProvider>
      ) : null}
    </GestureHandlerRootView>
  );
}
