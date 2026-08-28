import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRoll } from '@/hooks/useRoll';
import { useWideLayout } from '@/hooks/useWideLayout';
import { RollModal } from '@/components/ui/RollModal';
import { ResponsiveColumns } from '@/components/ui/ResponsiveColumns';
import { CharacterPortrait } from '@/components/ui/CharacterPortrait';
import type { AdvantageMode } from '@/dice/types';
import type { Dnd5eCharacter } from '@/types/dnd5e';

import { CharacterHeader } from '@/components/dnd5e/CharacterHeader';
import { ProficiencyRow } from '@/components/dnd5e/ProficiencyRow';
import { AbilityScores } from '@/components/dnd5e/AbilityScores';
import { CombatStats } from '@/components/dnd5e/CombatStats';
import { SavingThrows } from '@/components/dnd5e/SavingThrows';
import { Skills } from '@/components/dnd5e/Skills';
import { Attacks } from '@/components/dnd5e/Attacks';
import { Spellcasting } from '@/components/dnd5e/Spellcasting';
import { Inventory } from '@/components/dnd5e/Inventory';
import { FeaturesSection } from '@/components/dnd5e/FeaturesSection';

type Props = {
  character: Dnd5eCharacter;
  onChange: (patch: Partial<Dnd5eCharacter>) => void;
};

export function Dnd5eSheet({ character, onChange }: Props) {
  const { result, rollCheck, rollExpression, reroll, dismiss } = useRoll();
  const [rollMode] = useState<AdvantageMode>('normal');
  const { wide } = useWideLayout();

  const s = {
    proficiency: <ProficiencyRow key="proficiency" character={character} />,
    ability: <AbilityScores key="ability" character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />,
    combat: <CombatStats key="combat" character={character} onChange={onChange} />,
    saves: <SavingThrows key="saves" character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />,
    skills: <Skills key="skills" character={character} onChange={onChange} onRoll={(mod, label) => rollCheck(mod, label, rollMode)} />,
    attacks: (
      <Attacks
        key="attacks"
        character={character}
        onChange={onChange}
        onRollAttack={(mod, label) => rollCheck(mod, label, rollMode)}
        onRollExpression={(expr, label) => rollExpression(expr, label)}
      />
    ),
    spellcasting: <Spellcasting key="spellcasting" character={character} onChange={onChange} />,
    inventory: <Inventory key="inventory" character={character} onChange={onChange} />,
    features: <FeaturesSection key="features" character={character} onChange={onChange} />,
  };

  const single = [s.proficiency, s.ability, s.combat, s.saves, s.skills, s.attacks, s.spellcasting, s.inventory, s.features];
  const left = [<CharacterPortrait key="portrait" />, s.ability, s.saves, s.skills, s.features];
  const right = [s.proficiency, s.combat, s.attacks, s.spellcasting, s.inventory];

  return (
    <>
      <CharacterHeader character={character} onChange={onChange} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <ResponsiveColumns wide={wide} single={single} left={left} right={right} />
        </View>
      </ScrollView>
      <RollModal result={result} onClose={dismiss} onReroll={reroll} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { padding: 20, paddingBottom: 48 },
});
