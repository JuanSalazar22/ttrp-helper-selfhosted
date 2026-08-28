import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { experienceCurrent } from '@/types/wfrp4e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

// Total (earned) and Spent are player-editable; Current (unspent) is derived and
// shown red when negative. The advance calculator increments `spent` automatically.
export function Experience({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const xp = character.experience;
  const current = experienceCurrent(character);

  function setTotal(total: number) {
    onChange({ experience: { ...xp, total: Math.max(0, total) } });
  }
  function setSpent(spent: number) {
    onChange({ experience: { ...xp, spent: Math.max(0, spent) } });
  }

  return (
    <Section title={tr('wfrp.sections.experience')}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <EditableNumber size="md" label={tr('wfrp.fields.total')} value={xp.total} min={0} onSave={setTotal} />
        </View>
        <View style={styles.cell}>
          <EditableNumber size="md" label={tr('wfrp.fields.spent')} value={xp.spent} min={0} onSave={setSpent} />
        </View>
        <View style={styles.cell}>
          <View style={[styles.currentBox, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
            <Text
              style={[styles.currentValue, { fontFamily: t.fontFamily.serif, color: current < 0 ? t.colors.danger : t.colors.accent }]}
            >
              {current}
            </Text>
            <Text style={[styles.currentLabel, { color: t.colors.textMuted }]}>{tr('wfrp.fields.current')}</Text>
          </View>
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  currentBox: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4,
  },
  currentValue: { fontSize: 26, fontWeight: '700' },
  currentLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
