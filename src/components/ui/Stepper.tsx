import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Step = { label: string; delta: number };

const DEFAULT_STEPS: Step[] = [
  { label: '-5', delta: -5 },
  { label: '-1', delta: -1 },
  { label: '+1', delta: +1 },
  { label: '+5', delta: +5 },
];

type Props = {
  value: number;
  max?: number;
  onStep: (next: number) => void;
  onPressValue?: () => void;
  steps?: Step[];
  label?: string;
  min?: number;
  accent?: boolean;
};

export function Stepper({
  value,
  max,
  onStep,
  onPressValue,
  steps = DEFAULT_STEPS,
  label,
  min = 0,
  accent,
}: Props) {
  const t = useTheme();
  const pct = max != null ? Math.max(0, Math.min(1, value / max)) : null;
  const barColor = pct == null ? t.colors.accent
    : pct < 0.25 ? t.colors.danger
    : pct < 0.5  ? t.colors.gold
    : t.colors.success;

  return (
    <View style={styles.root}>
      {label && (
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{label}</Text>
      )}

      {/* Value display */}
      <TouchableOpacity
        onPress={onPressValue}
        disabled={!onPressValue}
        activeOpacity={onPressValue ? 0.6 : 1}
        style={styles.valueRow}
      >
        <Text style={[styles.value, {
          color: accent ? t.colors.accent : t.colors.text,
          fontFamily: t.fontFamily.serif,
        }]}>
          {value}
        </Text>
        {max != null && (
          <Text style={[styles.max, { color: t.colors.textMuted }]}>
            {' / '}{max}
          </Text>
        )}
      </TouchableOpacity>

      {/* HP bar */}
      {pct != null && (
        <View style={[styles.barTrack, { backgroundColor: t.colors.border }]}>
          <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
        </View>
      )}

      {/* Step buttons */}
      <View style={styles.buttons}>
        {steps.map(({ label: lbl, delta }) => {
          const isNeg = delta < 0;
          const next = Math.max(min, max != null ? Math.min(max, value + delta) : value + delta);
          return (
            <TouchableOpacity
              key={lbl}
              style={[
                styles.btn,
                {
                  backgroundColor: isNeg ? t.colors.backgroundSecondary : t.colors.backgroundSecondary,
                  borderColor: isNeg ? t.colors.danger : t.colors.success,
                },
              ]}
              onPress={() => onStep(next)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: isNeg ? t.colors.danger : t.colors.success }]}>
                {lbl}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  label: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 48, fontWeight: '700', lineHeight: 52 },
  max: { fontSize: 24 },
  barTrack: { height: 6, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
