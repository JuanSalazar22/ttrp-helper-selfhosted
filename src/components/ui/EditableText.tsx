import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = {
  value: string;
  label: string;
  onSave: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
};

// Compact tap-to-edit text box — same box/modal shell as EditableNumber, but for a
// single-line string (no numeric keyboard, no min/max clamping).
export function EditableText({ value, label, onSave, size = 'md', placeholder }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const fontSize = size === 'lg' ? 36 : size === 'md' ? 26 : 18;

  function confirm() {
    onSave(draft.trim());
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => { setDraft(value); setOpen(true); }}
        style={[styles.box, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.value, { fontSize, color: value ? t.colors.text : t.colors.textMuted, fontFamily: t.fontFamily.serif }]}
          numberOfLines={1}
        >
          {value || '—'}
        </Text>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetLabel, { color: t.colors.textSecondary }]}>{label}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, fontFamily: t.fontFamily.serif }]}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={t.colors.textMuted}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={confirm}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setOpen(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('ui.editableNumber.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: t.colors.accent }]} onPress={confirm}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('ui.editableNumber.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    minWidth: 72,
  },
  value: { fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 24,
    gap: 16,
  },
  sheetLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
