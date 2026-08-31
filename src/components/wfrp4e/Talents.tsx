import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, BookOpen, Info } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { AdvanceCalculatorModal } from '@/components/wfrp4e/AdvanceCalculatorModal';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { experienceCurrent, mergeGrantedTalents, type GrantedTalent } from '@/types/wfrp4e';
import { rollRandomTalents } from '@/lib/randomTalents';
import { roll } from '@/dice/engine';
import { getContentByNames } from '@/db/queries';
import { confirmRemove } from '@/lib/confirm';
import { hoverTitle } from '@/lib/a11y';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Talent = Wfrp4eCharacter['talents'][number];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const EMPTY: Omit<Talent, 'id'> = { name: '', timesTaken: 1, description: '', tests: '', page: undefined };

export function Talents({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Talent, 'id'>>(EMPTY);
  const [calcId, setCalcId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'added'>('name');
  const wikiTalent = wikiId ? character.talents.find(x => x.id === wikiId) ?? null : null;

  // Display-only — sorting never changes character.talents itself or its stored order.
  const sortedTalents = sortBy === 'name'
    ? [...character.talents].sort((a, b) => a.name.localeCompare(b.name, locale))
    : character.talents;

  // Buy/sell talent ranks (N×100 per rank) and charge XP against `spent`.
  function applyRank(id: string, next: number, cost: number) {
    onChange({
      talents: character.talents.map(x => x.id === id ? { ...x, timesTaken: Math.max(1, next) } : x),
      experience: { ...character.experience, spent: character.experience.spent + cost },
    });
  }
  const calcTalent = calcId ? character.talents.find(x => x.id === calcId) ?? null : null;

  async function rollRandom() {
    const names = rollRandomTalents(1, () => roll('1d100').total, character.talents.map(t => t.name));
    if (!names.length) return;
    const records = await getContentByNames(db, 'talent', names, locale);
    const lookup = new Map<string, GrantedTalent>(records.map(r => [
      r.name.toLowerCase(),
      { name: r.name, description: r.description as string | undefined, tests: r.tests as string | undefined },
    ]));
    const enriched: GrantedTalent[] = names.map(name => lookup.get(name.toLowerCase()) ?? { name });
    onChange({ talents: mergeGrantedTalents(character.talents, enriched, uuidv4) });
  }

  function openAdd() { setDraft(EMPTY); setAdding(true); setEditId(null); }
  function openEdit(tal: Talent) {
    setDraft({ name: tal.name, timesTaken: tal.timesTaken, description: tal.description, tests: tal.tests ?? '', page: tal.page });
    setEditId(tal.id); setAdding(true);
  }
  function save() {
    if (!draft.name.trim()) return;
    if (editId) {
      onChange({ talents: character.talents.map(x => x.id === editId ? { ...x, ...draft, name: draft.name.trim() } : x) });
    } else {
      onChange({ talents: [...character.talents, { id: uuidv4(), ...draft, name: draft.name.trim() }] });
    }
    setAdding(false); setEditId(null); setDraft(EMPTY);
  }
  function remove(id: string) {
    const tal = character.talents.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.talents.removeConfirm', { name: tal?.name ?? '' }), () =>
      onChange({ talents: character.talents.filter(x => x.id !== id) }));
  }

  return (
    <Section title={tr('wfrp.talents.title')}>
      {character.talents.length > 1 && (
        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.talents.sortBy')}</Text>
          <TouchableOpacity
            onPress={() => setSortBy('name')}
            style={[styles.sortChip, { borderColor: t.colors.accent, backgroundColor: sortBy === 'name' ? t.colors.accent : 'transparent' }]}
          >
            <Text style={{ color: sortBy === 'name' ? t.colors.accentText : t.colors.accent, fontSize: 12, fontWeight: '600' }}>
              {tr('wfrp.talents.sortName')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSortBy('added')}
            style={[styles.sortChip, { borderColor: t.colors.accent, backgroundColor: sortBy === 'added' ? t.colors.accent : 'transparent' }]}
          >
            <Text style={{ color: sortBy === 'added' ? t.colors.accentText : t.colors.accent, fontSize: 12, fontWeight: '600' }}>
              {tr('wfrp.talents.sortAdded')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {sortedTalents.map(tal => (
        <View key={tal.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEdit(tal)}>
            <Text style={[styles.name, { color: t.colors.text }]}>
              {tal.name}{tal.timesTaken > 1 ? ` ×${tal.timesTaken}` : ''}
            </Text>
            {!!tal.description && <Text style={[styles.desc, { color: t.colors.textMuted }]} numberOfLines={2}>{tal.description}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rankChip, { borderColor: t.colors.accent }]}
            onPress={() => setCalcId(tal.id)}
            accessibilityLabel={tr('wfrp.talents.buyRankFor', { name: tal.name })}
          >
            <Text style={[styles.rankChipText, { color: t.colors.accentFg }]}>×{tal.timesTaken}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWikiId(tal.id)} style={styles.del} accessibilityLabel={tr('wfrp.talents.infoFor', { name: tal.name })} {...hoverTitle(tr('wfrp.talents.infoFor', { name: tal.name }))}>
            <Info size={14} color={t.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(tal.id)} style={styles.del} accessibilityLabel={tr('wfrp.talents.removeA11y', { name: tal.name })} {...hoverTitle(tr('wfrp.talents.removeA11y', { name: tal.name }))}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.addBtn, { flex: 1, borderColor: t.colors.accent }]} onPress={openAdd}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('wfrp.talents.addTalent')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { flex: 1, borderColor: t.colors.accent }]} onPress={rollRandom} accessibilityLabel={tr('wfrp.talents.randomTalent')}>
          <Text style={[styles.addText, { color: t.colors.accentFg }]}>🎲 {tr('wfrp.talents.randomTalent')}</Text>
        </TouchableOpacity>
      </View>
      {character.talents.length > 0 && (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: t.colors.danger, marginTop: 8 }]}
          onPress={() => confirmRemove(tr, tr('wfrp.talents.clearAllConfirm', { n: character.talents.length }), () => onChange({ talents: [] }))}
        >
          <Text style={[styles.addText, { color: t.colors.danger }]}>{tr('wfrp.talents.clearAll')}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{editId ? tr('wfrp.talents.editTalent') : tr('wfrp.talents.addTalent')}</Text>
            {!editId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accentFg }]}>{tr('wfrp.talents.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.talents.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.talents.timesTaken')}</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={String(draft.timesTaken)} onChangeText={v => setDraft(d => ({ ...d, timesTaken: parseInt(v) || 1 }))} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.talents.test')}</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.talents.testPlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={draft.tests} onChangeText={v => setDraft(d => ({ ...d, tests: v }))} />
              </View>
            </View>
            <TextInput style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.talents.descriptionPlaceholder')} placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={draft.description} onChangeText={v => setDraft(d => ({ ...d, description: v }))} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={save}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('wfrp.talents.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WikiModal
        visible={wikiTalent !== null}
        title={wikiTalent?.name ?? ''}
        subtitle={wikiTalent ? [
          wikiTalent.timesTaken > 1 ? `×${wikiTalent.timesTaken}` : '',
          wikiTalent.tests ? `${tr('wfrp.talents.test')}: ${wikiTalent.tests}` : '',
          wikiTalent.page,
        ].filter(Boolean).join(' · ') : ''}
        body={wikiTalent?.description ?? ''}
        onClose={() => setWikiId(null)}
      />

      <AdvanceCalculatorModal
        visible={calcTalent !== null}
        title={calcTalent?.name ?? ''}
        kind="talent"
        current={calcTalent?.timesTaken ?? 1}
        unspent={experienceCurrent(character)}
        onApply={(next, cost) => { if (calcId) applyRank(calcId, next, cost); }}
        onClose={() => setCalcId(null)}
      />

      <ContentPicker
        visible={picking}
        category="talent"
        title={tr('wfrp.talents.title')}
        subtitle={(r) => (r.tests as string) || (r.description as string) || ''}
        onSelect={(r) => setDraft({
          name: r.name,
          timesTaken: 1,
          description: (r.description as string) ?? '',
          tests: (r.tests as string) ?? '',
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setPicking(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sortLabel: { fontSize: 12, fontWeight: '600' },
  sortChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 14, fontWeight: '500' },
  desc: { fontSize: 12, marginTop: 2 },
  del: { width: 26, alignItems: 'center' },
  rankChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, minWidth: 38, alignItems: 'center' },
  rankChipText: { fontSize: 13, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 80 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
