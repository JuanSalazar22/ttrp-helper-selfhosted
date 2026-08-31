import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Search, X } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale, type Locale } from '@/i18n';
import { searchContent, getContentByIds } from '@/db/queries';
import { mergeGrantedSkills, mergeGrantedTalents, mergeGrantedTrappings, type GrantedTalent } from '@/types/wfrp4e';
import { classTrappingsForClass } from '@/data/wfrp-class-trappings';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';
import type { ContentRecord } from '@/data/wfrp-content';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

export type Level = {
  name: string;
  status?: number;
  standing?: number;
  skills?: string[];
  talents?: string[];
};

type LevelRow = {
  key: string;
  record: ContentRecord;
  levelIdx: number;
  levelName: string;
};

const TIER_BY_STATUS: Record<number, Wfrp4eCharacter['status']['tier']> = {
  1: 'Brass', 2: 'Silver', 3: 'Gold',
};

// Resolve a career level's skill/talent id lists into character grants (skills carry
// their characteristic; talents are names). Shared by pick and level-up.
export async function applyCareerLevel(
  db: ReturnType<typeof useSQLiteContext>,
  character: Wfrp4eCharacter,
  level: Level,
  locale: Locale = 'en',
): Promise<Pick<Wfrp4eCharacter, 'skills' | 'talents'>> {
  const [skillRecs, talentRecs] = await Promise.all([
    getContentByIds(db, level.skills ?? [], locale),
    getContentByIds(db, level.talents ?? [], locale),
  ]);
  const grantedSkills = skillRecs.map((s: ContentRecord) => ({
    name: s.name,
    characteristic: ((s.characteristic as CharacteristicKey) ?? 'ws'),
  }));
  const grantedTalents: GrantedTalent[] = talentRecs.map((tl: ContentRecord) => ({
    name: tl.name,
    description: tl.description as string | undefined,
    tests: tl.tests as string | undefined,
  }));
  return {
    skills: mergeGrantedSkills(character.skills, grantedSkills, uuidv4),
    talents: mergeGrantedTalents(character.talents, grantedTalents, uuidv4),
  };
}

/** Expand search results into one row per career level, sorted by level name. */
function expandToLevelRows(careers: ContentRecord[]): LevelRow[] {
  const rows: LevelRow[] = [];
  for (const record of careers) {
    const levels = (record.levels as Level[]) ?? [];
    levels.forEach((l, i) => {
      if (l.name) rows.push({ key: `${record.id}_${i}`, record, levelIdx: i, levelName: l.name });
    });
  }
  return rows;
}

/** Pick a career at a specific level. Shows one row per career level so the user
 *  selects "Doktor" directly rather than finding it hidden inside "Physician". */
export function CareerPicker({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const { locale } = useLocale();
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!visible) return; setQuery(''); }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const careers = await searchContent(db, 'career', query, 60, locale);
        if (!cancelled) setRows(expandToLevelRows(careers));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [visible, query, db, locale]);

  async function handleSelect(row: LevelRow) {
    const levels = (row.record.levels as Level[]) ?? [];
    const level = levels[row.levelIdx];
    const careerPath = levels.map((l) => l.name).filter(Boolean);
    const grants = level
      ? await applyCareerLevel(db, character, level, locale)
      : { skills: character.skills, talents: character.talents };
    const status = level?.status
      ? { tier: TIER_BY_STATUS[level.status] ?? character.status.tier, standing: level.standing ?? 0 }
      : character.status;
    const trappings = mergeGrantedTrappings(
      character.trappings,
      classTrappingsForClass(row.record.class as number | undefined),
      uuidv4,
    );
    onChange({
      currentCareer: row.record.name,
      careerRank: (row.levelIdx + 1) as Wfrp4eCharacter['careerRank'],
      careerPath,
      status,
      trappings,
      ...grants,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {tr('wfrp.career.title')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('common.close')}><X size={22} color={t.colors.textMuted} /></TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
            <Search size={16} color={t.colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: t.colors.text }]}
              placeholder={tr('wfrp.contentPicker.searchPlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListHeaderComponent={
              query.trim() ? (
                <TouchableOpacity
                  style={[styles.customRow, { borderColor: t.colors.accent }]}
                  onPress={() => { onChange({ currentCareer: query.trim(), careerRank: 1, careerPath: [] }); onClose(); }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.customText, { color: t.colors.accentFg }]} numberOfLines={1}>
                    {tr('wfrp.contentPicker.useCustom', { query: query.trim() })}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              loading
                ? <ActivityIndicator style={{ marginTop: 24 }} color={t.colors.accent} />
                : <Text style={[styles.empty, { color: t.colors.textMuted }]}>{tr('wfrp.contentPicker.noMatches')}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.rowItem, { borderBottomColor: t.colors.border }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.6}
              >
                <Text style={[styles.levelName, { color: t.colors.text }]} numberOfLines={1}>
                  {item.levelName}
                </Text>
                <Text style={[styles.careerSub, { color: t.colors.textSecondary }]} numberOfLines={1}>
                  {item.record.name} · Rank {item.levelIdx + 1}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, paddingBottom: 28, height: '80%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { marginTop: 8 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 13, paddingHorizontal: 20 },
  customRow: { paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', marginBottom: 6 },
  customText: { fontSize: 14, fontWeight: '700' },
  rowItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  levelName: { fontSize: 15, fontWeight: '600' },
  careerSub: { fontSize: 12, marginTop: 2 },
});
