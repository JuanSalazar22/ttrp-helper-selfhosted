import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, Switch, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TFunc } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { confirmRemove } from '@/lib/confirm';
import { hoverTitle } from '@/lib/a11y';
import {
  CHARACTERISTIC_KEYS, CHARACTERISTIC_LABELS,
  displayBuffs, ENCUMBERED_BUFF_ID,
} from '@/types/wfrp4e';
import type { Wfrp4eCharacter, Buff, BuffEffect, BuffTarget } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const TARGETS: BuffTarget[] = [...CHARACTERISTIC_KEYS, 'movement'];

function targetLabel(target: BuffTarget, tr: TFunc): string {
  if (target === 'movement') return tr('wfrp.fields.move');
  return tr(`wfrp.char.${target}`);
}

type Draft = {
  name: string;
  effects: BuffEffect[];
  active: boolean;
};

const EMPTY_DRAFT: Draft = { name: '', effects: [{ target: 's', value: 10 }], active: true };

export function Buffs({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const stored = character.buffs ?? [];
  const all = displayBuffs(character);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  function openAdd() { setDraft(EMPTY_DRAFT); setEditId(null); setAdding(true); }
  function openEdit(b: Buff) {
    if (b.id === ENCUMBERED_BUFF_ID) return;
    setDraft({ name: b.name, effects: b.effects.map(e => ({ ...e })), active: b.active });
    setEditId(b.id); setAdding(true);
  }

  function save() {
    const name = draft.name.trim();
    if (!name || draft.effects.length === 0) return;
    const effects = draft.effects
      .map(e => ({ target: e.target, value: Math.trunc(e.value || 0) }))
      .filter(e => e.value !== 0);
    if (effects.length === 0) return;
    const fields = { name, effects, active: draft.active };
    if (editId) {
      onChange({ buffs: stored.map(b => b.id === editId ? { ...b, ...fields } : b) });
    } else {
      onChange({ buffs: [...stored, { id: uuidv4(), ...fields }] });
    }
    setAdding(false); setEditId(null); setDraft(EMPTY_DRAFT);
  }

  function toggleActive(id: string, active: boolean) {
    onChange({ buffs: stored.map(b => b.id === id ? { ...b, active } : b) });
  }

  function remove(id: string) {
    const b = stored.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.buffs.removeConfirm', { name: b?.name ?? '' }), () =>
      onChange({ buffs: stored.filter(x => x.id !== id) }));
  }

  function encumberedName(b: Buff): string {
    const level = b.name.startsWith('encumbered:') ? parseInt(b.name.slice('encumbered:'.length), 10) : 1;
    return tr('wfrp.buffs.encumberedTitle', { n: level });
  }

  return (
    <Section title={tr('wfrp.sections.buffs')}>
      {all.length === 0 && (
        <Text style={[styles.empty, { color: t.colors.textMuted }]}>{tr('wfrp.buffs.empty')}</Text>
      )}

      {all.map(b => {
        const virtual = b.id === ENCUMBERED_BUFF_ID;
        const anyPositive = b.effects.some(e => e.value > 0);
        const anyNegative = b.effects.some(e => e.value < 0);
        const rowBg = virtual ? t.colors.backgroundSecondary : 'transparent';
        return (
          <View key={b.id} style={[styles.row, { borderColor: t.colors.border, opacity: b.active ? 1 : 0.45, backgroundColor: rowBg }]}>
            <TouchableOpacity
              style={styles.rowMain}
              activeOpacity={virtual ? 1 : 0.6}
              onPress={virtual ? undefined : () => openEdit(b)}
              disabled={virtual}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: t.colors.text }]} numberOfLines={1}>
                  {virtual ? encumberedName(b) : b.name}
                </Text>
                {virtual && (
                  <Text style={[styles.autoHint, { color: t.colors.textMuted }]}>{tr('wfrp.buffs.autoHint')}</Text>
                )}
                <View style={styles.effectsRow}>
                  {b.effects.map((e, i) => {
                    const sign = e.value >= 0 ? '+' : '−';
                    const color = e.value >= 0 ? t.colors.success : t.colors.danger;
                    return (
                      <View key={i} style={[styles.effectChip, { borderColor: t.colors.border }]}>
                        <Text style={[styles.effectTarget, { color: t.colors.textSecondary }]}>
                          {targetLabel(e.target, tr)}
                        </Text>
                        <Text style={[styles.effectValue, { color }]}>{sign}{Math.abs(e.value)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
            {!virtual && (
              <>
                <Switch
                  value={b.active}
                  onValueChange={v => toggleActive(b.id, v)}
                  trackColor={{ true: t.colors.accent, false: t.colors.border }}
                />
                <TouchableOpacity onPress={() => remove(b.id)} style={styles.del} accessibilityLabel={tr('wfrp.buffs.removeA11y', { name: b.name })} {...hoverTitle(tr('wfrp.buffs.removeA11y', { name: b.name }))}>
                  <Trash2 size={14} color={t.colors.danger} />
                </TouchableOpacity>
              </>
            )}
            {virtual && anyNegative && !anyPositive && (
              <View style={[styles.autoBadge, { borderColor: t.colors.danger }]}>
                <Text style={[styles.autoBadgeText, { color: t.colors.danger }]}>{tr('wfrp.buffs.auto')}</Text>
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAdd}>
        <Plus size={14} color={t.colors.accent} />
        <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('wfrp.buffs.addBuff')}</Text>
      </TouchableOpacity>

      {stored.length > 0 && (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: t.colors.danger, marginTop: 8 }]}
          onPress={() => confirmRemove(tr, tr('wfrp.buffs.clearAllConfirm', { n: stored.length }), () => onChange({ buffs: [] }))}
        >
          <Text style={[styles.addText, { color: t.colors.danger }]}>{tr('wfrp.buffs.clearAll')}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {editId ? tr('wfrp.buffs.editBuff') : tr('wfrp.buffs.addBuff')}
            </Text>

            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.buffs.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))}
            />

            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.buffs.effects')}</Text>
            <ScrollView style={styles.effectsList} contentContainerStyle={{ gap: 10 }}>
              {draft.effects.map((eff, i) => (
                <View key={i} style={[styles.effectEditor, { borderColor: t.colors.border }]}>
                  <View style={styles.chipWrap}>
                    {TARGETS.map(target => {
                      const sel = eff.target === target;
                      return (
                        <TouchableOpacity
                          key={target}
                          onPress={() => setDraft(d => ({
                            ...d,
                            effects: d.effects.map((x, j) => j === i ? { ...x, target } : x),
                          }))}
                          accessibilityLabel={target === 'movement' ? tr('wfrp.fields.movement') : CHARACTERISTIC_LABELS[target]}
                          style={[styles.selChip, {
                            borderColor: sel ? t.colors.accent : t.colors.border,
                            backgroundColor: sel ? t.colors.accent : 'transparent',
                          }]}
                        >
                          <Text style={[styles.selChipText, { color: sel ? t.colors.accentText : t.colors.textMuted }]}>
                            {targetLabel(target, tr)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.effectValueRow}>
                    <TextInput
                      style={[styles.input, styles.valueInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                      keyboardType="numbers-and-punctuation"
                      value={String(eff.value)}
                      onChangeText={v => setDraft(d => ({
                        ...d,
                        effects: d.effects.map((x, j) => j === i ? { ...x, value: parseSignedInt(v) } : x),
                      }))}
                    />
                    <TouchableOpacity
                      onPress={() => setDraft(d => ({ ...d, effects: d.effects.filter((_, j) => j !== i) }))}
                      disabled={draft.effects.length === 1}
                      style={[styles.removeEffect, { opacity: draft.effects.length === 1 ? 0.3 : 1 }]}
                      accessibilityLabel={tr('wfrp.buffs.removeEffect')}
                      {...hoverTitle(tr('wfrp.buffs.removeEffect'))}
                    >
                      <X size={16} color={t.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addEffectBtn, { borderColor: t.colors.accent }]}
              onPress={() => setDraft(d => ({ ...d, effects: [...d.effects, { target: 's', value: 10 }] }))}
            >
              <Plus size={12} color={t.colors.accent} />
              <Text style={[styles.addEffectText, { color: t.colors.accentFg }]}>{tr('wfrp.buffs.addEffect')}</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: draft.name.trim() ? t.colors.accent : t.colors.border }]}
                onPress={save}
                disabled={!draft.name.trim()}
              >
                <Text style={[styles.btnText, { color: draft.name.trim() ? t.colors.accentText : t.colors.textMuted }]}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Section>
  );
}

function parseSignedInt(s: string): number {
  const m = s.match(/^-?\d*/);
  if (!m || m[0] === '' || m[0] === '-') return 0;
  return parseInt(m[0], 10);
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 14, fontWeight: '600' },
  autoHint: { fontSize: 10, marginTop: 2, fontStyle: 'italic' },
  effectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  effectChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  effectTarget: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  effectValue: { fontSize: 13, fontWeight: '700' },
  del: { width: 26, alignItems: 'center' },
  autoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  autoBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', marginTop: 10 },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  effectsList: { maxHeight: 300 },
  effectEditor: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  selChipText: { fontSize: 12, fontWeight: '700' },
  effectValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueInput: { flex: 1, textAlign: 'center' },
  removeEffect: { padding: 6 },
  addEffectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  addEffectText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
