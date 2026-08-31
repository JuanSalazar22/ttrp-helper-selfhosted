import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import type { CharacteristicKey, GrantedSkill } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

export type GrantedValue = { skills: GrantedSkill[]; talents: string[] };
type Props = { value: GrantedValue; onChange: (next: GrantedValue) => void };

export function GrantedListsFields({ value, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [skillName, setSkillName] = useState('');
  const [skillChar, setSkillChar] = useState<CharacteristicKey>('ws');
  const [talentName, setTalentName] = useState('');

  function addSkill() {
    const name = skillName.trim();
    if (!name) return;
    onChange({ ...value, skills: [...value.skills, { name, characteristic: skillChar }] });
    setSkillName('');
    setSkillChar('ws');
  }
  function removeSkill(i: number) {
    onChange({ ...value, skills: value.skills.filter((_, idx) => idx !== i) });
  }
  function cycleChar() {
    setSkillChar(prev => KEYS[(KEYS.indexOf(prev) + 1) % KEYS.length]);
  }
  function addTalent() {
    const name = talentName.trim();
    if (!name) return;
    onChange({ ...value, talents: [...value.talents, name] });
    setTalentName('');
  }
  function removeTalent(i: number) {
    onChange({ ...value, talents: value.talents.filter((_, idx) => idx !== i) });
  }

  return (
    <View>
      <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.grants.grantedSkills')}</Text>
      {value.skills.map((s, i) => (
        <View key={i} style={[styles.listRow, { borderColor: t.colors.border }]}>
          <Text style={[styles.listText, { color: t.colors.text }]} numberOfLines={1}>{s.name}</Text>
          <Text style={[styles.charTag, { color: t.colors.textSecondary }]}>{tr(`wfrp.char.${s.characteristic}`)}</Text>
          <TouchableOpacity onPress={() => removeSkill(i)} hitSlop={8} accessibilityLabel={tr('wfrp.grants.removeSkillA11y', { name: s.name })}><X size={16} color={t.colors.danger} /></TouchableOpacity>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
          value={skillName} onChangeText={setSkillName}
          placeholder={tr('wfrp.grants.skillNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
        />
        <TouchableOpacity onPress={cycleChar} style={[styles.charBtn, { borderColor: t.colors.border }]} activeOpacity={0.7}>
          <Text style={[styles.charBtnText, { color: t.colors.textSecondary }]}>{tr(`wfrp.char.${skillChar}`)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={addSkill} style={[styles.addBtn, { backgroundColor: t.colors.accent }]} activeOpacity={0.7}>
          <Plus size={16} color={t.colors.accentText} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 16 }]}>{tr('wfrp.grants.grantedTalents')}</Text>
      {value.talents.map((name, i) => (
        <View key={i} style={[styles.listRow, { borderColor: t.colors.border }]}>
          <Text style={[styles.listText, { color: t.colors.text }]} numberOfLines={1}>{name}</Text>
          <TouchableOpacity onPress={() => removeTalent(i)} hitSlop={8} accessibilityLabel={tr('wfrp.grants.removeTalentA11y', { name })}><X size={16} color={t.colors.danger} /></TouchableOpacity>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
          value={talentName} onChangeText={setTalentName}
          placeholder={tr('wfrp.grants.talentNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
        />
        <TouchableOpacity onPress={addTalent} style={[styles.addBtn, { backgroundColor: t.colors.accent }]} activeOpacity={0.7}>
          <Plus size={16} color={t.colors.accentText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  listText: { flex: 1, fontSize: 14 },
  charTag: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, fontSize: 15, padding: 10, borderRadius: 8, borderWidth: 1 },
  charBtn: { minWidth: 48, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  charBtnText: { fontSize: 13, fontWeight: '700' },
  addBtn: { width: 44, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
