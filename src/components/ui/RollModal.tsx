import { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
  withTiming, runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import type { RollResult } from '@/dice/types';

type Props = {
  result: RollResult | null;
  onClose: () => void;
  onReroll: () => void;
};

function DicePip({ sides, value, dropped }: { sides: number; value: number; dropped?: boolean }) {
  const t = useTheme();
  return (
    <View style={[
      styles.pip,
      {
        backgroundColor: dropped ? t.colors.backgroundSecondary : t.colors.accent + '22',
        borderColor: dropped ? t.colors.border : t.colors.accent,
        opacity: dropped ? 0.4 : 1,
      },
    ]}>
      <Text style={[styles.pipDie, { color: t.colors.textSecondary }]}>d{sides}</Text>
      <Text style={[styles.pipVal, { color: dropped ? t.colors.textMuted : t.colors.text, fontFamily: t.fontFamily.serif }]}>
        {value}
      </Text>
    </View>
  );
}

export function RollModal({ result, onClose, onReroll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const bounce = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * bounce.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (result) {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
      bounce.value = withSequence(
        withTiming(1.12, { duration: 100 }),
        withSpring(1, { damping: 12, stiffness: 300 }),
      );
    } else {
      scale.value = withTiming(0.5, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [result]);

  if (!result) return null;

  const modStr = result.modifier > 0 ? `+${result.modifier}` : result.modifier < 0 ? `${result.modifier}` : '';
  const isCrit = result.isCrit;
  const isFumble = result.isFumble;

  const totalColor = isCrit ? t.colors.success : isFumble ? t.colors.danger : t.colors.text;
  const totalLabel = isCrit ? tr('roll.criticalHit') : isFumble ? tr('roll.fumble') : result.label ?? result.expression;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.card, { backgroundColor: t.colors.card, borderColor: isCrit ? t.colors.success : isFumble ? t.colors.danger : t.colors.border }, animStyle]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Label */}
            <Text style={[styles.label, { color: totalColor }]}>{totalLabel}</Text>

            {/* Total */}
            <Text style={[styles.total, { color: totalColor, fontFamily: t.fontFamily.serif }]}>
              {result.total}
            </Text>

            {/* Dice breakdown */}
            <View style={styles.pips}>
              {result.dice.map((d, i) => (
                <DicePip key={i} sides={d.sides} value={d.value} dropped={d.dropped} />
              ))}
            </View>

            {/* Modifier line */}
            {modStr ? (
              <Text style={[styles.modifier, { color: t.colors.textSecondary }]}>
                {result.dice.filter(d => !d.dropped).map(d => d.value).join(' + ')}{modStr} = {result.total}
              </Text>
            ) : result.dice.length > 1 ? (
              <Text style={[styles.modifier, { color: t.colors.textSecondary }]}>
                {result.dice.filter(d => !d.dropped).map(d => d.value).join(' + ')} = {result.total}
              </Text>
            ) : null}

            {/* Mode badge */}
            {result.mode !== 'normal' && (
              <View style={[styles.modeBadge, { backgroundColor: t.colors.accent + '22', borderColor: t.colors.accent }]}>
                <Text style={[styles.modeText, { color: t.colors.accent }]}>
                  {result.mode === 'advantage' ? tr('roll.advantage') : tr('roll.disadvantage')}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onReroll}>
                <Text style={[styles.btnText, { color: t.colors.accent }]}>{tr('common.rollAgain')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnClose, { backgroundColor: t.colors.accent }]} onPress={onClose}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  total: { fontSize: 80, fontWeight: '700', lineHeight: 88 },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pip: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', gap: 2, minWidth: 54 },
  pipDie: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  pipVal: { fontSize: 22, fontWeight: '700' },
  modifier: { fontSize: 13, marginTop: 2 },
  modeBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  modeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnClose: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
