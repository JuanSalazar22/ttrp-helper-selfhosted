import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { GrantedListsFields, type GrantedValue } from '@/components/wfrp4e/GrantedListsFields';
import type { WfrpOriginDef, GrantedSkill } from '@/types/wfrp4e';

type Props = {
  visible: boolean;
  initialName?: string;
  initialSkills?: GrantedSkill[];
  initialTalents?: string[];
  onSubmit: (def: WfrpOriginDef) => void;
  onClose: () => void;
};

export function OriginEditor({ visible, initialName = '', initialSkills, initialTalents, onSubmit, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [name, setName] = useState(initialName);
  const [granted, setGranted] = useState<GrantedValue>(() => ({ skills: initialSkills ?? [], talents: initialTalents ?? [] }));

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setGranted({ skills: initialSkills ?? [], talents: initialTalents ?? [] });
    }
  }, [visible]);

  function handleSave() {
    onSubmit({ name: name.trim(), skills: granted.skills, talents: granted.talents });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: t.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.inner}>
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}>
              <Text style={[styles.cancelText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: t.colors.text }]}>{tr('wfrp.origin.newOrigin')}</Text>
            <TouchableOpacity onPress={handleSave} style={[styles.hBtn, styles.hBtnRight]}>
              <Text style={[styles.saveText, { color: t.colors.accentFg }]}>{tr('common.save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: t.colors.textMuted }]}>{tr('wfrp.origin.originName')}</Text>
            <TextInput
              style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={name} onChangeText={setName}
              placeholder={tr('wfrp.origin.originNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
            />
            <View style={{ marginTop: 20 }}>
              <GrantedListsFields value={granted} onChange={setGranted} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  hBtn: { width: 70 },
  hBtnRight: { alignItems: 'flex-end' },
  cancelText: { fontSize: 15 },
  saveText: { fontSize: 15, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  nameInput: { fontSize: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
});
