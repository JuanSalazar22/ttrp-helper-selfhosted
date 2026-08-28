import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { textStyle } from '@/tokens/typography';
import { TextEditModal } from '@/components/ui/TextEditModal';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { EditableText } from '@/components/ui/EditableText';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

type EditTarget = { title: string; value: string; save: (v: string) => void };

// Collapsible panel consolidating the character's narrative/RP details. Collapsed by
// default to keep the long sheet short; each field opens a TextEditModal to edit.
export function CharacterDetails({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  function field(key: string, labelKey: TKey, value: string, save: (v: string) => void) {
    const label = tr(labelKey);
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setEditing({ title: label, value, save })}
        activeOpacity={0.7}
        style={[styles.field, { borderBottomColor: t.colors.border }]}
      >
        <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{label}</Text>
        <Text
          style={[styles.fieldValue, { color: value ? t.colors.text : t.colors.textMuted }]}
          numberOfLines={4}
        >
          {value || tr('wfrp.details.tapToAdd')}
        </Text>
      </TouchableOpacity>
    );
  }

  const groupHeader = (labelKey: TKey) => (
    <Text key={labelKey} style={[styles.group, { color: t.colors.accent }]}>{tr(labelKey)}</Text>
  );

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
        style={[styles.header, { borderBottomColor: t.colors.accent }]}
      >
        <Text style={[styles.title, { color: t.colors.accent }]}>{tr('wfrp.details.title')}</Text>
        {open
          ? <ChevronDown size={20} color={t.colors.accent} />
          : <ChevronRight size={20} color={t.colors.accent} />}
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {groupHeader('wfrp.details.appearance')}
          <View style={styles.appearanceRow}>
            <EditableNumber value={character.age} label={tr('wfrp.details.age')} onSave={(v) => onChange({ age: v })} min={0} size="sm" />
            <EditableText value={character.height} label={tr('wfrp.details.height')} onSave={(v) => onChange({ height: v })} size="sm" />
            <EditableText value={character.eyeColor} label={tr('wfrp.details.eyeColor')} onSave={(v) => onChange({ eyeColor: v })} size="sm" />
            <EditableText value={character.hair} label={tr('wfrp.details.hair')} onSave={(v) => onChange({ hair: v })} size="sm" />
          </View>
          {field('description', 'wfrp.details.description', character.description, (v) => onChange({ description: v }))}

          {groupHeader('wfrp.details.ambitions')}
          {field('amb-short', 'wfrp.details.shortTerm', character.ambitions.shortTerm, (v) => onChange({ ambitions: { ...character.ambitions, shortTerm: v } }))}
          {field('amb-long', 'wfrp.details.longTerm', character.ambitions.longTerm, (v) => onChange({ ambitions: { ...character.ambitions, longTerm: v } }))}

          {groupHeader('wfrp.details.partyAmbition')}
          {field('party-short', 'wfrp.details.shortTerm', character.partyAmbition.shortTerm, (v) => onChange({ partyAmbition: { ...character.partyAmbition, shortTerm: v } }))}
          {field('party-long', 'wfrp.details.longTerm', character.partyAmbition.longTerm, (v) => onChange({ partyAmbition: { ...character.partyAmbition, longTerm: v } }))}

          {groupHeader('wfrp.details.background')}
          {field('lore', 'wfrp.details.lore', character.lore, (v) => onChange({ lore: v }))}
          {field('psychology', 'wfrp.details.psychology', character.psychology, (v) => onChange({ psychology: v }))}
          {field('relations', 'wfrp.details.relations', character.relations, (v) => onChange({ relations: v }))}
          {field('notes', 'wfrp.details.notes', character.notes, (v) => onChange({ notes: v }))}
        </View>
      )}

      <TextEditModal
        visible={editing !== null}
        title={editing?.title ?? ''}
        value={editing?.value ?? ''}
        onSave={(v) => editing?.save(v)}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  title: { ...textStyle.sectionHeader },
  body: { paddingTop: 8 },
  group: { ...textStyle.fieldLabel, marginTop: 14, marginBottom: 2 },
  appearanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  field: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  fieldLabel: { ...textStyle.fieldLabel },
  fieldValue: { fontSize: 14, lineHeight: 19 },
});
