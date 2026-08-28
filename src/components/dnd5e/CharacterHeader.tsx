import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { TagEditor } from '@/components/ui/TagEditor';
import type { Dnd5eCharacter } from '@/types/dnd5e';

type Props = {
  character: Dnd5eCharacter;
  onChange: (patch: Partial<Dnd5eCharacter>) => void;
};

export function CharacterHeader({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <View style={[styles.root, { backgroundColor: t.colors.backgroundSecondary, borderBottomColor: t.colors.border }]}>
      <Text style={[styles.name, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
        {character.name}
      </Text>
      <Text style={[styles.class, { color: t.colors.textSecondary }]}>
        {character.class}
      </Text>
      <View style={styles.tagsRow}>
        <TagEditor tags={character.tags ?? []} onChange={(tags) => onChange({ tags })} />
      </View>
      <View style={styles.meta}>
        {[
          character.race,
          character.background,
          character.alignment,
          tr('dnd.header.xpSuffix', { n: character.xp.toLocaleString() }),
        ].map((item, i) => (
          <View key={i} style={styles.metaItem}>
            {i > 0 && <View style={[styles.dot, { backgroundColor: t.colors.textMuted }]} />}
            <Text style={[styles.metaText, { color: t.colors.textMuted }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  class: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  tagsRow: { marginTop: 8 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  metaText: {
    fontSize: 12,
  },
});
