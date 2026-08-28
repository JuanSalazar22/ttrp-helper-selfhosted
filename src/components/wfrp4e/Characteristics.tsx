import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Dices } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { textStyle } from '@/tokens/typography';
import { Section } from '@/components/ui/Section';
import { CharacteristicsDetail } from '@/components/wfrp4e/CharacteristicsDetail';
import {
  CHARACTERISTIC_LABELS, characteristicTotal, buffTotal,
} from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

const KEYS: CharacteristicKey[] = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onRoll: (target: number, label: string) => void;
};

export function Characteristics({ character, onChange, onRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <Section title={tr('wfrp.sections.characteristics')}>
      <View style={styles.grid}>
        {KEYS.map(k => {
          const total = characteristicTotal(character, k);
          const delta = buffTotal(character, k);
          return (
            <View key={k} style={[styles.cell, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
              {delta !== 0 && <View style={[styles.buffDot, { backgroundColor: delta > 0 ? t.colors.success : t.colors.danger }]} />}
              <Text style={[styles.abbrev, { color: t.colors.textSecondary }]}>{tr(`wfrp.char.${k}`)}</Text>
              <TouchableOpacity onPress={() => onRoll(total, CHARACTERISTIC_LABELS[k])} activeOpacity={0.6}>
                <Text style={[styles.total, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{total}</Text>
              </TouchableOpacity>
              <Dices size={9} color={t.colors.textMuted} style={styles.rollHint} />
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.detailsBtn, { borderColor: t.colors.border }]}
        onPress={() => setDetailOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.detailsText, { color: t.colors.textSecondary }]}>{tr('wfrp.fields.details')}</Text>
      </TouchableOpacity>

      <CharacteristicsDetail
        visible={detailOpen}
        character={character}
        onChange={onChange}
        onClose={() => setDetailOpen(false)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '18.5%', borderRadius: 8, borderWidth: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 16, gap: 2 },
  buffDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3 },
  rollHint: { position: 'absolute', bottom: 4, alignSelf: 'center', opacity: 0.7 },
  abbrev: { ...textStyle.fieldLabel },
  total: { fontSize: 24, fontWeight: '700' },
  detailsBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  detailsText: { fontSize: 14, fontWeight: '600' },
});
