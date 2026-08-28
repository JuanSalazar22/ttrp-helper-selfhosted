import { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { SpeciesEditor } from '@/components/wfrp4e/SpeciesEditor';
import { useWfrpLibrary } from '@/hooks/useWfrpLibrary';
import { applySpecies, upsertByName, mergeGrantedTalents, type GrantedTalent } from '@/types/wfrp4e';
import { BASE_RACES } from '@/data/wfrp-races';
import { rollRandomTalents } from '@/lib/randomTalents';
import { roll } from '@/dice/engine';
import { getTalentsByNames } from '@/db/queries';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Locale } from '@/i18n';
import type { Wfrp4eCharacter, WfrpSpeciesDef } from '@/types/wfrp4e';
import type { ContentRecord } from '@/data/wfrp-content';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

const roll2d10 = () => roll('2d10').total;
const rollD100 = () => roll('1d100').total;

/** Build a name → enriched-talent lookup from content records. */
function buildTalentLookup(records: ContentRecord[]): Map<string, GrantedTalent> {
  return new Map(records.map(r => [
    r.name.toLowerCase(),
    { name: r.name, description: r.description as string | undefined, tests: r.tests as string | undefined },
  ]));
}

// Apply a race, then roll its random starting talents (deduped against the granted ones).
// Both the fixed race talents AND the rolled random ones are enriched with book
// descriptions when the names match content_library entries.
async function applyRaceWithRandomTalents(
  db: SQLiteDatabase,
  locale: Locale,
  character: Wfrp4eCharacter,
  def: WfrpSpeciesDef,
): Promise<Partial<Wfrp4eCharacter>> {
  const fixedRecords = await getTalentsByNames(db, def.talents ?? [], locale);
  const lookup = buildTalentLookup(fixedRecords);
  const patch = applySpecies(character, def, uuidv4, roll2d10, lookup);

  const granted = patch.talents ?? character.talents;
  const randomNames = rollRandomTalents(def.randomTalents ?? 0, rollD100, granted.map(t => t.name));
  if (randomNames.length > 0) {
    const randomRecords = await getTalentsByNames(db, randomNames, locale);
    const randomLookup = buildTalentLookup(randomRecords);
    const enrichedRandom: GrantedTalent[] = randomNames.map(name =>
      randomLookup.get(name.toLowerCase()) ?? { name }
    );
    patch.talents = mergeGrantedTalents(granted, enrichedRandom, uuidv4);
  }
  return patch;
}

function summary(def: WfrpSpeciesDef): string {
  return `M ${def.movement ?? 4} · Fate ${def.fate ?? 0} · Res ${def.resilience ?? 0} · +${def.extraPoints ?? 0} pts`;
}

export function SpeciesPicker({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();
  const { species, addSpecies } = useWfrpLibrary();
  const [editing, setEditing] = useState(false);

  // Built-in base races first, then custom library races (custom overrides a base by name).
  const races = useMemo(() => {
    let list: WfrpSpeciesDef[] = [...BASE_RACES];
    for (const s of species) list = upsertByName(list, s);
    return list;
  }, [species]);

  async function applyDef(def: WfrpSpeciesDef) {
    onChange(await applyRaceWithRandomTalents(db, locale, character, def));
    onClose();
  }

  async function handleCreate(def: WfrpSpeciesDef) {
    addSpecies(def);
    onChange(await applyRaceWithRandomTalents(db, locale, character, def));
    setEditing(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('wfrp.species.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('wfrp.species.closeA11y')}>
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.hint, { color: t.colors.textMuted }]}>
            {tr('wfrp.species.hint')}
          </Text>
          {races.map(def => (
            <TouchableOpacity
              key={def.name}
              style={[styles.row, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => applyDef(def)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowName, { color: t.colors.text }]}>{def.name}</Text>
              <Text style={[styles.rowSummary, { color: t.colors.textMuted }]} numberOfLines={1}>{summary(def)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.createBtn, { borderColor: t.colors.accent }]}
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={t.colors.accent} />
            <Text style={[styles.createText, { color: t.colors.accent }]}>{tr('wfrp.species.createCustom')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <SpeciesEditor
        visible={editing}
        onSubmit={handleCreate}
        onClose={() => setEditing(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  row: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '700' },
  rowSummary: { fontSize: 12 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 4 },
  createText: { fontSize: 14, fontWeight: '600' },
});
