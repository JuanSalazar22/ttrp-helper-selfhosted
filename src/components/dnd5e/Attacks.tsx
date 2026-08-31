import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, Pencil } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { confirmRemove } from '@/lib/confirm';
import { hoverTitle } from '@/lib/a11y';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import { v4 as uuidv4 } from 'uuid';

type Attack = Dnd5eCharacter['attacks'][number];

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
  onRollAttack?: (modifier: number, label: string) => void;
  onRollExpression?: (expr: string, label: string) => void;
};

const EMPTY_ATTACK: Omit<Attack, 'id'> = { name: '', attackBonus: 0, damage: '', notes: '' };

export function Attacks({ character, onChange, onRollAttack, onRollExpression }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [editing, setEditing] = useState<Attack | null>(null);
  const [isNew, setIsNew] = useState(false);

  if (character.attacks.length === 0 && !onChange) return null;

  function openNew() {
    setIsNew(true);
    setEditing({ id: uuidv4(), ...EMPTY_ATTACK });
  }

  function openEdit(a: Attack) {
    setIsNew(false);
    setEditing({ ...a });
  }

  function saveAttack() {
    if (!editing || !onChange) return;
    const list = isNew
      ? [...character.attacks, editing]
      : character.attacks.map(a => a.id === editing.id ? editing : a);
    onChange({ attacks: list });
    setEditing(null);
  }

  function deleteAttack(id: string) {
    if (!onChange) return;
    confirmRemove(tr, tr('dnd.attacks.deleteConfirm'), () =>
      onChange({ attacks: character.attacks.filter(a => a.id !== id) }), tr('dnd.attacks.deleteTitle'));
  }

  return (
    <Section title={tr('dnd.sections.attacks')}>
      <View style={[styles.tableHeader, { borderBottomColor: t.colors.border }]}>
        <Text style={[styles.colName, { color: t.colors.textSecondary }]}>{tr('dnd.attacks.nameCol')}</Text>
        <Text style={[styles.colBonus, { color: t.colors.textSecondary }]}>{tr('dnd.attacks.atkCol')}</Text>
        <Text style={[styles.colDamage, { color: t.colors.textSecondary }]}>{tr('dnd.attacks.damageCol')}</Text>
        {onChange && <View style={styles.colAction} />}
      </View>

      {character.attacks.map((attack, i) => {
        const bonusStr = attack.attackBonus > 0 ? `+${attack.attackBonus}` : attack.attackBonus === 0 ? '—' : `${attack.attackBonus}`;
        return (
          <View key={attack.id}>
            <View style={[styles.row, i % 2 === 1 ? { backgroundColor: t.colors.backgroundSecondary } : {}]}>
              <TouchableOpacity
                style={styles.colName}
                onPress={() => onChange && openEdit(attack)}
                disabled={!onChange}
                activeOpacity={0.7}
              >
                <Text style={[{ color: t.colors.text, fontWeight: '600', fontSize: 13 }]}>
                  {attack.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.colBonus}
                onPress={() => onRollAttack?.(attack.attackBonus, attack.name + ' Attack')}
                disabled={!onRollAttack || attack.attackBonus === 0}
                activeOpacity={0.6}
              >
                <Text style={[{
                  color: onRollAttack && attack.attackBonus !== 0 ? t.colors.accent : t.colors.textMuted,
                  fontWeight: '700',
                  fontFamily: t.fontFamily.serif,
                  fontSize: 16,
                  textAlign: 'center',
                }]}>
                  {bonusStr}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.colDamage}
                onPress={() => {
                  if (!onRollExpression || !attack.damage) return;
                  const expr = attack.damage.split(' ')[0];
                  try { onRollExpression(expr, attack.name + ' Damage'); } catch {}
                }}
                disabled={!onRollExpression || !attack.damage}
                activeOpacity={0.6}
              >
                <Text style={[{ color: onRollExpression && attack.damage ? t.colors.text : t.colors.textMuted, fontSize: 13 }]}>
                  {attack.damage}
                </Text>
              </TouchableOpacity>
              {onChange && (
                <TouchableOpacity
                  style={styles.colAction}
                  onPress={() => deleteAttack(attack.id)}
                  accessibilityLabel={tr('dnd.attacks.deleteA11y', { name: attack.name })}
                  {...hoverTitle(tr('dnd.attacks.deleteA11y', { name: attack.name }))}
                >
                  <Trash2 size={14} color={t.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            {attack.notes && (
              <Text style={[styles.notes, { color: t.colors.textMuted }]}>{attack.notes}</Text>
            )}
          </View>
        );
      })}

      {onChange && (
        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openNew}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('dnd.attacks.addAttack')}</Text>
        </TouchableOpacity>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditing(null)}>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity style={styles.backdrop} onPress={() => setEditing(null)} />
            <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
                {isNew ? tr('dnd.attacks.newAttack') : tr('dnd.attacks.editAttack')}
              </Text>
              {([
                { field: 'name', labelKey: 'dnd.attacks.fieldName', placeholder: 'Longsword' },
                { field: 'damage', labelKey: 'dnd.attacks.fieldDamage', placeholder: '1d8+3 slashing' },
                { field: 'notes', labelKey: 'dnd.attacks.fieldNotes', placeholder: 'Versatile (1d10)' },
              ] as const).map(({ field, labelKey, placeholder }) => (
                <View key={field}>
                  <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr(labelKey)}</Text>
                  <TextInput
                    style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                    value={editing[field] ?? ''}
                    onChangeText={v => setEditing(e => e ? { ...e, [field]: v } : e)}
                    placeholder={placeholder}
                    placeholderTextColor={t.colors.textMuted}
                  />
                </View>
              ))}
              <View>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('dnd.attacks.fieldAttackBonus')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  value={String(editing.attackBonus)}
                  onChangeText={v => setEditing(e => e ? { ...e, attackBonus: parseInt(v) || 0 } : e)}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={t.colors.textMuted}
                />
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setEditing(null)}>
                  <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={saveAttack}>
                  <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4 },
  notes: { fontSize: 11, paddingHorizontal: 4, paddingBottom: 4, fontStyle: 'italic' },
  colName: { flex: 2.5, fontSize: 13 },
  colBonus: { flex: 1, textAlign: 'center', fontSize: 13 },
  colDamage: { flex: 2.5, fontSize: 13 },
  colAction: { width: 28, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 4, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
