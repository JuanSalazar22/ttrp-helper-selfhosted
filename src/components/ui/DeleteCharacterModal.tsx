import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = {
  visible: boolean;
  name: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Permanent deletion is destructive and irreversible, so it requires typing the exact
// character name to enable the Delete button.
export function DeleteCharacterModal({ visible, name, onConfirm, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [input, setInput] = useState('');

  useEffect(() => { if (visible) setInput(''); }, [visible]);

  const matches = input.trim() === name.trim() && name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('deleteCharacter.title')}</Text>
          <Text style={[styles.body, { color: t.colors.textMuted }]}>
            {tr('deleteCharacter.bodyBefore')}<Text style={{ color: t.colors.text, fontWeight: '700' }}>{name}</Text>{tr('deleteCharacter.bodyAfter')}
          </Text>
          <TextInput
            style={[styles.input, { color: t.colors.text, borderColor: matches ? t.colors.danger : t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
            value={input}
            onChangeText={setInput}
            placeholder={name}
            placeholderTextColor={t.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: matches ? t.colors.danger : t.colors.border }]}
              disabled={!matches}
              onPress={() => { onConfirm(); onClose(); }}
            >
              <Text style={[styles.btnText, { color: matches ? t.colors.accentText : t.colors.textMuted }]}>{tr('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 14 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  input: { fontSize: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
