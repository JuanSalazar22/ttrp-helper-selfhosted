import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
};

export function TextEditModal({ visible, title, value, onSave, onClose, placeholder }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [draft, setDraft] = useState(value);

  function handleSave() {
    onSave(draft);
    onClose();
  }

  function handleOpen() {
    setDraft(value);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: t.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.inner}>
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: t.colors.textMuted }]}>{tr('ui.textEditModal.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={[styles.saveText, { color: t.colors.accent }]}>{tr('ui.textEditModal.save')}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { color: t.colors.text, backgroundColor: t.colors.background }]}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            placeholder={placeholder ?? tr('ui.textEditModal.defaultPlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            textAlignVertical="top"
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '600' },
  cancelBtn: { width: 70 },
  cancelText: { fontSize: 15 },
  saveBtn: { width: 70, alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '600' },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    padding: 20,
  },
});
