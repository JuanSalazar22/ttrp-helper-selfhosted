import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = { title: string; body?: string; onBack?: () => void };

export function ErrorState({ title, body, onBack }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <View style={styles.root}>
      <AlertTriangle size={44} color={t.colors.textMuted} />
      <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: t.colors.textMuted }]}>{body}</Text> : null}
      {onBack && (
        <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={onBack}>
          <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.goBack')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
