import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { GrantedListsFields, type GrantedValue } from '@/components/wfrp4e/GrantedListsFields';
import type { CharacteristicKey, WfrpSpeciesDef } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
const ZERO: Record<CharacteristicKey, number> = Object.fromEntries(KEYS.map(k => [k, 0])) as Record<CharacteristicKey, number>;

type Props = {
  visible: boolean;
  initial?: WfrpSpeciesDef;        // pre-fill when editing/duplicating a race
  onSubmit: (def: WfrpSpeciesDef) => void;
  onClose: () => void;
};

const num = (s: string, fallback = 0) => { const n = parseInt(s, 10); return isNaN(n) ? fallback : n; };
function toStrings(m: Record<CharacteristicKey, number>): Record<CharacteristicKey, string> {
  return Object.fromEntries(KEYS.map(k => [k, String(m[k] ?? 0)])) as Record<CharacteristicKey, string>;
}

export function SpeciesEditor({ visible, initial, onSubmit, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mods, setMods] = useState<Record<CharacteristicKey, string>>(() => toStrings(ZERO));
  const [coeffs, setCoeffs] = useState({ sb: '1', tb: '2', wpb: '1' });
  const [fate, setFate] = useState('0');
  const [resilience, setResilience] = useState('0');
  const [extraPoints, setExtraPoints] = useState('0');
  const [movement, setMovement] = useState('4');
  const [randomTalents, setRandomTalents] = useState('0');
  const [granted, setGranted] = useState<GrantedValue>(() => ({ skills: [], talents: [] }));

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setMods(toStrings(initial?.modifiers ?? ZERO));
    setCoeffs({
      sb: String(initial?.woundsCoeffs?.sb ?? 1),
      tb: String(initial?.woundsCoeffs?.tb ?? 2),
      wpb: String(initial?.woundsCoeffs?.wpb ?? 1),
    });
    setFate(String(initial?.fate ?? 0));
    setResilience(String(initial?.resilience ?? 0));
    setExtraPoints(String(initial?.extraPoints ?? 0));
    setMovement(String(initial?.movement ?? 4));
    setRandomTalents(String(initial?.randomTalents ?? 0));
    setGranted({ skills: initial?.skills ?? [], talents: initial?.talents ?? [] });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!name.trim()) return;
    const modifiers = Object.fromEntries(KEYS.map(k => [k, num(mods[k])])) as Record<CharacteristicKey, number>;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      modifiers,
      woundsCoeffs: { sb: num(coeffs.sb, 1), tb: num(coeffs.tb, 2), wpb: num(coeffs.wpb, 1) },
      fate: num(fate),
      resilience: num(resilience),
      extraPoints: num(extraPoints),
      movement: num(movement, 4),
      randomTalents: num(randomTalents),
      skills: granted.skills,
      talents: granted.talents,
    });
    onClose();
  }

  const derivedFields: Array<{ label: string; value: string; set: (v: string) => void }> = [
    { label: tr('wfrp.species.statFate'), value: fate, set: setFate },
    { label: tr('wfrp.species.statResilience'), value: resilience, set: setResilience },
    { label: tr('wfrp.species.statExtraPts'), value: extraPoints, set: setExtraPoints },
    { label: tr('wfrp.species.statMovement'), value: movement, set: setMovement },
    { label: tr('wfrp.species.statRandomTal'), value: randomTalents, set: setRandomTalents },
  ];
  const coeffFields: Array<{ label: string; value: string; set: (v: string) => void }> = [
    { label: '× SB', value: coeffs.sb, set: (v) => setCoeffs(c => ({ ...c, sb: v })) },
    { label: '× TB', value: coeffs.tb, set: (v) => setCoeffs(c => ({ ...c, tb: v })) },
    { label: '× WPB', value: coeffs.wpb, set: (v) => setCoeffs(c => ({ ...c, wpb: v })) },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: t.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.inner}>
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn}>
              <Text style={[styles.cancelText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: t.colors.text }]}>{initial ? tr('wfrp.species.editRace') : tr('wfrp.species.newRace')}</Text>
            <TouchableOpacity onPress={handleSave} style={[styles.hBtn, styles.hBtnRight]}>
              <Text style={[styles.saveText, { color: t.colors.accent }]}>{tr('common.save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.species.raceName')}</Text>
            <TextInput
              style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={name} onChangeText={setName}
              placeholder={tr('wfrp.species.raceNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
            />

            <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 16 }]}>{tr('wfrp.species.descriptionOptional')}</Text>
            <TextInput
              style={[styles.nameInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={description} onChangeText={setDescription}
              placeholder={tr('wfrp.species.descriptionPlaceholder')} placeholderTextColor={t.colors.textMuted}
            />

            <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 20 }]}>{tr('wfrp.species.attributeBases')}</Text>
            <View style={styles.grid}>
              {KEYS.map(k => (
                <View key={k} style={[styles.cell, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.cellLabel, { color: t.colors.textSecondary }]}>{tr(`wfrp.char.${k}`)}</Text>
                  <TextInput
                    style={[styles.cellInput, { color: t.colors.text }]}
                    value={mods[k]} onChangeText={v => setMods(m => ({ ...m, [k]: v }))}
                    keyboardType="number-pad" selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 20 }]}>{tr('wfrp.species.startingStats')}</Text>
            <View style={styles.grid}>
              {derivedFields.map(f => (
                <View key={f.label} style={[styles.cell, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.cellLabel, { color: t.colors.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.cellInput, { color: t.colors.text }]}
                    value={f.value} onChangeText={f.set} keyboardType="number-pad" selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 20 }]}>{tr('wfrp.species.woundsFormula')}</Text>
            <View style={styles.grid}>
              {coeffFields.map(f => (
                <View key={f.label} style={[styles.cellThird, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.cellLabel, { color: t.colors.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.cellInput, { color: t.colors.text }]}
                    value={f.value} onChangeText={f.set} keyboardType="number-pad" selectTextOnFocus
                  />
                </View>
              ))}
            </View>

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  cellThird: { width: '31%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  cellLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  cellInput: { fontSize: 18, fontWeight: '700', minWidth: 44, textAlign: 'right', paddingVertical: 6 },
});
