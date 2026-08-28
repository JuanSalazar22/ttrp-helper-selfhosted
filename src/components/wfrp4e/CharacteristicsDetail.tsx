import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { roll } from '@/dice/engine';
import { AdvanceCalculatorModal } from '@/components/wfrp4e/AdvanceCalculatorModal';
import {
  CHARACTERISTIC_LABELS, characteristicTotal, buffTotal, advanceCost, experienceCurrent,
} from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
type Field = 'roll' | 'racial' | 'other' | 'advances';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

export function CharacteristicsDetail({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [calcKey, setCalcKey] = useState<CharacteristicKey | null>(null);

  function setField(key: CharacteristicKey, field: Field, value: number) {
    onChange({
      characteristics: {
        ...character.characteristics,
        [key]: { ...character.characteristics[key], [field]: value },
      },
    });
  }

  // Apply bought advances and charge the XP against `spent`.
  function applyAdvances(key: CharacteristicKey, nextAdvances: number, cost: number) {
    onChange({
      characteristics: {
        ...character.characteristics,
        [key]: { ...character.characteristics[key], advances: nextAdvances },
      },
      experience: { ...character.experience, spent: character.experience.spent + cost },
    });
  }

  function applyGeneratedRolls() {
    const next = { ...character.characteristics };
    for (const k of KEYS) {
      next[k] = { ...next[k], roll: roll('2d10').total };
    }
    onChange({ characteristics: next });
  }

  function generateRolls() {
    const message = tr('wfrp.generate.body');
    // react-native-web does not render Alert.alert dialogs, so fall back to the browser confirm on web.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) applyGeneratedRolls();
      return;
    }
    Alert.alert(tr('wfrp.generate.title'), message, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('wfrp.generate.confirm'), style: 'destructive', onPress: applyGeneratedRolls },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('wfrp.sections.characteristics')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('common.close')}>
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, { borderColor: t.colors.accent }]}
          onPress={generateRolls}
          activeOpacity={0.7}
        >
          <Text style={[styles.generateText, { color: t.colors.accent }]}>{tr('wfrp.fields.generateRolls')}</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.list}>
          {KEYS.map(k => {
            const c = character.characteristics[k];
            const sum = characteristicTotal(character, k);
            const bt = buffTotal(character, k);
            return (
              <View key={k} style={[styles.rowWrap, { borderBottomColor: t.colors.border }]}>
                <View style={styles.row}>
                  <Text style={[styles.rowAbbrev, { color: t.colors.text }]}>{tr(`wfrp.char.${k}`)}</Text>
                  <View style={styles.fields}>
                    <View style={styles.field}><EditableNumber size="sm" label={tr('wfrp.advance.roll')} value={c.roll} onSave={v => setField(k, 'roll', v)} /></View>
                    <View style={styles.field}><EditableNumber size="sm" label={tr('wfrp.advance.racial')} value={c.racial} onSave={v => setField(k, 'racial', v)} /></View>
                    <View style={styles.field}><EditableNumber size="sm" label={tr('wfrp.advance.other')} value={c.other} onSave={v => setField(k, 'other', v)} /></View>
                    {/* Adv is read-only here — buy/sell only via "Make Advances" so XP is always charged. */}
                    <View style={styles.field}>
                      <View style={[styles.advBox, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
                        <Text style={[styles.advValue, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{c.advances}</Text>
                        <Text style={[styles.advLabel, { color: t.colors.textMuted }]}>{tr('wfrp.advance.adv')}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.sumBox}>
                    <Text style={[styles.sum, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{sum}</Text>
                  </View>
                </View>
                {bt !== 0 && (
                  <Text style={[styles.buffNote, { color: bt > 0 ? t.colors.success : t.colors.danger }]}>
                    {tr('wfrp.buffs.contribution', { value: `${bt > 0 ? '+' : '−'}${Math.abs(bt)}` })}
                  </Text>
                )}
                <View style={styles.advRow}>
                  <Text style={[styles.advCost, { color: t.colors.textMuted }]}>
                    {tr('wfrp.advance.advCost', { n: c.advances, cost: advanceCost('characteristic', c.advances) })}
                  </Text>
                  <TouchableOpacity
                    style={[styles.makeBtn, { borderColor: t.colors.accent }]}
                    onPress={() => setCalcKey(k)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.makeBtnText, { color: t.colors.accent }]}>{tr('wfrp.fields.makeAdvances')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <AdvanceCalculatorModal
          visible={calcKey !== null}
          title={calcKey ? CHARACTERISTIC_LABELS[calcKey] : ''}
          kind="characteristic"
          current={calcKey ? character.characteristics[calcKey].advances : 0}
          unspent={experienceCurrent(character)}
          onApply={(next, cost) => { if (calcKey) applyAdvances(calcKey, next, cost); }}
          onClose={() => setCalcKey(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700' },
  generateBtn: {
    marginHorizontal: 16, marginTop: 12, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, alignItems: 'center',
  },
  generateText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 12, gap: 4 },
  rowWrap: { paddingVertical: 8, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buffNote: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  advRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  advCost: { fontSize: 11, fontWeight: '600' },
  makeBtn: { borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  makeBtnText: { fontSize: 12, fontWeight: '700' },
  rowAbbrev: { width: 36, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  fields: { flex: 1, flexDirection: 'row', gap: 4 },
  field: { flex: 1 },
  advBox: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4 },
  advValue: { fontSize: 18, fontWeight: '700' },
  advLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  sumBox: { width: 40, alignItems: 'center' },
  sum: { fontSize: 22, fontWeight: '700' },
});
