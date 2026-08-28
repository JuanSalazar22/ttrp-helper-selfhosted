import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { sampleDnd5eCharacter } from '@/fixtures/sampleDnd5e';

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

const character = sampleDnd5eCharacter;

export default function PreviewSheet() {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <CharacterHeader character={character} onChange={() => {}} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <ProficiencyRow character={character} />
          <AbilityScores character={character} />
          <CombatStats character={character} />
          <SavingThrows character={character} />
          <Skills character={character} />
          <Attacks character={character} />
          <Spellcasting character={character} />
          <Inventory character={character} />
          <FeaturesSection character={character} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  body: { padding: 20, paddingBottom: 48 },
});
