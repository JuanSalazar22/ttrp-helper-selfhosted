import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import type { Dnd5eCharacter } from '@/types/dnd5e';

type Props = { character: Dnd5eCharacter };

export function ProficiencyRow({ character }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <View style={[styles.row, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
      <View style={styles.item}>
        <Text style={[styles.val, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          +{character.proficiencyBonus}
        </Text>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('dnd.proficiency.proficiency')}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: t.colors.border }]} />
      <View style={styles.item}>
        <Text style={[styles.val, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          {character.level}
        </Text>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('dnd.proficiency.level')}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: t.colors.border }]} />
      <View style={styles.item}>
        <Text style={[styles.val, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          {character.xp.toLocaleString()}
        </Text>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('dnd.proficiency.xp')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  val: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
  },
});
