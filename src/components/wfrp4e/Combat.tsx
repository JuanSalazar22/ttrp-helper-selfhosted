import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Plus, Trash2, BookOpen } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { ArmourBodyMap } from '@/components/wfrp4e/ArmourBodyMap';
import { confirmRemove } from '@/lib/confirm';
import { isWeapon, isArmour, weaponFromRecord, armourFromRecord } from '@/lib/wfrpTrappings';
import { armourPointsByLocation } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, ArmourLocation } from '@/types/wfrp4e';

type Weapon = Wfrp4eCharacter['weapons'][number];
type Armour = Wfrp4eCharacter['armour'][number];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const EMPTY_WEAPON: Omit<Weapon, 'id'> = {
  name: '', group: '', damage: '', range: '', encumbrance: 0, qualities: '', notes: '', equipped: false,
};

const EMPTY_ARMOUR: Omit<Armour, 'id'> = {
  name: '', locations: [], encumbrance: 0, ap: 0, qualities: '', equipped: false,
};

export function Combat({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();

  // ── Weapons modal state ──────────────────────────────────────────────────
  const [weaponEditId, setWeaponEditId] = useState<string | null>(null);
  const [weaponAdding, setWeaponAdding] = useState(false);
  const [weaponDraft, setWeaponDraft] = useState<Omit<Weapon, 'id'>>(EMPTY_WEAPON);
  const [weaponPicking, setWeaponPicking] = useState(false);
  const [armourPicking, setArmourPicking] = useState(false);

  function openAddWeapon() {
    setWeaponDraft(EMPTY_WEAPON);
    setWeaponEditId(null);
    setWeaponAdding(true);
  }
  function openEditWeapon(w: Weapon) {
    setWeaponDraft({
      name: w.name, group: w.group, damage: w.damage, range: w.range,
      encumbrance: w.encumbrance, qualities: w.qualities, notes: w.notes ?? '',
      equipped: w.equipped === true,
    });
    setWeaponEditId(w.id);
    setWeaponAdding(true);
  }
  function toggleWeaponEquipped(id: string) {
    onChange({
      weapons: character.weapons.map(x =>
        x.id === id ? { ...x, equipped: !x.equipped } : x
      ),
    });
  }
  function saveWeapon() {
    if (!weaponDraft.name.trim()) return;
    if (weaponEditId) {
      onChange({
        weapons: character.weapons.map(x =>
          x.id === weaponEditId ? { ...x, ...weaponDraft, name: weaponDraft.name.trim() } : x
        ),
      });
    } else {
      onChange({
        weapons: [...character.weapons, { id: uuidv4(), ...weaponDraft, name: weaponDraft.name.trim() }],
      });
    }
    setWeaponAdding(false);
    setWeaponEditId(null);
    setWeaponDraft(EMPTY_WEAPON);
  }
  function removeWeapon(id: string) {
    const w = character.weapons.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.combat.removeWeaponConfirm', { name: w?.name ?? tr('wfrp.combat.thisWeapon') }), () =>
      onChange({ weapons: character.weapons.filter(x => x.id !== id) }));
  }

  // ── Armour modal state ───────────────────────────────────────────────────
  const [armourEditId, setArmourEditId] = useState<string | null>(null);
  const [armourAdding, setArmourAdding] = useState(false);
  const [armourDraft, setArmourDraft] = useState<Omit<Armour, 'id'> & { locationsRaw: string }>({
    ...EMPTY_ARMOUR, locationsRaw: '',
  });

  function openAddArmour() {
    setArmourDraft({ ...EMPTY_ARMOUR, locationsRaw: '' });
    setArmourEditId(null);
    setArmourAdding(true);
  }
  function openEditArmour(a: Armour) {
    setArmourDraft({
      name: a.name, locations: a.locations, encumbrance: a.encumbrance,
      ap: a.ap, qualities: a.qualities, locationsRaw: a.locations.join(', '),
      equipped: a.equipped === true,
    });
    setArmourEditId(a.id);
    setArmourAdding(true);
  }
  function toggleArmourEquipped(id: string) {
    onChange({
      armour: character.armour.map(x =>
        x.id === id ? { ...x, equipped: !x.equipped } : x
      ),
    });
  }
  function saveArmour() {
    if (!armourDraft.name.trim()) return;
    const locations = armourDraft.locationsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const patch = {
      name: armourDraft.name.trim(),
      locations,
      encumbrance: armourDraft.encumbrance,
      ap: armourDraft.ap,
      qualities: armourDraft.qualities,
      equipped: armourDraft.equipped,
    };
    if (armourEditId) {
      onChange({
        armour: character.armour.map(x =>
          x.id === armourEditId ? { ...x, ...patch } : x
        ),
      });
    } else {
      onChange({
        armour: [...character.armour, { id: uuidv4(), ...patch }],
      });
    }
    setArmourAdding(false);
    setArmourEditId(null);
    setArmourDraft({ ...EMPTY_ARMOUR, locationsRaw: '' });
  }
  function removeArmour(id: string) {
    const a = character.armour.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.combat.removeArmourConfirm', { name: a?.name ?? tr('wfrp.combat.thisArmour') }), () =>
      onChange({ armour: character.armour.filter(x => x.id !== id) }));
  }

  const ap = character.armourPoints;
  function setAP(loc: ArmourLocation, value: number) {
    onChange({ armourPoints: { ...character.armourPoints, [loc]: value } });
  }
  // Replace the manual AP boxes with values summed from equipped armour items.
  function autoFillAP() {
    onChange({ armourPoints: armourPointsByLocation(character) });
  }

  return (
    <>
      {/* ── Weapons ────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.combat.weapons')}>
        {character.weapons.map(w => (
          <View key={w.id} style={[styles.row, { borderColor: t.colors.border }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditWeapon(w)}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{w.name}</Text>
              <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
                {[w.damage, w.group].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.encLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.enc', { n: w.encumbrance })}</Text>
            <TouchableOpacity
              onPress={() => toggleWeaponEquipped(w.id)}
              style={[styles.equipChip, {
                borderColor: w.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: w.equipped ? t.colors.accent : 'transparent',
              }]}
              accessibilityLabel={tr(w.equipped ? 'wfrp.equip.unequipA11y' : 'wfrp.equip.equipA11y', { name: w.name })}
            >
              <Text style={[styles.equipChipText, { color: w.equipped ? t.colors.accentText : t.colors.textSecondary }]}>
                {tr(w.equipped ? 'wfrp.equip.equipped' : 'wfrp.equip.equip')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeWeapon(w.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAddWeapon}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.combat.addWeapon')}</Text>
        </TouchableOpacity>
      </Section>

      {/* ── Armour ─────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.combat.armour')}>
        <ArmourBodyMap armourPoints={ap} />

        {/* Armour Points — editable per hit location, laid out anatomically like the sheet */}
        <View style={styles.apBlock}>
          <View style={styles.apHeader}>
            <Text style={[styles.apLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.apTitle')}</Text>
            <TouchableOpacity onPress={autoFillAP} style={[styles.autoBtn, { borderColor: t.colors.accent }]} activeOpacity={0.7}>
              <Text style={[styles.autoBtnText, { color: t.colors.accent }]}>{tr('wfrp.combat.apAutoFill')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.apGrid}>
            <View style={styles.apGridRow}>
              <View style={styles.apCell}><EditableNumber value={ap.head} label={tr('wfrp.combat.loc.head')} onSave={v => setAP('head', v)} min={0} size="sm" /></View>
              <View style={styles.apCell} />
              <View style={styles.apCell}><EditableNumber value={ap.shield} label={tr('wfrp.combat.loc.shield')} onSave={v => setAP('shield', v)} min={0} size="sm" /></View>
            </View>
            <View style={styles.apGridRow}>
              <View style={styles.apCell}><EditableNumber value={ap.rightArm} label={tr('wfrp.combat.loc.rightArm')} onSave={v => setAP('rightArm', v)} min={0} size="sm" /></View>
              <View style={styles.apCell}><EditableNumber value={ap.body} label={tr('wfrp.combat.loc.body')} onSave={v => setAP('body', v)} min={0} size="sm" /></View>
              <View style={styles.apCell}><EditableNumber value={ap.leftArm} label={tr('wfrp.combat.loc.leftArm')} onSave={v => setAP('leftArm', v)} min={0} size="sm" /></View>
            </View>
            <View style={styles.apGridRow}>
              <View style={styles.apCell}><EditableNumber value={ap.rightLeg} label={tr('wfrp.combat.loc.rightLeg')} onSave={v => setAP('rightLeg', v)} min={0} size="sm" /></View>
              <View style={styles.apCell} />
              <View style={styles.apCell}><EditableNumber value={ap.leftLeg} label={tr('wfrp.combat.loc.leftLeg')} onSave={v => setAP('leftLeg', v)} min={0} size="sm" /></View>
            </View>
          </View>
        </View>

        {character.armour.map(a => (
          <View key={a.id} style={[styles.row, { borderColor: t.colors.border }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => openEditArmour(a)}>
              <Text style={[styles.itemName, { color: t.colors.text }]}>{a.name}</Text>
              <Text style={[styles.itemSub, { color: t.colors.textSecondary }]}>
                {tr('wfrp.combat.ap')} {a.ap} · {a.locations.join('/')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.encLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.enc', { n: a.encumbrance })}</Text>
            <TouchableOpacity
              onPress={() => toggleArmourEquipped(a.id)}
              style={[styles.equipChip, {
                borderColor: a.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: a.equipped ? t.colors.accent : 'transparent',
              }]}
              accessibilityLabel={tr(a.equipped ? 'wfrp.equip.unequipA11y' : 'wfrp.equip.equipA11y', { name: a.name })}
            >
              <Text style={[styles.equipChipText, { color: a.equipped ? t.colors.accentText : t.colors.textSecondary }]}>
                {tr(a.equipped ? 'wfrp.equip.equipped' : 'wfrp.equip.equip')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeArmour(a.id)} style={styles.del}>
              <Trash2 size={14} color={t.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openAddArmour}>
          <Plus size={14} color={t.colors.accent} />
          <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.combat.addArmour')}</Text>
        </TouchableOpacity>
      </Section>

      {/* ── Weapon modal ───────────────────────────────────────────────── */}
      <Modal visible={weaponAdding} transparent animationType="slide" onRequestClose={() => setWeaponAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setWeaponAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {weaponEditId ? tr('wfrp.combat.editWeapon') : tr('wfrp.combat.addWeapon')}
            </Text>
            {!weaponEditId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setWeaponPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accent }]}>{tr('wfrp.combat.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.weaponNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={weaponDraft.name} onChangeText={v => setWeaponDraft(d => ({ ...d, name: v }))}
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.group')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.combat.groupPlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={weaponDraft.group} onChangeText={v => setWeaponDraft(d => ({ ...d, group: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.damage')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.combat.damagePlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={weaponDraft.damage} onChangeText={v => setWeaponDraft(d => ({ ...d, damage: v }))}
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.range')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  placeholder={tr('wfrp.combat.rangePlaceholder')} placeholderTextColor={t.colors.textMuted}
                  value={weaponDraft.range} onChangeText={v => setWeaponDraft(d => ({ ...d, range: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.encumbrance')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={weaponDraft.encumbrance === 0 ? '' : String(weaponDraft.encumbrance)}
                  onChangeText={v => setWeaponDraft(d => ({ ...d, encumbrance: parseInt(v) || 0 }))}
                />
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.qualities')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.qualitiesPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={weaponDraft.qualities} onChangeText={v => setWeaponDraft(d => ({ ...d, qualities: v }))}
            />
            <TextInput
              style={[styles.input, styles.multiline, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.notesPlaceholder')} placeholderTextColor={t.colors.textMuted}
              multiline textAlignVertical="top"
              value={weaponDraft.notes} onChangeText={v => setWeaponDraft(d => ({ ...d, notes: v }))}
            />
            <TouchableOpacity
              style={[styles.equipRow, { borderColor: weaponDraft.equipped ? t.colors.accent : t.colors.border }]}
              onPress={() => setWeaponDraft(d => ({ ...d, equipped: !d.equipped }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, {
                borderColor: weaponDraft.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: weaponDraft.equipped ? t.colors.accent : 'transparent',
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.equipRowLabel, { color: t.colors.text }]}>{tr('wfrp.equip.equipped')}</Text>
                <Text style={[styles.equipRowHint, { color: t.colors.textMuted }]}>{tr('wfrp.equip.hint')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setWeaponAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={saveWeapon}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Armour modal ───────────────────────────────────────────────── */}
      <Modal visible={armourAdding} transparent animationType="slide" onRequestClose={() => setArmourAdding(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setArmourAdding(false)} />
          <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {armourEditId ? tr('wfrp.combat.editArmour') : tr('wfrp.combat.addArmour')}
            </Text>
            {!armourEditId && (
              <TouchableOpacity style={[styles.bookBtn, { borderColor: t.colors.accent }]} onPress={() => setArmourPicking(true)}>
                <BookOpen size={15} color={t.colors.accent} />
                <Text style={[styles.bookBtnText, { color: t.colors.accent }]}>{tr('wfrp.combat.searchBook')}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.armourNamePlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={armourDraft.name} onChangeText={v => setArmourDraft(d => ({ ...d, name: v }))}
            />
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.locations')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.locationsPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={armourDraft.locationsRaw}
              onChangeText={v => setArmourDraft(d => ({ ...d, locationsRaw: v }))}
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.ap')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={armourDraft.ap === 0 ? '' : String(armourDraft.ap)}
                  onChangeText={v => setArmourDraft(d => ({ ...d, ap: parseInt(v) || 0 }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.encumbrance')}</Text>
                <TextInput
                  style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={t.colors.textMuted}
                  value={armourDraft.encumbrance === 0 ? '' : String(armourDraft.encumbrance)}
                  onChangeText={v => setArmourDraft(d => ({ ...d, encumbrance: parseInt(v) || 0 }))}
                />
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.qualities')}</Text>
            <TextInput
              style={[styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              placeholder={tr('wfrp.combat.armourQualitiesPlaceholder')} placeholderTextColor={t.colors.textMuted}
              value={armourDraft.qualities} onChangeText={v => setArmourDraft(d => ({ ...d, qualities: v }))}
            />
            <TouchableOpacity
              style={[styles.equipRow, { borderColor: armourDraft.equipped ? t.colors.accent : t.colors.border }]}
              onPress={() => setArmourDraft(d => ({ ...d, equipped: !d.equipped }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, {
                borderColor: armourDraft.equipped ? t.colors.accent : t.colors.border,
                backgroundColor: armourDraft.equipped ? t.colors.accent : 'transparent',
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.equipRowLabel, { color: t.colors.text }]}>{tr('wfrp.equip.equipped')}</Text>
                <Text style={[styles.equipRowHint, { color: t.colors.textMuted }]}>{tr('wfrp.equip.hint')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={() => setArmourAdding(false)}>
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.colors.accent }]} onPress={saveArmour}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ContentPicker
        visible={weaponPicking}
        category="trapping"
        title={tr('wfrp.combat.weapons')}
        filter={isWeapon}
        subtitle={(r) => { const w = weaponFromRecord(r); return [w.group, w.damage].filter(Boolean).join(' · '); }}
        onSelect={(r) => setWeaponDraft(weaponFromRecord(r))}
        onClose={() => setWeaponPicking(false)}
      />

      <ContentPicker
        visible={armourPicking}
        category="trapping"
        title={tr('wfrp.combat.armour')}
        filter={isArmour}
        subtitle={(r) => { const a = armourFromRecord(r); return `AP ${a.ap} · ${a.locations.join('/')}`; }}
        onSelect={(r) => { const a = armourFromRecord(r); setArmourDraft({ ...a, locationsRaw: a.locations.join(', ') }); }}
        onClose={() => setArmourPicking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemSub: { fontSize: 12, marginTop: 2 },
  encLabel: { fontSize: 11, fontWeight: '600' },
  del: { width: 26, alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, justifyContent: 'center' },
  addText: { fontSize: 13, fontWeight: '600' },
  equipChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  equipChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  equipRowLabel: { fontSize: 14, fontWeight: '600' },
  equipRowHint: { fontSize: 11, marginTop: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
  apBlock: { marginBottom: 12 },
  apHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  apLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  autoBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  autoBtnText: { fontSize: 11, fontWeight: '700' },
  apGrid: { gap: 8 },
  apGridRow: { flexDirection: 'row', gap: 8 },
  apCell: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1 },
  multiline: { minHeight: 64 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
