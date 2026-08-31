import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, BookOpen, Info } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import { encumbranceMaxValue, characteristicBonus, encumbranceCarried, encumbranceLevel, encumbrancePenalty, defaultContainerCapacity } from '@/types/wfrp4e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Trapping = Wfrp4eCharacter['trappings'][number];
type CoinKey = 'gold' | 'silver' | 'brass';
const COIN_LABEL_KEY: Record<CoinKey, TKey> = {
  gold: 'wfrp.status.gold',
  silver: 'wfrp.status.silver',
  brass: 'wfrp.status.brass',
};

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const EMPTY: Omit<Trapping, 'id'> = { name: '', encumbrance: 0, qty: 1, notes: '', equipped: false, capacity: 0 };

export function Trappings({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Trapping, 'id'>>(EMPTY);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);
  const wikiItem = wikiId ? character.trappings.find(x => x.id === wikiId) ?? null : null;

  // ── Encumbrance totals (with equipped −1 discount) ─────────────────────
  const carried = encumbranceCarried(character);
  const level = encumbranceLevel(character);
  const penalty = encumbrancePenalty(character);

  // ── Modal helpers ───────────────────────────────────────────────────────
  function openAdd() { setDraft(EMPTY); setEditId(null); setAdding(true); }
  function openEdit(item: Trapping) {
    setDraft({
      name: item.name, encumbrance: item.encumbrance, qty: item.qty,
      notes: item.notes ?? '', equipped: item.equipped === true, capacity: item.capacity ?? 0,
      description: item.description, page: item.page,
    });
    setEditId(item.id);
    setAdding(true);
  }
  function toggleEquipped(id: string) {
    onChange({
      trappings: character.trappings.map(x =>
        x.id === id ? { ...x, equipped: !x.equipped } : x
      ),
    });
  }
  function save() {
    if (!draft.name.trim()) return;
    if (editId) {
      onChange({
        trappings: character.trappings.map(x =>
          x.id === editId ? { ...x, ...draft, name: draft.name.trim() } : x
        ),
      });
    } else {
      onChange({
        trappings: [...character.trappings, { id: uuidv4(), ...draft, name: draft.name.trim() }],
      });
    }
    setAdding(false);
    setEditId(null);
    setDraft(EMPTY);
  }
  function remove(id: string) {
    const item = character.trappings.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.trappings.removeConfirm', { name: item?.name ?? '' }), () =>
      onChange({ trappings: character.trappings.filter(x => x.id !== id) }));
  }

  const encMax = encumbranceMaxValue(character);
  const sb = characteristicBonus(character, 's');
  const tb = characteristicBonus(character, 't');
  const encMod = character.encumbranceModifier ?? 0;
  const capBonus = encMax - sb - tb - encMod;

  return (
    <Section title={tr('wfrp.trappings.title')}>
      {/* ── Encumbrance summary (max = SB + TB + modifier) ──────────────── */}
      <View style={styles.encRow}>
        <Text style={[styles.encLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.encumbrance')}</Text>
        <View style={styles.encValues}>
          <Text style={[styles.encCarried, { color: carried > encMax ? t.colors.danger : t.colors.text }]}>
            {carried}
          </Text>
          <Text style={[styles.encSep, { color: t.colors.textMuted }]}> / {encMax}</Text>
        </View>
      </View>
      <View style={styles.encBreakdownRow}>
        <Text style={[styles.encBreakdown, { color: t.colors.textMuted }]}>
          {tr('wfrp.charBonus.s')} {sb} + {tr('wfrp.charBonus.t')} {tb} + mod {encMod}{capBonus !== 0 ? ` + cap ${capBonus}` : ''}
        </Text>
        <EditableNumber
          value={encMod}
          label={tr('wfrp.fields.mod')}
          size="sm"
          onSave={(v) => onChange({ encumbranceModifier: v })}
        />
      </View>

      {level > 0 && (
        <View style={[styles.encBanner, { borderColor: t.colors.danger, backgroundColor: t.colors.backgroundSecondary }]}>
          <Text style={[styles.encBannerTitle, { color: t.colors.danger }]}>
            {tr('wfrp.trappings.encumberedTitle', { n: level })}
          </Text>
          <Text style={[styles.encBannerBody, { color: t.colors.textSecondary }]}>
            {tr('wfrp.trappings.encumberedBody', { move: penalty.movement, test: penalty.test })}
          </Text>
        </View>
      )}

      {/* ── Trappings list ──────────────────────────────────────────────── */}
      {character.trappings.map(item => (
        <View key={item.id} style={[styles.row, { borderColor: t.colors.border }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEdit(item)}>
            <Text style={[styles.itemName, { color: t.colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
              Enc {item.encumbrance} · ×{item.qty}
            </Text>
          </TouchableOpacity>
          {!!item.capacity && (
            <View style={[styles.capBadge, { borderColor: t.colors.accent }]}>
              <Text style={[styles.capBadgeText, { color: t.colors.accentFg }]}>
                {tr('wfrp.trappings.capacityBadge', { n: item.capacity })}
              </Text>
            </View>
          )}
          {(!!item.description || !!item.page) && (
            <TouchableOpacity onPress={() => setWikiId(item.id)} style={styles.del} accessibilityLabel={tr('wfrp.trappings.infoFor', { name: item.name })}>
              <Info size={14} color={t.colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => toggleEquipped(item.id)}
            style={[
              styles.equipChip,
              { borderColor: item.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: item.equipped ? t.colors.accent : 'transparent' },
            ]}
            accessibilityLabel={tr(item.equipped ? 'wfrp.equip.unequipA11y' : 'wfrp.equip.equipA11y', { name: item.name })}
          >
            <Text style={[styles.equipChipText, { color: item.equipped ? t.colors.accentText : t.colors.textSecondary }]}>
              {tr(item.equipped ? 'wfrp.equip.equipped' : 'wfrp.equip.equip')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(item.id)} style={styles.del}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.addBtn, { flex: 1, borderColor: t.colors.accent }]} onPress={openAdd}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accentFg }]}>{tr('wfrp.trappings.addItem')}</Text>
        </TouchableOpacity>
        {character.trappings.length > 0 && (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: t.colors.danger }]}
            onPress={() => confirmRemove(tr, tr('wfrp.trappings.clearAllConfirm', { n: character.trappings.length }), () => onChange({ trappings: [] }))}
          >
            <Text style={[styles.addText, { color: t.colors.danger }]}>{tr('wfrp.trappings.clearAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Wealth ──────────────────────────────────────────────────────── */}
      <Text style={[styles.wealthLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.wealth')}</Text>
      <View style={styles.wealthRow}>
        {(['gold', 'silver', 'brass'] as const).map(coin => {
          const setCoin = (v: number) => onChange({ wealth: { ...character.wealth, [coin]: Math.max(0, v) } });
          return (
            <View key={coin} style={[styles.coinChip, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
              <View style={styles.coinStepper}>
                <TouchableOpacity
                  style={[styles.coinBtn, { borderColor: t.colors.border }]}
                  onPress={() => setCoin(character.wealth[coin] - 1)}
                  accessibilityLabel={tr('wfrp.trappings.decreaseCoin', { coin: tr(COIN_LABEL_KEY[coin]) })}
                >
                  <Text style={[styles.coinBtnText, { color: t.colors.textMuted }]}>−</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <EditableNumber
                    value={character.wealth[coin]}
                    label={tr(COIN_LABEL_KEY[coin])}
                    size="sm"
                    onSave={setCoin}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.coinBtn, { borderColor: t.colors.accent }]}
                  onPress={() => setCoin(character.wealth[coin] + 1)}
                  accessibilityLabel={tr('wfrp.trappings.increaseCoin', { coin: tr(COIN_LABEL_KEY[coin]) })}
                >
                  <Text style={[styles.coinBtnText, { color: t.colors.accentFg }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Add / Edit modal ────────────────────────────────────────────── */}
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {editId ? tr('wfrp.trappings.editItem') : tr('wfrp.trappings.addItem')}
            </Text>
            {!editId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accentFg }]}>{tr('wfrp.trappings.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.trappings.namePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))}
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.encumbrance')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={draft.encumbrance === 0 ? '' : String(draft.encumbrance)}
                  onChangeText={v => setDraft(d => ({ ...d, encumbrance: parseInt(v) || 0 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.qty')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="1" placeholderTextColor={t.colors.textMuted}
                  value={draft.qty === 0 ? '' : String(draft.qty)}
                  onChangeText={v => setDraft(d => ({ ...d, qty: parseInt(v) || 1 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.trappings.capacity')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={draft.capacity ? String(draft.capacity) : ''}
                  onChangeText={v => setDraft(d => ({ ...d, capacity: Math.max(0, parseInt(v) || 0) }))}
                />
                <Text style={[styles.capHint, { color: t.colors.textMuted }]}>{tr('wfrp.trappings.capacityHint')}</Text>
              </View>
            </View>
            <TextInput
              style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.trappings.notesPlaceholder')} placeholderTextColor={t.colors.textMuted}
              multiline textAlignVertical="top"
              value={draft.notes} onChangeText={v => setDraft(d => ({ ...d, notes: v }))}
            />
            <TouchableOpacity
              style={[styles.equipRow, { borderColor: draft.equipped ? t.colors.accent : t.colors.border }]}
              onPress={() => setDraft(d => ({ ...d, equipped: !d.equipped }))}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                { borderColor: draft.equipped ? t.colors.accent : t.colors.border,
                  backgroundColor: draft.equipped ? t.colors.accent : 'transparent' },
              ]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.equipRowLabel, { color: t.colors.text }]}>{tr('wfrp.equip.equipped')}</Text>
                <Text style={[styles.equipRowHint, { color: t.colors.textMuted }]}>{tr('wfrp.equip.hint')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={save}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('wfrp.trappings.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WikiModal
        visible={wikiItem !== null}
        title={wikiItem?.name ?? ''}
        subtitle={wikiItem ? [`Enc ${wikiItem.encumbrance}`, wikiItem.page].filter(Boolean).join(' · ') : ''}
        body={wikiItem?.description ?? ''}
        onClose={() => setWikiId(null)}
      />

      <ContentPicker
        visible={picking}
        category="trapping"
        title={tr('wfrp.trappings.title')}
        subtitle={(r) => [r.enc != null ? `Enc ${r.enc}` : '', (r.description as string) || ''].filter(Boolean).join(' · ')}
        onSelect={(r) => setDraft({
          name: r.name,
          encumbrance: (r.enc as number) ?? 0,
          qty: 1,
          notes: '',
          equipped: false,
          capacity: defaultContainerCapacity(r.name),
          description: (r.description as string) ?? undefined,
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setPicking(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  // Encumbrance
  encRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  encLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  encValues: { flexDirection: 'row', alignItems: 'center' },
  encCarried: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  encSep: { fontSize: 18, fontWeight: '400', marginHorizontal: 2 },
  encBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -6, marginBottom: 14 },
  encBreakdown: { fontSize: 11, fontWeight: '600' },
  encBanner: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 14, gap: 2 },
  encBannerTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  encBannerBody: { fontSize: 12 },
  equipChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginRight: 6 },
  equipChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  capBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginRight: 6 },
  capBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  equipRowLabel: { fontSize: 14, fontWeight: '600' },
  equipRowHint: { fontSize: 11, marginTop: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2 },
  // List rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemSub: { fontSize: 12, marginTop: 2 },
  del: { width: 26, alignItems: 'center' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 8 },
  clearBtn: { padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  addText: { fontSize: 13, fontWeight: '600' },
  // Wealth
  wealthLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  wealthRow: { flexDirection: 'row', gap: 8 },
  coinChip: { flex: 1 },
  coinStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinBtn: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  coinBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 18 },
  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  capHint: { fontSize: 11, marginTop: -4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 64 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
