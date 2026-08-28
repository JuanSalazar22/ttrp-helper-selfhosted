import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { Stepper } from '@/components/ui/Stepper';
import { EditableNumber } from '@/components/ui/EditableNumber';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import { woundsMax, characteristicBonus, DEFAULT_WOUNDS_COEFFS, effectiveMovement, buffTotal } from '@/types/wfrp4e';

type Pair = { current: number; max: number };
type PairKey = 'fate' | 'fortune' | 'resilience' | 'resolve';

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

const PAIR_LABEL_KEY: Record<PairKey, TKey> = {
  fate: 'wfrp.pairs.fate', fortune: 'wfrp.pairs.fortune', resilience: 'wfrp.pairs.resilience', resolve: 'wfrp.pairs.resolve',
};

export function Resources({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const max = woundsMax(character);
  const sb = characteristicBonus(character, 's');
  const tb = characteristicBonus(character, 't');
  const wpb = characteristicBonus(character, 'wp');
  const coeffs = character.woundsCoeffs ?? DEFAULT_WOUNDS_COEFFS;
  const effMove = effectiveMovement(character);
  const moveDelta = buffTotal(character, 'movement');
  const walk = effMove * 2;
  const run = effMove * 4;

  function setModifier(m: number) {
    const nextMax = coeffs.sb * sb + coeffs.tb * tb + coeffs.wpb * wpb + m;
    onChange({
      wounds: {
        modifier: m,
        current: Math.max(0, Math.min(character.wounds.current, nextMax)),
      },
    });
  }

  function setWounds(next: number) {
    onChange({ wounds: { ...character.wounds, current: next } });
  }
  function setPair(key: PairKey, patch: Partial<Pair>) {
    onChange({ [key]: { ...character[key], ...patch } } as Partial<Wfrp4eCharacter>);
  }

  // Spend one racial "extra point" into Fate or Resilience (max + current both rise, as at
  // creation), decrementing the remaining pool. Only callable while points remain.
  function allocate(key: 'fate' | 'resilience') {
    if (character.extraPoints <= 0) return;
    const pair = character[key];
    onChange({
      [key]: { current: pair.current + 1, max: pair.max + 1 },
      extraPoints: character.extraPoints - 1,
    } as Partial<Wfrp4eCharacter>);
  }

  return (
    <Section title={tr('wfrp.sections.resources')}>
      <Stepper
        label={tr('wfrp.fields.wounds')}
        value={character.wounds.current}
        max={max}
        onStep={setWounds}
        accent
      />
      <View style={styles.maxRow}>
        <View>
          <Text style={[styles.maxLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.fields.maxWounds')}</Text>
          <Text style={[styles.breakdown, { color: t.colors.textMuted }]}>
            {coeffs.sb}×SB {sb} + {coeffs.tb}×TB {tb} + {coeffs.wpb}×WPB {wpb} + mod {character.wounds.modifier}
          </Text>
        </View>
        <View style={styles.maxRight}>
          <View style={styles.maxValueBox}>
            <Text style={[styles.maxValue, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{max}</Text>
            <Text style={[styles.maxValueLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.fields.max')}</Text>
          </View>
          <EditableNumber
            value={character.wounds.modifier}
            label={tr('wfrp.fields.mod')}
            size="sm"
            onSave={setModifier}
          />
        </View>
      </View>

      <View style={styles.moveRow}>
        <View>
          <Text style={[styles.maxLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.fields.movement')}</Text>
          <Text style={[styles.breakdown, { color: t.colors.textMuted }]}>
            {tr('wfrp.fields.walk')} {walk} · {tr('wfrp.fields.run')} {run}
          </Text>
          {moveDelta !== 0 && (
            <Text style={[styles.breakdown, { color: moveDelta > 0 ? t.colors.success : t.colors.danger }]}>
              {tr('wfrp.fields.moveDelta', {
                base: character.movement,
                sign: moveDelta > 0 ? '+' : '−',
                mag: Math.abs(moveDelta),
              })}
            </Text>
          )}
        </View>
        <EditableNumber
          value={character.movement}
          label={tr('wfrp.fields.move')}
          size="sm"
          onSave={(v) => onChange({ movement: Math.max(0, v) })}
        />
      </View>

      {character.extraPoints > 0 && (
        <View style={[styles.allocRow, { borderColor: t.colors.accent }]}>
          <Text style={[styles.allocLabel, { color: t.colors.text }]}>
            {tr('wfrp.fields.distributePts', { n: character.extraPoints })}
          </Text>
          <View style={styles.allocBtns}>
            <TouchableOpacity
              style={[styles.allocBtn, { borderColor: t.colors.accent }]}
              onPress={() => allocate('fate')}
              activeOpacity={0.7}
            >
              <Text style={[styles.allocBtnText, { color: t.colors.accent }]}>+1 {tr('wfrp.pairs.fate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.allocBtn, { borderColor: t.colors.accent }]}
              onPress={() => allocate('resilience')}
              activeOpacity={0.7}
            >
              <Text style={[styles.allocBtnText, { color: t.colors.accent }]}>+1 {tr('wfrp.pairs.resilience')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.pairGrid}>
        {(['fate', 'fortune', 'resilience', 'resolve'] as PairKey[]).map(key => (
          <View key={key} style={[styles.pairBox, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
            <Text style={[styles.pairLabel, { color: t.colors.textSecondary }]}>{tr(PAIR_LABEL_KEY[key])}</Text>
            <View style={styles.pairRow}>
              <Text style={[styles.minus, { color: t.colors.danger }]} onPress={() => setPair(key, { current: Math.max(0, character[key].current - 1) })}>−</Text>
              <Text style={[styles.pairVal, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
                {character[key].current}
                <Text style={{ color: t.colors.textMuted, fontSize: 14 }}> / {character[key].max}</Text>
              </Text>
              <Text style={[styles.plus, { color: t.colors.success }]} onPress={() => setPair(key, { current: Math.min(character[key].max, character[key].current + 1) })}>+</Text>
            </View>
            <EditableNumber
              value={character[key].max}
              label={tr('wfrp.fields.max')}
              size="sm"
              onSave={(v) => setPair(key, { max: v, current: Math.min(character[key].current, v) })}
            />
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  maxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  moveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  maxLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdown: { fontSize: 11, marginTop: 2 },
  maxRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  maxValueBox: { alignItems: 'center' },
  maxValue: { fontSize: 22, fontWeight: '700' },
  maxValueLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  allocRow: { marginTop: 12, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  allocLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  allocBtns: { flexDirection: 'row', gap: 8 },
  allocBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  allocBtnText: { fontSize: 13, fontWeight: '700' },
  pairGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pairBox: { width: '47%', borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'center', gap: 6 },
  pairLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pairVal: { fontSize: 24, fontWeight: '700' },
  minus: { fontSize: 26, fontWeight: '700', width: 28, textAlign: 'center' },
  plus: { fontSize: 26, fontWeight: '700', width: 28, textAlign: 'center' },
});
