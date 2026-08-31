import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, BookOpen, Info, Dices } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { AdvanceCalculatorModal } from '@/components/wfrp4e/AdvanceCalculatorModal';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import { CHARACTERISTIC_LABELS } from '@/types/wfrp4e';
import type { CharacteristicKey as CharKey } from '@/types/wfrp4e';
import { characteristicTotal, advanceCost, experienceCurrent } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

type Skill = Wfrp4eCharacter['skills'][number];
const CHARS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onRoll: (target: number, label: string) => void;
};

const EMPTY: Omit<Skill, 'id'> = { name: '', characteristic: 'ws', advances: 0, isAdvanced: false, description: '', page: undefined };

export function WfrpSkills({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Skill, 'id'>>(EMPTY);
  const [calcId, setCalcId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);
  const wikiSkill = wikiId ? character.skills.find(s => s.id === wikiId) ?? null : null;

  function total(s: Skill) {
    return characteristicTotal(character, s.characteristic) + s.advances;
  }
  // Apply bought advances and charge XP against `spent`.
  function applyAdvances(id: string, next: number, cost: number) {
    onChange({
      skills: character.skills.map(s => s.id === id ? { ...s, advances: next } : s),
      experience: { ...character.experience, spent: character.experience.spent + cost },
    });
  }
  const calcSkill = calcId ? character.skills.find(s => s.id === calcId) ?? null : null;
  function remove(id: string) {
    const s = character.skills.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.skills.removeConfirm', { name: s?.name ?? '' }), () =>
      onChange({ skills: character.skills.filter(x => x.id !== id) }));
  }
  function add() {
    if (!draft.name.trim()) return;
    onChange({ skills: [...character.skills, { id: uuidv4(), ...draft, name: draft.name.trim() }] });
    setDraft(EMPTY);
    setAdding(false);
  }

  const sorted = [...character.skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Section title={tr('wfrp.skills.title')}>
      {sorted.map(s => (
        <View key={s.id} style={[styles.rowWrap, { borderColor: t.colors.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.rowMain} activeOpacity={0.6} onPress={() => onRoll(total(s), s.name)}>
              <Text style={[styles.skillName, { color: t.colors.text }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.skillChar, { color: t.colors.textSecondary }]}>{tr(`wfrp.char.${s.characteristic}`)}</Text>
            </TouchableOpacity>
            <Dices size={11} color={t.colors.textMuted} style={styles.skillRollHint} />
            <TouchableOpacity activeOpacity={0.6} onPress={() => onRoll(total(s), s.name)} style={styles.totalBox}>
              <Text style={[styles.total, { color: t.colors.accentFg, fontFamily: t.fontFamily.serif }]}>{total(s)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWikiId(s.id)} style={styles.info} accessibilityLabel={tr('wfrp.skills.infoFor', { name: s.name })}>
              <Info size={14} color={t.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(s.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
          <View style={styles.advRow}>
            <Text style={[styles.advCost, { color: t.colors.textSecondary }]}>
              {tr('wfrp.skills.advCost', { n: s.advances, cost: advanceCost('skill', s.advances) })}
            </Text>
            <TouchableOpacity
              style={[styles.makeBtn, { borderColor: t.colors.accent }]}
              onPress={() => setCalcId(s.id)}
              activeOpacity={0.7}
              accessibilityLabel={tr('wfrp.skills.makeAdvancesFor', { name: s.name })}
            >
              <Text style={[styles.makeBtnText, { color: t.colors.accentFg }]}>{tr('wfrp.skills.makeAdvances')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.addBtn, { flex: 1, borderColor: t.colors.accent }]} onPress={() => setAdding(true)}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('wfrp.skills.addSkill')}</Text>
        </TouchableOpacity>
        {character.skills.length > 0 && (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: t.colors.danger }]}
            onPress={() => confirmRemove(tr, tr('wfrp.skills.clearAllConfirm', { n: character.skills.length }), () => onChange({ skills: [] }))}
          >
            <Text style={[styles.addText, { color: t.colors.danger }]}>{tr('wfrp.skills.clearAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('wfrp.skills.addSkillTitle')}</Text>
            <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
              <BookOpen size={15} color={t.colors.accent} />
              <Text style={[styles.bookBtnText, { color: t.colors.accentFg }]}>{tr('wfrp.skills.searchBook')}</Text>
            </TouchableOpacity>
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.skills.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} />
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.skills.characteristic')}</Text>
            <View style={styles.charRow}>
              {CHARS.map(c => {
                const active = draft.characteristic === c;
                return (
                  <TouchableOpacity key={c}
                    style={[styles.charChip, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
                    onPress={() => setDraft(d => ({ ...d, characteristic: c }))}>
                    <Text style={[styles.charChipText, { color: active ? t.colors.accent : t.colors.textMuted }]}>{tr(`wfrp.char.${c}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.skills.advances')}</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={String(draft.advances)} onChangeText={v => setDraft(d => ({ ...d, advances: parseInt(v) || 0 }))} />
              </View>
              <TouchableOpacity style={[styles.advancedToggle, { borderColor: draft.isAdvanced ? t.colors.accent : t.colors.border, backgroundColor: draft.isAdvanced ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
                onPress={() => setDraft(d => ({ ...d, isAdvanced: !d.isAdvanced }))}>
                <Text style={[styles.advancedText, { color: draft.isAdvanced ? t.colors.accent : t.colors.textMuted }]}>{tr('wfrp.skills.advanced')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.skills.descriptionPlaceholder')} placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={draft.description} onChangeText={v => setDraft(d => ({ ...d, description: v }))} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={add}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdvanceCalculatorModal
        visible={calcSkill !== null}
        title={calcSkill?.name ?? ''}
        kind="skill"
        current={calcSkill?.advances ?? 0}
        unspent={experienceCurrent(character)}
        onApply={(next, cost) => { if (calcId) applyAdvances(calcId, next, cost); }}
        onClose={() => setCalcId(null)}
      />

      <WikiModal
        visible={wikiSkill !== null}
        title={wikiSkill?.name ?? ''}
        subtitle={wikiSkill ? [
          `${CHARACTERISTIC_LABELS[wikiSkill.characteristic]} · ${wikiSkill.isAdvanced ? tr('wfrp.skills.advanced') : tr('wfrp.skills.basic')}`,
          wikiSkill.page,
        ].filter(Boolean).join(' · ') : ''}
        body={wikiSkill?.description ?? ''}
        onClose={() => setWikiId(null)}
      />

      <ContentPicker
        visible={picking}
        category="skill"
        title={tr('wfrp.skills.title')}
        subtitle={(r) => [(r.characteristic as string)?.toUpperCase(), r.isAdvanced ? tr('wfrp.skills.advanced') : tr('wfrp.skills.basic')].filter(Boolean).join(' · ')}
        onSelect={(r) => setDraft({
          name: r.name,
          characteristic: ((r.characteristic as CharKey) ?? 'ws'),
          advances: 0,
          isAdvanced: !!r.isAdvanced,
          description: (r.description as string) ?? '',
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setPicking(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  rowWrap: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  skillName: { fontSize: 14, flexShrink: 1 },
  skillChar: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  advRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  advCost: { fontSize: 11, fontWeight: '600' },
  makeBtn: { borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  makeBtnText: { fontSize: 12, fontWeight: '700' },
  skillRollHint: { opacity: 0.6 },
  totalBox: { minWidth: 34, alignItems: 'center' },
  total: { fontSize: 20, fontWeight: '700' },
  info: { width: 26, alignItems: 'center' },
  del: { width: 26, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  clearBtn: { padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  charRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  charChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, minWidth: 38, alignItems: 'center' },
  charChipText: { fontSize: 12, fontWeight: '700' },
  twoCol: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  advancedToggle: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  advancedText: { fontSize: 13, fontWeight: '600' },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 64 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
