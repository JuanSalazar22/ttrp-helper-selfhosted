import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import type { GameSystem } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (system: GameSystem, name: string) => Promise<void>;
};

const SYSTEMS: { id: GameSystem; label: string; sub: string; beta?: boolean }[] = [
  { id: 'dnd5e',  label: 'D&D 5e',       sub: 'Dungeons & Dragons 5th Edition', beta: true },
  { id: 'wfrp4e', label: 'WFRP 4e',      sub: 'Warhammer Fantasy Roleplay' },
];

export function CreateCharacterModal({ visible, onClose, onCreate }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [system, setSystem] = useState<GameSystem>('dnd5e');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    await onCreate(system, trimmed);
    setName('');
    setSystem('dnd5e');
    setLoading(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.heading, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {tr('create.title')}
          </Text>

          {/* System picker */}
          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('create.gameSystem')}</Text>
          <View style={styles.systemRow}>
            {SYSTEMS.map(s => {
              const active = system === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.systemBtn,
                    {
                      borderColor: active ? t.colors.accent : t.colors.border,
                      backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
                    },
                  ]}
                  onPress={() => setSystem(s.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.systemLabelRow}>
                    <Text style={[styles.systemLabel, { color: active ? t.colors.accent : t.colors.text }]}>
                      {s.label}
                    </Text>
                    {s.beta && (
                      <View style={[styles.betaBadge, { borderColor: t.colors.textMuted }]}>
                        <Text style={[styles.betaBadgeText, { color: t.colors.textMuted }]}>
                          {tr('create.betaLabel')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.systemSub, { color: t.colors.textSecondary }]}>{s.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Name input */}
          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('create.characterName')}</Text>
          <TextInput
            style={[styles.nameInput, {
              color: t.colors.text,
              borderColor: t.colors.border,
              backgroundColor: t.colors.backgroundSecondary,
            }]}
            placeholder={tr('create.namePlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: t.colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, {
                backgroundColor: name.trim() ? t.colors.accent : t.colors.border,
              }]}
              onPress={handleCreate}
              disabled={!name.trim() || loading}
            >
              <Text style={[styles.btnText, { color: name.trim() ? t.colors.accentText : t.colors.textMuted }]}>
                {loading ? tr('common.creating') : tr('common.create')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  systemRow: { flexDirection: 'row', gap: 10 },
  systemBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    gap: 3,
  },
  systemLabel: { fontSize: 15, fontWeight: '700' },
  systemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  betaBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  betaBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  systemSub: { fontSize: 11 },
  nameInput: {
    fontSize: 18,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
