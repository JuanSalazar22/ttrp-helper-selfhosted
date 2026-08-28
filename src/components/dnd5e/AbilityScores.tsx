import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { abilityModifier } from '@/types/dnd5e';
import type { Dnd5eCharacter, AbilityKey } from '@/types/dnd5e';
import type { TKey } from '@/i18n';

const ABILITY_KEYS: Array<{ key: AbilityKey; labelKey: TKey }> = [
  { key: 'str', labelKey: 'dnd.abilities.str' },
  { key: 'dex', labelKey: 'dnd.abilities.dex' },
  { key: 'con', labelKey: 'dnd.abilities.con' },
  { key: 'int', labelKey: 'dnd.abilities.int' },
  { key: 'wis', labelKey: 'dnd.abilities.wis' },
  { key: 'cha', labelKey: 'dnd.abilities.cha' },
];

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
  onRoll?: (modifier: number, label: string) => void;
};

export function AbilityScores({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  return (
    <Section title={tr('dnd.sections.abilityScores')}>
      <View style={styles.grid}>
        {ABILITY_KEYS.map(({ key, labelKey }) => {
          const label = tr(labelKey);
          const score = character.abilities[key];
          const mod = abilityModifier(score);
          const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
          return (
            <View
              key={key}
              style={[styles.card, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}
            >
              <TouchableOpacity onPress={() => onRoll?.(mod, label + ' Check')} disabled={!onRoll} activeOpacity={0.6}>
                <Text style={[styles.mod, { color: onRoll ? t.colors.accent : t.colors.text, fontFamily: t.fontFamily.serif }]}>
                  {modStr}
                </Text>
              </TouchableOpacity>
              <EditableNumber
                value={score}
                label={label.slice(0, 3).toUpperCase()}
                size="sm"
                onSave={v => onChange?.({ abilities: { ...character.abilities, [key]: v } })}
                min={1}
                max={30}
              />
            </View>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  mod: { fontSize: 28, fontWeight: '700', lineHeight: 32 },
});
