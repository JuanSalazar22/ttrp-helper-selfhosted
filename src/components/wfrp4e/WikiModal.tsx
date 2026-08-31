import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { hoverTitle } from '@/lib/a11y';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  body: string;
  onClose: () => void;
};

// Read-only reference popup: shows an entry's name, a short subtitle, and its
// (user-entered or book) description. Used to read skill/talent/spell text in place.
export function WikiModal({ visible, title, subtitle, body, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{title}</Text>
              {!!subtitle && <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('wfrp.wiki.closeA11y')} {...hoverTitle(tr('wfrp.wiki.closeA11y'))}>
              <X size={22} color={t.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <Text style={[styles.body, { color: t.colors.text }]}>
              {body.trim() || tr('wfrp.wiki.noDescription')}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  bodyScroll: { flexGrow: 0 },
  bodyContent: { paddingBottom: 4 },
  body: { fontSize: 14, lineHeight: 21 },
});
