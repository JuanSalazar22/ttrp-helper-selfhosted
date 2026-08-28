import { ScrollView, View, StyleSheet } from 'react-native';
import { useWfrpRoll } from '@/hooks/useWfrpRoll';
import { useWideLayout } from '@/hooks/useWideLayout';
import { WfrpRollModal } from '@/components/ui/WfrpRollModal';
import { ResponsiveColumns } from '@/components/ui/ResponsiveColumns';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { Wfrp4eHeader } from '@/components/wfrp4e/Wfrp4eHeader';
import { Experience } from '@/components/wfrp4e/Experience';
import { Characteristics } from '@/components/wfrp4e/Characteristics';
import { Buffs } from '@/components/wfrp4e/Buffs';
import { Resources } from '@/components/wfrp4e/Resources';
import { WfrpSkills } from '@/components/wfrp4e/WfrpSkills';
import { Talents } from '@/components/wfrp4e/Talents';
import { Combat } from '@/components/wfrp4e/Combat';
import { Trappings } from '@/components/wfrp4e/Trappings';
import { Magic } from '@/components/wfrp4e/Magic';
import { CorruptionSin } from '@/components/wfrp4e/CorruptionSin';
import { CharacterDetails } from '@/components/wfrp4e/CharacterDetails';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

export function Wfrp4eSheet({ character, onChange }: Props) {
  const { result, rollTest, setDifficulty, setManualRoll, reroll, dismiss } = useWfrpRoll();
  const { wide } = useWideLayout();

  // Each section built once, then arranged: original order for portrait (single
  // column), or split across two columns for landscape.
  const s = {
    experience: <Experience key="experience" character={character} onChange={onChange} />,
    characteristics: <Characteristics key="characteristics" character={character} onChange={onChange} onRoll={rollTest} />,
    buffs: <Buffs key="buffs" character={character} onChange={onChange} />,
    resources: <Resources key="resources" character={character} onChange={onChange} />,
    skills: <WfrpSkills key="skills" character={character} onChange={onChange} onRoll={rollTest} />,
    talents: <Talents key="talents" character={character} onChange={onChange} />,
    combat: <Combat key="combat" character={character} onChange={onChange} />,
    trappings: <Trappings key="trappings" character={character} onChange={onChange} />,
    magic: <Magic key="magic" character={character} onChange={onChange} />,
    corruption: <CorruptionSin key="corruption" character={character} onChange={onChange} />,
    details: <CharacterDetails key="details" character={character} onChange={onChange} />,
  };

  const single = [s.details, s.experience, s.characteristics, s.buffs, s.resources, s.skills, s.talents, s.combat, s.trappings, s.magic, s.corruption];
  const left = [s.experience, s.characteristics, s.buffs, s.skills, s.talents];
  const right = [s.resources, s.combat, s.trappings, s.magic, s.corruption, s.details];

  return (
    <>
      <Wfrp4eHeader character={character} onChange={onChange} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <ResponsiveColumns wide={wide} single={single} left={left} right={right} />
        </View>
      </ScrollView>
      <WfrpRollModal result={result} onClose={dismiss} onReroll={reroll} onDifficulty={setDifficulty} onManualRoll={setManualRoll} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { padding: 20, paddingBottom: 48 },
});
