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
import { hoverTitle } from '@/lib/a11y';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import { v4 as uuidv4 } from 'uuid';

type Item = Dnd5eCharacter['inventory'][number];
type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
};

const CURRENCY_ORDER = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
const CURRENCY_LABEL: Record<string, string> = {
  pp: 'PP', gp: 'GP', ep: 'EP', sp: 'SP', cp: 'CP',
};

export function Inventory({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [addingItem, setAddingItem] = useState(false);
  const [draft, setDraft] = useState<Omit<Item, 'id'>>({ name: '', qty: 1, weight: 0 });

  const totalWeight = character.inventory.reduce((sum, item) => sum + item.weight * item.qty, 0);
  const currency = character.currency;

  function adjustQty(id: string, delta: number) {
    if (!onChange) return;
    onChange({
      inventory: character.inventory.map(item =>
        item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
      ),
    });
  }

  function deleteItem(id: string) {
    if (!onChange) return;
    confirmRemove(tr, tr('dnd.inventory.removeConfirm'), () =>
      onChange({ inventory: character.inventory.filter(i => i.id !== id) }));
  }

  function addItem() {
    if (!onChange || !draft.name.trim()) return;
    onChange({ inventory: [...character.inventory, { id: uuidv4(), ...draft }] });
    setDraft({ name: '', qty: 1, weight: 0 });
    setAddingItem(false);
  }

  return (
    <Section title={tr('dnd.sections.inventory')}>
      {/* Currency */}
      <View style={styles.currencyRow}>
        {CURRENCY_ORDER.map(key => {
          const val = currency[key];
          if (val === 0 && !onChange) return null;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.coinChip, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}
              disabled={!onChange}
              activeOpacity={0.7}
            >
              <Text style={[styles.coinVal, { color: val > 0 ? t.colors.gold : t.colors.textMuted, fontFamily: t.fontFamily.serif }]}>
                {val}
              </Text>
              <Text style={[styles.coinLabel, { color: t.colors.textSecondary }]}>{CURRENCY_LABEL[key]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.weightLine, { color: t.colors.textSecondary }]}>
        {tr('dnd.inventory.totalWeight', { w: totalWeight.toFixed(1) })}
      </Text>

      <View style={[styles.table, { borderColor: t.colors.border }]}>
        <View style={[styles.tableHeader, { borderBottomColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
          <Text style={[styles.colItem, { color: t.colors.textSecondary }]}>{tr('dnd.inventory.colItem')}</Text>
          <Text style={[styles.colQtyHeader, { color: t.colors.textSecondary }]}>{tr('dnd.inventory.colQty')}</Text>
          <Text style={[styles.colWeight, { color: t.colors.textSecondary }]}>{tr('dnd.inventory.colWeight')}</Text>
          {onChange && <View style={styles.colDel} />}
        </View>
        {character.inventory.map((item, i) => {
          const removeLabel = tr('dnd.inventory.removeItemA11y', { name: item.name });
          return (
          <View
            key={item.id}
            style={[
              styles.tableRow,
              { borderTopColor: t.colors.border },
              i % 2 === 1 ? { backgroundColor: t.colors.backgroundSecondary } : {},
            ]}
          >
            <View style={[styles.colItem, styles.itemCell]}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{item.name}</Text>
              {item.equipped && <Text style={[styles.equippedTag, { color: t.colors.accent }]}>{tr('dnd.inventory.equipped')}</Text>}
            </View>

            {onChange ? (
              <View style={[styles.colQtyHeader, styles.qtyControl]}>
                <TouchableOpacity style={[styles.qtyBtn, { borderColor: t.colors.border }]}
                  onPress={() => adjustQty(item.id, -1)}>
                  <Text style={[styles.qtyBtnText, { color: t.colors.textMuted }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyVal, { color: t.colors.text }]}>{item.qty}</Text>
                <TouchableOpacity style={[styles.qtyBtn, { borderColor: t.colors.border }]}
                  onPress={() => adjustQty(item.id, +1)}>
                  <Text style={[styles.qtyBtnText, { color: t.colors.textMuted }]}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.colQtyHeader, styles.cellText, { color: t.colors.textSecondary, textAlign: 'center' }]}>
                {item.qty}
              </Text>
            )}

            <Text style={[styles.colWeight, styles.cellText, { color: t.colors.textMuted }]}>{item.weight}</Text>
            {onChange && (
              <TouchableOpacity
                style={styles.colDel}
                onPress={() => deleteItem(item.id)}
                accessibilityLabel={removeLabel}
                {...hoverTitle(removeLabel)}
              >
                <Trash2 size={13} color={t.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
          );
        })}
      </View>

      {onChange && (
        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={() => setAddingItem(true)}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('dnd.inventory.addItem')}</Text>
        </TouchableOpacity>
      )}

      {/* Add item modal */}
      <Modal visible={addingItem} transparent animationType="slide" onRequestClose={() => setAddingItem(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setAddingItem(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('dnd.inventory.addItem')}</Text>
            <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('dnd.inventory.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} autoFocus />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('dnd.inventory.fieldQuantity')}</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" value={String(draft.qty)}
                  onChangeText={v => setDraft(d => ({ ...d, qty: parseInt(v) || 1 }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('dnd.inventory.fieldWeight')}</Text>
                <TextInput style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="decimal-pad" value={String(draft.weight)}
                  onChangeText={v => setDraft(d => ({ ...d, weight: parseFloat(v) || 0 }))} />
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAddingItem(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={addItem}>
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
  currencyRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  coinChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2, minWidth: 46 },
  coinVal: { fontSize: 16, fontWeight: '700' },
  coinLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  weightLine: { fontSize: 11, marginBottom: 10 },
  table: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, alignItems: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, alignItems: 'center' },
  colItem: { flex: 3 },
  colQtyHeader: { flex: 1.4, textAlign: 'center', fontSize: 13 },
  colWeight: { flex: 1, textAlign: 'right', fontSize: 13 },
  colDel: { width: 28, alignItems: 'center' },
  itemCell: { gap: 2 },
  itemName: { fontSize: 13 },
  equippedTag: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  cellText: { fontSize: 13 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  qtyBtn: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 14, lineHeight: 16 },
  qtyVal: { fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 8, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
