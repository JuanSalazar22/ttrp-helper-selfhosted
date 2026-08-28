import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

export default function NotFound() {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      <Text style={{ color: t.colors.text, fontSize: 18 }}>{tr('notFound.message')}</Text>
      <Link href="/" style={{ color: t.colors.accent, marginTop: 12 }}>
        {tr('notFound.goHome')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
