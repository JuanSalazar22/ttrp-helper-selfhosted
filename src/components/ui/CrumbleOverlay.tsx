import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing, interpolate,
  type SharedValue,
} from 'react-native-reanimated';

const COLS = 4;
const ROWS = 3;

// Deterministic per-shard pseudo-random in [0, 1) — keeps renders stable.
// Truncated to 32 bits before the modulo so it actually scrambles (a bare
// `i * const` doesn't overflow in JS, so skipping the truncation collapses
// this to a smooth linear ramp instead of scattered values).
const hash = (i: number) => (Math.imul(i, 2654435761) >>> 0) % 97 / 97;

type ShardProps = {
  i: number;
  progress: SharedValue<number>;
  color: string;
  borderColor: string;
};

function Shard({ i, progress, color, borderColor }: ShardProps) {
  const h1 = hash(i), h2 = hash(i + 13), h3 = hash(i + 29);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 1], [0, 0.9, 0]),
    transform: [
      { translateX: progress.value * (h1 - 0.5) * 140 },
      { translateY: progress.value * (60 + h2 * 160) },
      { rotate: `${progress.value * (h3 - 0.5) * 90}deg` },
    ],
  }));
  const col = i % COLS, row = Math.floor(i / COLS);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shard, style, {
        left: `${(col / COLS) * 100}%`,
        top: `${(row / ROWS) * 100}%`,
        width: `${100 / COLS}%`,
        height: `${100 / ROWS}%`,
        backgroundColor: color,
        borderColor,
      }]}
    />
  );
}

type Props = {
  trigger: number;      // 0 = idle; increment to (re)play the crumble
  color: string;        // shard fill — match the card background
  borderColor: string;  // hairline crack color — match the card's head color
};

/** Card-colored shards that pop over the card and fall away — the roll "breaking" the UI. */
export function CrumbleOverlay({ trigger, color, borderColor }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withDelay(200, withTiming(1, { duration: 750, easing: Easing.in(Easing.quad) }));
  }, [trigger]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COLS * ROWS }, (_, i) => (
        <Shard key={i} i={i} progress={progress} color={color} borderColor={borderColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shard: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
});
