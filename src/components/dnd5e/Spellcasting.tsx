import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { confirmRemove } from '@/lib/confirm';
import { abilityModifier } from '@/types/dnd5e';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import { v4 as uuidv4 } from 'uuid';

const ABILITY_LABEL: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

type SpellSlotKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Spell = NonNullable<Dnd5eCharacter['spellcasting']>['spells'][number];

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
};

export function Spellcasting({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const sc = character.spellcasting;
  const [addingSpell, setAddingSpell] = useState(false);
  const [draft, setDraft] = useState<Omit<Spell, 'id'>>({ name: '', level: 0, prepared: true, notes: '' });

  if (!sc) return null;

  const mod = abilityModifier(character.abilities[sc.ability]);
  const saveDC = 8 + character.proficiencyBonus + mod;
  const attackBonus = character.proficiencyBonus + mod;
  const attackStr = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;

  const activeSlots = (Object.entries(sc.slots) as Array<[string, { current: number; max: number }]>)
    .filter(([, s]) => s.max > 0);

  function useSlot(level: SpellSlotKey) {
    if (!onChange || !sc) return;
    const slot = sc.slots[level];
    if (slot.current <= 0) return;
    onChange({ spellcasting: { ...sc, slots: { ...sc.slots, [level]: { ...slot, current: slot.current - 1 } } } });
  }

  function restoreSlot(level: SpellSlotKey) {
    if (!onChange || !sc) return;
    const slot = sc.slots[level];
    if (slot.current >= slot.max) return;
    onChange({ spellcasting: { ...sc, slots: { ...sc.slots, [level]: { ...slot, current: slot.current + 1 } } } });
  }

  function togglePrepared(id: string) {
    if (!onChange || !sc) return;
    onChange({ spellcasting: { ...sc, spells: sc.spells.map(s => s.id === id ? { ...s, prepared: !s.prepared } : s) } });
  }

  function deleteSpell(id: string) {
    if (!onChange || !sc) return;
    onChange({ spellcasting: { ...sc, spells: sc.spells.filter(s => s.id !== id) } });
  }

  function addSpell() {
    if (!onChange || !sc || !draft.name.trim()) return;
    const spell: Spell = { id: uuidv4(), ...draft };
    onChange({ spellcasting: { ...sc, spells: [...sc.spells, spell] } });
    setDraft({ name: '', level: 0, prepared: true, notes: '' });
    setAddingSpell(false);
  }

  const cantrips = sc.spells.filter(s => s.level === 0);
  const leveledSpells = sc.spells.filter(s => s.level > 0);

  return (
    <Section title={tr('dnd.sections.spellcasting')}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { labelKey: 'dnd.spells.ability' as const, val: ABILITY_LABEL[sc.ability] },
          { labelKey: 'dnd.spells.saveDC' as const, val: String(saveDC) },
          { labelKey: 'dnd.spells.atkBonus' as const, val: attackStr },
        ].map(({ labelKey, val }) => (
          <View key={labelKey} style={[styles.statChip, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr(labelKey)}</Text>
            <Text style={[styles.statValue, { color: t.colors.text }]}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Spell slots */}
      {activeSlots.length > 0 && (
        <>
          <Text style={[styles.subheader, { color: t.colors.textSecondary }]}>{tr('dnd.spells.spellSlots')}</Text>
          <View style={styles.slotsRow}>
            {activeSlots.map(([level, slot]) => {
              const lvl = parseInt(level) as SpellSlotKey;
              return (
                <View key={level} style={[styles.slotBox, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
                  <Text style={[styles.slotLevel, { color: t.colors.textSecondary }]}>{tr('dnd.spells.lvl', { n: level })}</Text>
                  <Text style={[styles.slotCount, {
                    color: slot.current > 0 ? t.colors.text : t.colors.textMuted,
                    fontFamily: t.fontFamily.serif,
                  }]}>
                    {slot.current}/{slot.max}
                  </Text>
                  {/* Tappable pips: tap to use, long-press to restore */}
                  <View style={styles.pips}>
                    {Array.from({ length: slot.max }).map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => onChange && (i < slot.current ? useSlot(lvl) : restoreSlot(lvl))}
                        disabled={!onChange}
                      >
                        <View style={[
                          styles.pip,
                          { backgroundColor: i < slot.current ? t.colors.accent : t.colors.border },
                        ]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Cantrips */}
      {cantrips.length > 0 && (
        <>
          <Text style={[styles.subheader, { color: t.colors.textSecondary }]}>{tr('dnd.spells.cantrips')}</Text>
          {cantrips.map(spell => (
            <View key={spell.id} style={styles.spellRow}>
              <Text style={[styles.spellName, { color: t.colors.text, flex: 1 }]}>{spell.name}</Text>
              {spell.notes && <Text style={[styles.spellNotes, { color: t.colors.textMuted }]}>{spell.notes}</Text>}
              {onChange && (
                <TouchableOpacity onPress={() => confirmRemove(tr, tr('dnd.spells.deleteConfirm', { name: spell.name }), () => deleteSpell(spell.id), tr('dnd.spells.deleteTitle'))}>
                  <Trash2 size={13} color={t.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {/* Leveled spells */}
      {leveledSpells.length > 0 && (
        <>
          <Text style={[styles.subheader, { color: t.colors.textSecondary }]}>{tr('dnd.spells.spellsKnown')}</Text>
          {leveledSpells.map(spell => (
            <View key={spell.id} style={styles.spellRow}>
              <TouchableOpacity onPress={() => onChange && togglePrepared(spell.id)} disabled={!onChange}>
                <View style={[styles.lvlBadge, { backgroundColor: spell.prepared ? t.colors.accent : t.colors.border }]}>
                  <Text style={[styles.lvlBadgeText, { color: spell.prepared ? t.colors.accentText : t.colors.textMuted }]}>
                    {spell.level}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={[styles.spellName, {
                flex: 1,
                color: spell.prepared ? t.colors.text : t.colors.textMuted,
                fontWeight: spell.prepared ? '600' : '400',
              }]}>
                {spell.name}
              </Text>
              {spell.notes && <Text style={[styles.spellNotes, { color: t.colors.textMuted }]}>{spell.notes}</Text>}
              {onChange && (
                <TouchableOpacity onPress={() => confirmRemove(tr, tr('dnd.spells.deleteConfirm', { name: spell.name }), () => deleteSpell(spell.id), tr('dnd.spells.deleteTitle'))}>
                  <Trash2 size={13} color={t.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {onChange && (
        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={() => setAddingSpell(true)}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('dnd.spells.addSpell')}</Text>
        </TouchableOpacity>
      )}

      {/* Add spell modal */}
      <Modal visible={addingSpell} transparent animationType="slide" onRequestClose={() => setAddingSpell(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setAddingSpell(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('dnd.spells.addSpell')}</Text>
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('dnd.spells.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} autoFocus />
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('dnd.spells.levelPlaceholder')} placeholderTextColor={t.colors.textMuted} keyboardType="number-pad"
              value={String(draft.level)} onChangeText={v => setDraft(d => ({ ...d, level: parseInt(v) || 0 }))} />
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('dnd.spells.notesPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.notes ?? ''} onChangeText={v => setDraft(d => ({ ...d, notes: v }))} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAddingSpell(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={addSpell}>
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
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '700' },
  subheader: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBox: { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'center', gap: 4, minWidth: 60 },
  slotLevel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  slotCount: { fontSize: 18, fontWeight: '700' },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 8, height: 8, borderRadius: 4 },
  spellRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  spellLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lvlBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lvlBadgeText: { fontSize: 10, fontWeight: '700' },
  spellName: { fontSize: 14 },
  spellNotes: { fontSize: 11, fontStyle: 'italic', flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 4, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
