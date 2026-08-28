import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { CopyX } from 'lucide-react-native';
import { light, dark } from '@/tokens/colors';
import { en } from '@/i18n/en';
import { es } from '@/i18n/es';
import { translate } from '@/i18n/translate';

// Rendered before the SQLiteProvider/ThemeProvider/LocaleProvider tree mounts
// (see useWebDbLock), so it can't use useTheme()/useTranslation() — it picks
// its own colors and locale directly.
function pickDict(): unknown {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return lang.toLowerCase().startsWith('es') ? es : en;
}

export function DbLockedScreen() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  const dict = pickDict();
  const title = translate(dict, en, 'ui.dbLock.title');
  const body = translate(dict, en, 'ui.dbLock.body');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CopyX size={44} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
