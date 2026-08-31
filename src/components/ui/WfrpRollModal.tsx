import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTranslation } from '@/i18n';
import { WFRP_DIFFICULTIES } from '@/dice/types';
import { flairOf, type WfrpFlair } from '@/dice/wfrp';
import type { WfrpRollResult } from '@/dice/types';
import { CrumbleOverlay } from '@/components/ui/CrumbleOverlay';

type Props = {
  result: WfrpRollResult | null;
  onClose: () => void;
  onReroll: () => void;
  onDifficulty: (mod: number) => void;
  onManualRoll: (roll: number) => void;
};

const GOLD = '#d4af37';
const CHAOS_PURPLE = '#8b30c9';

const FLAIR_CAPTION = {
  chaos: 'ui.wfrpRoll.flairChaos',
  autoSuccess: 'ui.wfrpRoll.flairAutoSuccess',
  autoFailure: 'ui.wfrpRoll.flairAutoFailure',
} as const;

// The card breaks on any failed special roll; a successful 88 keeps its flames
// but nothing crumbles.
function isCrumble(flair: WfrpFlair, success: boolean): boolean {
  if (flair === 'fumble' || flair === 'autoFailure') return true;
  return flair === 'chaos' && !success;
}

export function WfrpRollModal({ result, onClose, onReroll, onDifficulty, onManualRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const bounce = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [crumbleKey, setCrumbleKey] = useState(0);
  const reducedMotion = useReducedMotion();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value * bounce.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (result) {
      setEditing(false);
      const flair = flairOf(result);
      const crumble = isCrumble(flair, result.success);
      setCrumbleKey(k => (crumble ? k + 1 : 0));
      if (reducedMotion) {
        // Land on the correct end state immediately — no bounce/shake.
        scale.value = 1;
        opacity.value = 1;
        bounce.value = 1;
        shakeX.value = 0;
        return;
      }
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
      if (flair === 'crit' || flair === 'autoSuccess') {
        bounce.value = withSequence(
          withTiming(1.18, { duration: 110 }),
          withSpring(1, { damping: 8, stiffness: 260 }),
        );
      } else {
        bounce.value = withSequence(
          withTiming(1.12, { duration: 100 }),
          withSpring(1, { damping: 12, stiffness: 300 }),
        );
      }
      if (crumble) {
        shakeX.value = withSequence(
          withTiming(-16, { duration: 45 }), withTiming(14, { duration: 45 }),
          withTiming(-10, { duration: 45 }), withTiming(8, { duration: 45 }),
          withTiming(-4, { duration: 45 }), withTiming(0, { duration: 45 }),
        );
      } else if (flair === 'chaos') {
        shakeX.value = withSequence(
          withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
          withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      } else {
        shakeX.value = 0;
      }
    } else {
      setCrumbleKey(0);
      if (reducedMotion) {
        scale.value = 0.5;
        opacity.value = 0;
        return;
      }
      scale.value = withTiming(0.5, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [result, reducedMotion]);

  if (!result) return null;

  function startEditing() {
    setDraft(String(result!.roll));
    setEditing(true);
  }

  function commitEdit() {
    const n = parseInt(draft, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 100) onManualRoll(n);
    setEditing(false);
  }

  const flair = flairOf(result);
  const crit = result.isCrit;
  const fumble = result.isFumble;
  const headColor = flair === 'chaos' ? CHAOS_PURPLE
    : crit ? GOLD
    : fumble ? t.colors.danger
    : result.success ? t.colors.success : t.colors.danger;
  const headLabel = crit ? 'CRITICAL!' : fumble ? 'FUMBLE!'
    : result.success ? 'SUCCESS' : 'FAILURE';
  const slStr = result.sl >= 0 ? `+${result.sl}` : `${result.sl}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.card, { backgroundColor: t.colors.card, borderColor: headColor }, animStyle]}
        >
          {flair === 'chaos' && (
            <View pointerEvents="none" style={styles.flames}>
              <LottieView
                source={require('@/assets/lottie/flames.json')}
                autoPlay={!reducedMotion}
                loop={!reducedMotion}
                style={styles.flamesLottie}
                webStyle={{ width: '100%', height: 150 }}
              />
            </View>
          )}
          <TouchableOpacity activeOpacity={1}>
            <Text style={[styles.label, { color: t.colors.textSecondary }]} numberOfLines={1}>
              {result.label}
            </Text>
            <Text style={[styles.head, { color: headColor }]}>{headLabel}</Text>

            {editing ? (
              <TextInput
                style={[styles.roll, styles.rollInput, { color: t.colors.text, borderColor: headColor, fontFamily: t.fontFamily.serif }]}
                value={draft}
                onChangeText={setDraft}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                maxLength={3}
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
              />
            ) : (
              <TouchableOpacity onPress={startEditing} accessibilityLabel={tr('ui.wfrpRoll.editRoll')}>
                <Text style={[styles.roll, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
                  {result.roll}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.vs, { color: t.colors.textSecondary }]}>
              vs {result.effectiveTarget}
              {result.difficulty !== 0
                ? ` (${result.baseTarget}${result.difficulty > 0 ? '+' : ''}${result.difficulty})`
                : ''}
            </Text>

            <View style={[styles.slBadge, { borderColor: headColor, backgroundColor: headColor + '18' }]}>
              <Text style={[styles.slText, { color: headColor }]}>{slStr} SL</Text>
            </View>

            {flair && flair in FLAIR_CAPTION && (
              <Text style={[styles.flair, { color: headColor }]}>
                {tr(FLAIR_CAPTION[flair as keyof typeof FLAIR_CAPTION])}
              </Text>
            )}

            <View style={styles.diffRow}>
              {WFRP_DIFFICULTIES.map(d => {
                const active = d.mod === result.difficulty;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.diffChip, {
                      borderColor: active ? t.colors.accent : t.colors.border,
                      backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
                    }]}
                    onPress={() => onDifficulty(d.mod)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.diffText, { color: active ? t.colors.accent : t.colors.textMuted }]}>
                      {d.mod > 0 ? `+${d.mod}` : d.mod}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onReroll}>
                <Text style={[styles.btnText, { color: t.colors.accentFg }]}>{tr('ui.wfrpRoll.rollAgain')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnClose, { backgroundColor: t.colors.accent }]} onPress={onClose}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('ui.wfrpRoll.done')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {(flair === 'crit' || flair === 'autoSuccess') && (
            <View pointerEvents="none" style={styles.halo}>
              <LottieView
                source={require('@/assets/lottie/halo.json')}
                autoPlay={!reducedMotion}
                loop={!reducedMotion}
                style={styles.haloLottie}
                webStyle={{ width: '100%', height: '100%' }}
              />
            </View>
          )}

          {crumbleKey > 0 && (
            <CrumbleOverlay trigger={crumbleKey} color={t.colors.card} borderColor={headColor} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  head: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  roll: { fontSize: 72, fontWeight: '700', lineHeight: 80, textAlign: 'center' },
  rollInput: { alignSelf: 'center', width: 160, borderBottomWidth: 2 },
  vs: { fontSize: 14 },
  flair: { fontSize: 12, fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
  slBadge: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  slText: { fontSize: 18, fontWeight: '700' },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 },
  diffChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 40, alignItems: 'center' },
  diffText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnClose: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
  flames: { ...StyleSheet.absoluteFill, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  flamesLottie: { width: '100%', height: 150 },
  halo: { position: 'absolute', top: -58, alignSelf: 'center', width: 190, height: 100 },
  haloLottie: { width: '100%', height: '100%' },
});
