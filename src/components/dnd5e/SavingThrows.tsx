import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { ProficiencyDot } from '@/components/ui/ProficiencyDot';
import { abilityModifier } from '@/types/dnd5e';
import type { Dnd5eCharacter, AbilityKey } from '@/types/dnd5e';
import type { TKey } from '@/i18n';

const SAVES: Array<{ key: AbilityKey; labelKey: TKey }> = [
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

export function SavingThrows({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();

  function toggleSave(key: AbilityKey) {
    if (!onChange) return;
    onChange({
      saves: {
        ...character.saves,
        [key]: { proficient: !character.saves[key].proficient },
      },
    });
  }

  return (
    <Section title={tr('dnd.sections.savingThrows')}>
      {SAVES.map(({ key, labelKey }) => {
        const label = tr(labelKey);
        const proficient = character.saves[key].proficient;
        const base = abilityModifier(character.abilities[key]);
        const total = base + (proficient ? character.proficiencyBonus : 0);
        const totalStr = total >= 0 ? `+${total}` : `${total}`;
        return (
          <View key={key} style={styles.row}>
            <TouchableOpacity onPress={() => toggleSave(key)} disabled={!onChange} activeOpacity={0.6}>
              <ProficiencyDot proficient={proficient} size={10} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRoll?.(total, label + ' Save')} disabled={!onRoll} activeOpacity={0.6} style={styles.bonusBtn}>
              <Text style={[styles.bonus, { color: onRoll ? t.colors.accent : proficient ? t.colors.text : t.colors.textSecondary }]}>
                {totalStr}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleSave(key)} disabled={!onChange} activeOpacity={0.6} style={{ flex: 1 }}>
              <Text style={[styles.name, { color: proficient ? t.colors.text : t.colors.textSecondary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  bonusBtn: { minWidth: 32 },
  bonus: { fontSize: 14, fontWeight: '700', width: 32, textAlign: 'right' },
  name: { fontSize: 14 },
});
