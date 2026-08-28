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
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Spell = Wfrp4eCharacter['spells'][number];
type Prayer = Wfrp4eCharacter['prayers'][number];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const EMPTY_SPELL: Omit<Spell, 'id'> = {
  name: '', lore: '', castingNumber: 0, range: '', target: '', duration: '', effect: '', page: undefined,
};

const EMPTY_PRAYER: Omit<Prayer, 'id'> = {
  name: '', god: '', range: '', target: '', duration: '', effect: '', page: undefined,
};

export function Magic({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();

  // ── Spell modal state ────────────────────────────────────────────────────
  const [spellEditId, setSpellEditId] = useState<string | null>(null);
  const [spellAdding, setSpellAdding] = useState(false);
  const [spellDraft, setSpellDraft] = useState<Omit<Spell, 'id'>>(EMPTY_SPELL);
  const [spellPicking, setSpellPicking] = useState(false);
  const [prayerPicking, setPrayerPicking] = useState(false);
  const [wiki, setWiki] = useState<{ title: string; subtitle: string; body: string } | null>(null);

  function openAddSpell() {
    setSpellDraft(EMPTY_SPELL);
    setSpellEditId(null);
    setSpellAdding(true);
  }
  function openEditSpell(s: Spell) {
    setSpellDraft({
      name: s.name, lore: s.lore, castingNumber: s.castingNumber,
      range: s.range, target: s.target, duration: s.duration, effect: s.effect, page: s.page,
    });
    setSpellEditId(s.id);
    setSpellAdding(true);
  }
  function saveSpell() {
    if (!spellDraft.name.trim()) return;
    if (spellEditId) {
      onChange({
        spells: character.spells.map(x =>
          x.id === spellEditId ? { ...x, ...spellDraft, name: spellDraft.name.trim() } : x
        ),
      });
    } else {
      onChange({
        spells: [...character.spells, { id: uuidv4(), ...spellDraft, name: spellDraft.name.trim() }],
      });
    }
    setSpellAdding(false);
    setSpellEditId(null);
    setSpellDraft(EMPTY_SPELL);
  }
  function removeSpell(id: string) {
    const s = character.spells.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.magic.removeSpellConfirm', { name: s?.name ?? '' }), () =>
      onChange({ spells: character.spells.filter(x => x.id !== id) }));
  }

  // ── Prayer modal state ───────────────────────────────────────────────────
  const [prayerEditId, setPrayerEditId] = useState<string | null>(null);
  const [prayerAdding, setPrayerAdding] = useState(false);
  const [prayerDraft, setPrayerDraft] = useState<Omit<Prayer, 'id'>>(EMPTY_PRAYER);

  function openAddPrayer() {
    setPrayerDraft(EMPTY_PRAYER);
    setPrayerEditId(null);
    setPrayerAdding(true);
  }
  function openEditPrayer(p: Prayer) {
    setPrayerDraft({
      name: p.name, god: p.god,
      range: p.range, target: p.target, duration: p.duration, effect: p.effect, page: p.page,
    });
    setPrayerEditId(p.id);
    setPrayerAdding(true);
  }
  function savePrayer() {
    if (!prayerDraft.name.trim()) return;
    if (prayerEditId) {
      onChange({
        prayers: character.prayers.map(x =>
          x.id === prayerEditId ? { ...x, ...prayerDraft, name: prayerDraft.name.trim() } : x
        ),
      });
    } else {
      onChange({
        prayers: [...character.prayers, { id: uuidv4(), ...prayerDraft, name: prayerDraft.name.trim() }],
      });
    }
    setPrayerAdding(false);
    setPrayerEditId(null);
    setPrayerDraft(EMPTY_PRAYER);
  }
  function removePrayer(id: string) {
    const p = character.prayers.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.magic.removePrayerConfirm', { name: p?.name ?? '' }), () =>
      onChange({ prayers: character.prayers.filter(x => x.id !== id) }));
  }

  return (
    <>
      {/* ── Spells ─────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.magic.spells')}>
        {character.spells.map(s => (
          <View key={s.id} style={[styles.row, { borderColor: t.colors.border }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditSpell(s)}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{s.name}</Text>
              <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
                {[s.lore ? tr('wfrp.magic.lorePrefixed', { lore: s.lore }) : '', `CN ${s.castingNumber}`].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setWiki({ title: s.name, subtitle: [s.lore ? tr('wfrp.magic.lorePrefixed', { lore: s.lore }) : '', `CN ${s.castingNumber}`, s.range, s.target, s.duration, s.page].filter(Boolean).join(' · '), body: s.effect })}
              style={styles.del} accessibilityLabel={tr('wfrp.magic.infoFor', { name: s.name })}
            >
              <Info size={14} color={t.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeSpell(s.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAddSpell}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.magic.addSpell')}</Text>
        </TouchableOpacity>
      </Section>

      {/* ── Prayers ────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.magic.prayers')}>
        {character.prayers.map(p => (
          <View key={p.id} style={[styles.row, { borderColor: t.colors.border }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditPrayer(p)}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{p.name}</Text>
              {!!p.god && <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>{p.god}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setWiki({ title: p.name, subtitle: [p.god, p.range, p.target, p.duration, p.page].filter(Boolean).join(' · '), body: p.effect })}
              style={styles.del} accessibilityLabel={tr('wfrp.magic.infoFor', { name: p.name })}
            >
              <Info size={14} color={t.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removePrayer(p.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAddPrayer}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.magic.addPrayer')}</Text>
        </TouchableOpacity>
      </Section>

      {/* ── Spell modal ────────────────────────────────────────────────── */}
      <Modal visible={spellAdding} transparent animationType="slide" onRequestClose={() => setSpellAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setSpellAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {spellEditId ? tr('wfrp.magic.editSpell') : tr('wfrp.magic.addSpell')}
            </Text>
            {!spellEditId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setSpellPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accent }]}>{tr('wfrp.magic.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.spellNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={spellDraft.name} onChangeText={v => setSpellDraft(d => ({ ...d, name: v }))}
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 2 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.lore')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.magic.lorePlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={spellDraft.lore} onChangeText={v => setSpellDraft(d => ({ ...d, lore: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.cn')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={spellDraft.castingNumber === 0 ? '' : String(spellDraft.castingNumber)}
                  onChangeText={v => setSpellDraft(d => ({ ...d, castingNumber: parseInt(v) || 0 }))}
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.range')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.magic.rangePlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={spellDraft.range} onChangeText={v => setSpellDraft(d => ({ ...d, range: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.target')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.magic.targetPlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={spellDraft.target} onChangeText={v => setSpellDraft(d => ({ ...d, target: v }))}
                />
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.duration')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.durationPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={spellDraft.duration} onChangeText={v => setSpellDraft(d => ({ ...d, duration: v }))}
            />
            <TextInput
              style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.effect')} placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={spellDraft.effect} onChangeText={v => setSpellDraft(d => ({ ...d, effect: v }))}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setSpellAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={saveSpell}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Prayer modal ───────────────────────────────────────────────── */}
      <Modal visible={prayerAdding} transparent animationType="slide" onRequestClose={() => setPrayerAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setPrayerAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {prayerEditId ? tr('wfrp.magic.editPrayer') : tr('wfrp.magic.addPrayer')}
            </Text>
            {!prayerEditId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setPrayerPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accent }]}>{tr('wfrp.magic.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.prayerNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={prayerDraft.name} onChangeText={v => setPrayerDraft(d => ({ ...d, name: v }))}
            />
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.god')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.godPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={prayerDraft.god} onChangeText={v => setPrayerDraft(d => ({ ...d, god: v }))}
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.range')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.magic.rangePlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={prayerDraft.range} onChangeText={v => setPrayerDraft(d => ({ ...d, range: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.target')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.magic.targetPlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={prayerDraft.target} onChangeText={v => setPrayerDraft(d => ({ ...d, target: v }))}
                />
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.magic.duration')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.durationPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={prayerDraft.duration} onChangeText={v => setPrayerDraft(d => ({ ...d, duration: v }))}
            />
            <TextInput
              style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.magic.effect')} placeholderTextColor={t.colors.textMuted} multiline textAlignVertical="top"
              value={prayerDraft.effect} onChangeText={v => setPrayerDraft(d => ({ ...d, effect: v }))}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setPrayerAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={savePrayer}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WikiModal
        visible={wiki !== null}
        title={wiki?.title ?? ''}
        subtitle={wiki?.subtitle ?? ''}
        body={wiki?.body ?? ''}
        onClose={() => setWiki(null)}
      />

      <ContentPicker
        visible={spellPicking}
        category="spell"
        title={tr('wfrp.magic.spells')}
        subtitle={(r) => [r.cn != null ? `CN ${r.cn}` : '', r.range as string].filter(Boolean).join(' · ')}
        onSelect={(r) => setSpellDraft({
          name: r.name,
          lore: '',
          castingNumber: (r.cn as number) ?? 0,
          range: (r.range as string) ?? '',
          target: (r.target as string) ?? '',
          duration: (r.duration as string) ?? '',
          effect: (r.description as string) ?? '',
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setSpellPicking(false)}
      />

      <ContentPicker
        visible={prayerPicking}
        category="prayer"
        title={tr('wfrp.magic.prayers')}
        subtitle={(r) => (r.range as string) || ''}
        onSelect={(r) => setPrayerDraft({
          name: r.name,
          god: '',
          range: (r.range as string) ?? '',
          target: (r.target as string) ?? '',
          duration: (r.duration as string) ?? '',
          effect: (r.description as string) ?? '',
          page: (r.page as string) ?? undefined,
        })}
        onClose={() => setPrayerPicking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemSub: { fontSize: 12, marginTop: 2 },
  del: { width: 26, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
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
