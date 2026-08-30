import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { TextEditModal } from '@/components/ui/TextEditModal';
import { TagEditor } from '@/components/ui/TagEditor';
import { CharacterPortrait } from '@/components/ui/CharacterPortrait';
import { SpeciesPicker } from '@/components/wfrp4e/SpeciesPicker';
import { OriginPicker } from '@/components/wfrp4e/OriginPicker';
import { CareerPicker } from '@/components/wfrp4e/CareerPicker';
import { CareerAdvanceModal } from '@/components/wfrp4e/CareerAdvanceModal';
import { StatusEditModal } from '@/components/wfrp4e/StatusEditModal';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  portraitUri: string | null;
  onPortraitChange: (croppedUri: string | null) => void;
};

type StrField = 'name' | 'currentCareer' | 'height';

const TITLE_KEYS: Record<StrField, TKey> = {
  name: 'wfrp.header.name', currentCareer: 'wfrp.header.career', height: 'wfrp.header.height',
};

const TIER_KEYS: Record<Wfrp4eCharacter['status']['tier'], TKey> = {
  Brass: 'wfrp.status.brass', Silver: 'wfrp.status.silver', Gold: 'wfrp.status.gold',
};

export function Wfrp4eHeader({ character, onChange, portraitUri, onPortraitChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [editing, setEditing] = useState<StrField | null>(null);
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [careerPickerOpen, setCareerPickerOpen] = useState(false);
  const [careerAdvanceOpen, setCareerAdvanceOpen] = useState(false);
  const [statusEditOpen, setStatusEditOpen] = useState(false);

  // The rank-specific career title (e.g. "Doktor" at rank 3) lives in careerPath;
  // currentCareer stays the base career name for advance/search lookups.
  const careerTitle = character.careerPath?.[character.careerRank - 1] || character.currentCareer;

  return (
    <View style={[styles.root, { borderBottomColor: t.colors.border }]}>
      <View style={styles.nameRow}>
        <CharacterPortrait size="sm" portraitUri={portraitUri} onChange={onPortraitChange} />
        <TouchableOpacity style={styles.nameTouchable} onPress={() => setEditing('name')} activeOpacity={0.7}>
          <Text style={[styles.name, styles.editable, { color: t.colors.text, borderBottomColor: t.colors.accent + '59', fontFamily: t.fontFamily.serif }]} numberOfLines={1}>
            {character.name || tr('wfrp.header.unnamed')}
          </Text>
        </TouchableOpacity>
      </View>

      <TagEditor tags={character.tags ?? []} onChange={(tags) => onChange({ tags })} />

      <View style={styles.metaRow}>
        <TouchableOpacity onPress={() => setSpeciesPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, styles.editable, { color: t.colors.textSecondary, borderBottomColor: t.colors.accent + '59' }]}>
            {character.species || tr('wfrp.header.race')}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
        <TouchableOpacity onPress={() => setOriginPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, styles.editable, { color: t.colors.textSecondary, borderBottomColor: t.colors.accent + '59' }]}>
            {character.origin || tr('wfrp.header.origin')}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
        <TouchableOpacity onPress={() => setCareerPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.meta, styles.editable, { color: t.colors.textSecondary, borderBottomColor: t.colors.accent + '59' }]}>
            {careerTitle || tr('wfrp.header.career')}
          </Text>
        </TouchableOpacity>
        {!!character.careerClass && (
          <>
            <Text style={[styles.dot, { color: t.colors.textMuted }]}>·</Text>
            <Text style={[styles.meta, { color: t.colors.textMuted }]}>{character.careerClass}</Text>
          </>
        )}
        <TouchableOpacity onPress={() => setCareerAdvanceOpen(true)} activeOpacity={0.7} style={[styles.pill, { borderColor: t.colors.accent }]}>
          <Text style={[styles.pillText, { color: t.colors.accent }]}>{tr('wfrp.header.rank', { n: character.careerRank })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStatusEditOpen(true)} activeOpacity={0.7} style={[styles.pill, { borderColor: t.colors.gold }]}>
          <Text style={[styles.pillText, { color: t.colors.gold }]}>
            {tr(TIER_KEYS[character.status.tier])} {character.status.standing}
          </Text>
        </TouchableOpacity>
      </View>

      <TextEditModal
        visible={editing !== null}
        title={editing ? tr(TITLE_KEYS[editing]) : ''}
        value={editing ? String(character[editing] ?? '') : ''}
        onSave={(v) => editing && onChange({ [editing]: v } as Partial<Wfrp4eCharacter>)}
        onClose={() => setEditing(null)}
      />
      <SpeciesPicker
        visible={speciesPickerOpen}
        character={character}
        onChange={onChange}
        onClose={() => setSpeciesPickerOpen(false)}
      />
      <OriginPicker
        visible={originPickerOpen}
        character={character}
        onChange={onChange}
        onClose={() => setOriginPickerOpen(false)}
      />
      <CareerPicker
        visible={careerPickerOpen}
        character={character}
        onChange={onChange}
        onClose={() => setCareerPickerOpen(false)}
      />
      <CareerAdvanceModal
        visible={careerAdvanceOpen}
        character={character}
        onChange={onChange}
        onClose={() => setCareerAdvanceOpen(false)}
      />
      <StatusEditModal
        visible={statusEditOpen}
        status={character.status}
        onChange={(status) => onChange({ status })}
        onClose={() => setStatusEditOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameTouchable: { flex: 1, minWidth: 0 },
  name: { fontSize: 28, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 14, fontWeight: '500' },
  editable: { borderBottomWidth: 1, alignSelf: 'flex-start', paddingBottom: 1 },
  dot: { fontSize: 14 },
  pill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
