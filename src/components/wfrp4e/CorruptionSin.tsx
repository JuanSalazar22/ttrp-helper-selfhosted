import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, BookOpen, Info } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import { hoverTitle } from '@/lib/a11y';
import { characteristicBonus, corruptionThreshold, type Wfrp4eCharacter } from '@/types/wfrp4e';

type MutationType = 'physical' | 'mental';
type Mutation = Wfrp4eCharacter['mutations'][number];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const MUTATION_TYPES: MutationType[] = ['physical', 'mental'];

type MutationDraft = { name: string; type: MutationType; description?: string; page?: string };
const EMPTY_DRAFT: MutationDraft = { name: '', type: 'physical' };

export function CorruptionSin({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<MutationDraft>(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);
  const wikiMutation = wikiId ? character.mutations.find(x => x.id === wikiId) ?? null : null;

  function openAdd() {
    setDraft(EMPTY_DRAFT);
    setAdding(true);
  }

  function save() {
    if (!draft.name.trim()) return;
    const newMutation: Mutation = {
      id: uuidv4(),
      name: draft.name.trim(),
      type: draft.type,
      description: draft.description,
      page: draft.page,
    };
    onChange({ mutations: [...character.mutations, newMutation] });
    setAdding(false);
    setDraft(EMPTY_DRAFT);
  }

  function remove(id: string) {
    const m = character.mutations.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.corruption.removeConfirm', { name: m?.name ?? '' }), () =>
      onChange({ mutations: character.mutations.filter(x => x.id !== id) }));
  }

  const tb = characteristicBonus(character, 't');
  const wpb = characteristicBonus(character, 'wp');
  const threshold = corruptionThreshold(character);

  return (
    <Section title={tr('wfrp.corruption.title')}>
      {/* Numbers row */}
      <View style={styles.numbersRow}>
        <EditableNumber
          value={character.corruption.current}
          label={tr('wfrp.corruption.corruption')}
          size="md"
          onSave={v => onChange({ corruption: { ...character.corruption, current: v } })}
        />
        <View style={styles.thresholdBlock}>
          <View style={styles.thresholdValueBox}>
            <Text style={[styles.thresholdValue, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{threshold}</Text>
            <Text style={[styles.thresholdLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.corruption.threshold')}</Text>
          </View>
          <EditableNumber
            value={character.corruption.modifier}
            label={tr('wfrp.fields.mod')}
            size="sm"
            onSave={v => onChange({ corruption: { ...character.corruption, modifier: v } })}
          />
        </View>
        <EditableNumber
          value={character.sin}
          label={tr('wfrp.corruption.sin')}
          size="md"
          onSave={v => onChange({ sin: v })}
        />
      </View>
      <Text style={[styles.breakdown, { color: t.colors.textMuted }]}>
        {tr('wfrp.charBonus.t')} {tb} + {tr('wfrp.charBonus.wp')} {wpb} + mod {character.corruption.modifier}
      </Text>

      {/* Mutations list */}
      {character.mutations.length > 0 && (
        <View style={[styles.mutationsBlock, { marginTop: 12 }]}>
          <Text style={[styles.sectionLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.corruption.mutations')}</Text>
          {character.mutations.map(m => (
            <View key={m.id} style={[styles.row, { borderColor: t.colors.border }]}>
              <Text style={[styles.mutationName, { color: t.colors.text }]} numberOfLines={1}>
                {m.name}
              </Text>
              <View
                style={[
                  styles.typePill,
                  {
                    backgroundColor:
                      m.type === 'physical' ? t.colors.accent + '22' : t.colors.danger + '22',
                    borderColor:
                      m.type === 'physical' ? t.colors.accent : t.colors.danger,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typePillText,
                    { color: m.type === 'physical' ? t.colors.accent : t.colors.danger },
                  ]}
                >
                  {m.type === 'physical' ? tr('wfrp.corruption.physical') : tr('wfrp.corruption.mental')}
                </Text>
              </View>
              {(!!m.description || !!m.page) && (
                <TouchableOpacity onPress={() => setWikiId(m.id)} style={styles.del} accessibilityLabel={tr('wfrp.corruption.infoFor', { name: m.name })} {...hoverTitle(tr('wfrp.corruption.infoFor', { name: m.name }))}>
                  <Info size={14} color={t.colors.textMuted} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => remove(m.id)} style={styles.del} accessibilityLabel={tr('wfrp.corruption.removeA11y', { name: m.name })} {...hoverTitle(tr('wfrp.corruption.removeA11y', { name: m.name }))}>
                <Trash2 size={14} color={t.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: t.colors.accent }]}
        onPress={openAdd}
      >
        <Plus size={14} color={t.colors.accent} />
        <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('wfrp.corruption.addMutation')}</Text>
      </TouchableOpacity>

      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill as object}
            onPress={() => setAdding(false)}
          />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {tr('wfrp.corruption.addMutation')}
            </Text>

            <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
              <BookOpen size={15} color={t.colors.accent} />
              <Text style={[styles.bookBtnText, { color: t.colors.accentFg }]}>{tr('wfrp.corruption.searchBook')}</Text>
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                {
                  color: t.colors.text,
                  borderColor: t.colors.border,
                  backgroundColor: t.colors.backgroundSecondary,
                },
              ]}
              placeholder={tr('wfrp.corruption.namePlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              value={draft.name}
              onChangeText={v => setDraft(d => ({ ...d, name: v }))}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.corruption.type')}</Text>
            <View style={styles.typeRow}>
              {MUTATION_TYPES.map(mt => {
                const active = draft.type === mt;
                return (
                  <TouchableOpacity
                    key={mt}
                    style={[
                      styles.typeChip,
                      {
                        borderColor: active ? t.colors.accent : t.colors.border,
                        backgroundColor: active
                          ? t.colors.accent + '18'
                          : t.colors.backgroundSecondary,
                      },
                    ]}
                    onPress={() => setDraft(d => ({ ...d, type: mt }))}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: active ? t.colors.accent : t.colors.textMuted },
                      ]}
                    >
                      {mt === 'physical' ? tr('wfrp.corruption.physical') : tr('wfrp.corruption.mental')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: t.colors.border }]}
                onPress={() => setAdding(false)}
              >
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: t.colors.accent }]}
                onPress={save}
              >
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WikiModal
        visible={wikiMutation !== null}
        title={wikiMutation?.name ?? ''}
        subtitle={wikiMutation ? [wikiMutation.type === 'physical' ? tr('wfrp.corruption.physical') : tr('wfrp.corruption.mental'), wikiMutation.page].filter(Boolean).join(' · ') : ''}
        body={wikiMutation?.description ?? ''}
        onClose={() => setWikiId(null)}
      />

      <ContentPicker
        visible={picking}
        category="mutation"
        title={tr('wfrp.corruption.mutations')}
        subtitle={(r) => [(r.kind as string), (r.description as string)].filter(Boolean).join(' · ')}
        onSelect={(r) => setDraft({
          name: r.name,
          type: (r.kind === 'mental' ? 'mental' : 'physical'),
          description: (r.description as string) ?? undefined,
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setPicking(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  numbersRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-start', alignItems: 'flex-start' },
  thresholdBlock: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  thresholdValueBox: { alignItems: 'center', minWidth: 46 },
  thresholdValue: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  thresholdLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  breakdown: { fontSize: 11, marginTop: 6 },
  mutationsBlock: { gap: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mutationName: { flex: 1, fontSize: 14, fontWeight: '500' },
  typePill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  del: { width: 26, alignItems: 'center' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
    justifyContent: 'center',
  },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeChipText: { fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
