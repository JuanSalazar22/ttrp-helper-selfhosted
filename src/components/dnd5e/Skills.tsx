import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { ProficiencyDot } from '@/components/ui/ProficiencyDot';
import { abilityModifier, DND5E_SKILLS } from '@/types/dnd5e';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import type { TKey } from '@/i18n';

const ABILITY_ABBREV: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const SKILL_KEY_MAP: Record<string, TKey> = {
  acrobatics: 'dnd.skills.acrobatics',
  animalHandling: 'dnd.skills.animalHandling',
  arcana: 'dnd.skills.arcana',
  athletics: 'dnd.skills.athletics',
  deception: 'dnd.skills.deception',
  history: 'dnd.skills.history',
  insight: 'dnd.skills.insight',
  intimidation: 'dnd.skills.intimidation',
  investigation: 'dnd.skills.investigation',
  medicine: 'dnd.skills.medicine',
  nature: 'dnd.skills.nature',
  perception: 'dnd.skills.perception',
  performance: 'dnd.skills.performance',
  persuasion: 'dnd.skills.persuasion',
  religion: 'dnd.skills.religion',
  sleightOfHand: 'dnd.skills.sleightOfHand',
  stealth: 'dnd.skills.stealth',
  survival: 'dnd.skills.survival',
};

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
  onRoll?: (modifier: number, label: string) => void;
};

export function Skills({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();

  function toggleSkill(key: string) {
    if (!onChange) return;
    const skill = character.skills[key];
    const proficient = !skill.proficient;
    // Clear expertise if removing proficiency
    const expertise = proficient ? skill.expertise : false;
    onChange({ skills: { ...character.skills, [key]: { ...skill, proficient, expertise } } });
  }

  function toggleExpertise(key: string) {
    if (!onChange) return;
    const skill = character.skills[key];
    if (!skill.proficient) return; // can't have expertise without proficiency
    onChange({ skills: { ...character.skills, [key]: { ...skill, expertise: !skill.expertise } } });
  }

  return (
    <Section title={tr('dnd.sections.skills')}>
      {DND5E_SKILLS.map(({ key }) => {
        const skill = character.skills[key];
        if (!skill) return null;
        const base = abilityModifier(character.abilities[skill.ability]);
        const profBonus = skill.proficient ? character.proficiencyBonus : 0;
        const expBonus = skill.expertise ? character.proficiencyBonus : 0;
        const total = base + profBonus + expBonus + skill.miscBonus;
        const totalStr = total >= 0 ? `+${total}` : `${total}`;
        const active = skill.proficient || skill.expertise;
        const skillLabel = SKILL_KEY_MAP[key] ? tr(SKILL_KEY_MAP[key]) : key;
        return (
          <View key={key} style={styles.row}>
            <TouchableOpacity onPress={() => toggleSkill(key)} disabled={!onChange}>
              <ProficiencyDot proficient={skill.proficient} expertise={skill.expertise} size={10} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRoll?.(total, skillLabel)} disabled={!onRoll} activeOpacity={0.6}>
              <Text style={[styles.bonus, { color: onRoll ? t.colors.accent : active ? t.colors.text : t.colors.textSecondary }]}>
                {totalStr}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.name, {
              color: active ? t.colors.text : t.colors.textSecondary,
              fontWeight: active ? '600' : '400',
            }]}>
              {skillLabel}
            </Text>
            <Text style={[styles.ability, { color: t.colors.textSecondary }]}>
              ({ABILITY_ABBREV[skill.ability]})
            </Text>
            {skill.proficient && onChange && (
              <TouchableOpacity onPress={() => toggleExpertise(key)}>
                <Text style={[
                  styles.expertiseBadge,
                  {
                    color: skill.expertise ? t.colors.accent : t.colors.textMuted,
                    borderColor: skill.expertise ? t.colors.accent : t.colors.textMuted,
                  },
                ]}>
                  {tr('dnd.proficiency.expertise')}
                </Text>
              </TouchableOpacity>
            )}
            {!onChange && skill.expertise && (
              <Text style={[styles.expertiseBadge, { color: t.colors.accent, borderColor: t.colors.accent }]}>
                {tr('dnd.proficiency.expertise')}
              </Text>
            )}
          </View>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  bonus: { fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
  name: { fontSize: 13, flex: 1 },
  ability: { fontSize: 11 },
  expertiseBadge: {
    fontSize: 9, fontWeight: '700', letterSpacing: 0.5,
    borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
  },
});
