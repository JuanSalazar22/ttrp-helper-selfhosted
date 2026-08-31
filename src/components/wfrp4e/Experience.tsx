import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { hoverTitle } from '@/lib/a11y';
import { experienceCurrent } from '@/types/wfrp4e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

// Total (earned) and Spent are player-editable; Current (unspent) is derived and
// shown red when negative. The advance calculator increments `spent` automatically.
// The "+" button on Total adds a delta to whatever's already there (e.g. "gained
// 50 XP this session") without needing to do the addition by hand — Total itself
// stays directly editable too, for corrections or setting an absolute value.
export function Experience({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const xp = character.experience;
  const current = experienceCurrent(character);
  const [addingXp, setAddingXp] = useState(false);
  const [xpDraft, setXpDraft] = useState('');
  const addXpLabel = tr('wfrp.fields.addXpA11y');

  function setTotal(total: number) {
    onChange({ experience: { ...xp, total: Math.max(0, total) } });
  }
  function setSpent(spent: number) {
    onChange({ experience: { ...xp, spent: Math.max(0, spent) } });
  }
  function openAddXp() {
    setXpDraft('');
    setAddingXp(true);
  }
  function confirmAddXp() {
    const n = parseInt(xpDraft, 10);
    if (!isNaN(n) && n > 0) setTotal(xp.total + n);
    setAddingXp(false);
  }

  return (
    <Section title={tr('wfrp.sections.experience')}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <EditableNumber size="md" label={tr('wfrp.fields.total')} value={xp.total} min={0} onSave={setTotal} />
          <TouchableOpacity
            style={[styles.addXpBtn, { backgroundColor: t.colors.accent, borderColor: t.colors.background }]}
            onPress={openAddXp}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityLabel={addXpLabel}
            {...hoverTitle(addXpLabel)}
          >
            <Plus size={14} color={t.colors.accentText} />
          </TouchableOpacity>
        </View>
        <View style={styles.cell}>
          <EditableNumber size="md" label={tr('wfrp.fields.spent')} value={xp.spent} min={0} onSave={setSpent} />
        </View>
        <View style={styles.cell}>
          <View style={[styles.currentBox, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
            <Text
              style={[styles.currentValue, { fontFamily: t.fontFamily.serif, color: current < 0 ? t.colors.danger : t.colors.accentFg }]}
            >
              {current}
            </Text>
            <Text style={[styles.currentLabel, { color: t.colors.textMuted }]}>{tr('wfrp.fields.current')}</Text>
          </View>
        </View>
      </View>

      <Modal visible={addingXp} transparent animationType="fade" onRequestClose={() => setAddingXp(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setAddingXp(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.fields.addXpTitle')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, fontFamily: t.fontFamily.serif }]}
              value={xpDraft}
              onChangeText={setXpDraft}
              keyboardType="number-pad"
              placeholder={tr('wfrp.fields.addXpPlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              autoFocus
              onSubmitEditing={confirmAddXp}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAddingXp(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: t.colors.accent }]} onPress={confirmAddXp}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, position: 'relative' },
  currentBox: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4,
  },
  currentValue: { fontSize: 26, fontWeight: '700' },
  currentLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addXpBtn: {
    position: 'absolute', top: -6, right: -2,
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: StyleSheet.absoluteFill,
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 24,
    gap: 16,
  },
  sheetLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    fontSize: 48,
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
