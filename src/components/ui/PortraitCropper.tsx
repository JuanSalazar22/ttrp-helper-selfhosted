import { useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Text, useWindowDimensions, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { clampTransform, cropRectFor } from './portraitCropMath';

// Minimum frame size (px) — never let a tiny/zero-width window collapse the
// crop frame to 0 or negative, which would render invisibly (black) and make
// confirm() throw ("Crop size must be greater than 0").
const MIN_FRAME = 150;
const OUTPUT_SIZE = 512;

type Props = {
  visible: boolean;
  sourceUri: string | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
};

/** Facebook-style pan/pinch crop: drag and pinch a picked photo inside a fixed
 *  circular frame, then confirm to produce a square JPEG of what's inside it.
 *  Math lives in portraitCropMath.ts (pure, unit-tested) — this component is
 *  just gesture wiring + the final expo-image-manipulator call. */
export function PortraitCropper({ visible, sourceUri, onCancel, onConfirm }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  // Reactive, not Dimensions.get('window') at module scope: the module-level
  // version was computed once at import time, and if the window hadn't been
  // measured yet at that exact moment (a real, observed race — width read as
  // 0), FRAME was stuck negative for the whole session, collapsing the crop
  // frame to 0×0 (invisible/"black") and making confirm() throw.
  const { width: windowWidth } = useWindowDimensions();
  const FRAME = Math.max(MIN_FRAME, Math.min(300, windowWidth - 48));
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0 });

  if (sourceUri && imageSize.w === 1) {
    Image.getSize(sourceUri, (w, h) => setImageSize({ w, h }));
  }

  function clamp() {
    'worklet';
    const next = clampTransform(
      { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
      imageSize.w, imageSize.h, FRAME,
    );
    scale.value = next.scale;
    translateX.value = next.translateX;
    translateY.value = next.translateY;
  }

  const pan = Gesture.Pan()
    .onStart(() => { start.value = { scale: scale.value, x: translateX.value, y: translateY.value }; })
    .onUpdate((e) => {
      translateX.value = start.value.x + e.translationX;
      translateY.value = start.value.y + e.translationY;
    })
    .onEnd(() => { clamp(); });

  const pinch = Gesture.Pinch()
    .onStart(() => { start.value = { scale: scale.value, x: translateX.value, y: translateY.value }; })
    .onUpdate((e) => { scale.value = start.value.scale * e.scale; })
    .onEnd(() => { clamp(); });

  const gesture = Gesture.Simultaneous(pan, pinch);

  // Desktop-web zoom fallback: react-native-gesture-handler's web Pinch handler
  // only fires from real multi-touch — a mouse can never produce it, and a
  // trackpad's pinch reaches the browser as a `wheel` event (with ctrlKey),
  // not a touch event, so Pinch never sees it either. Without this, zoom is
  // entirely unreachable on a non-touchscreen desktop browser. `onWheel` is a
  // react-native-web-only prop (a no-op on native, which never fires `wheel`),
  // so no Platform guard is needed on the handler itself — only on wiring it up.
  function handleWheel(e: { deltaY: number; preventDefault?: () => void }) {
    e.preventDefault?.();
    const factor = 1 - e.deltaY * 0.0015;
    const next = clampTransform(
      { scale: scale.value * factor, translateX: translateX.value, translateY: translateY.value },
      imageSize.w, imageSize.h, FRAME,
    );
    scale.value = next.scale;
    translateX.value = next.translateX;
    translateY.value = next.translateY;
  }

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  async function confirm() {
    if (!sourceUri) return;
    const rect = cropRectFor(
      { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
      imageSize.w, imageSize.h, FRAME,
    );
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ crop: rect }, { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    onConfirm(result.uri);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <View style={[styles.frameWrap, { borderRadius: FRAME / 2 }]}>
          <GestureDetector gesture={gesture}>
            <View
              style={[styles.frame, { width: FRAME, height: FRAME, borderRadius: FRAME / 2 }]}
              {...(Platform.OS === 'web' ? { onWheel: handleWheel } : {})}
            >
              {sourceUri && (
                <Animated.Image
                  source={{ uri: sourceUri }}
                  style={[{ width: FRAME, height: FRAME }, style]}
                  resizeMode="cover"
                />
              )}
            </View>
          </GestureDetector>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onCancel} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: t.colors.textSecondary }]}>{tr('common.cropCancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirm} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: t.colors.accent, fontWeight: '700' }]}>{tr('common.cropConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` alone doesn't reliably fill react-native-web's Modal portal — its
  // wrapper chain doesn't always establish a definite height for a flexed child
  // to grow into, so this collapsed to 0 height on web (verified: DevTools showed
  // an ancestor at height 0 despite the outer fixed-position layer being full
  // screen). absoluteFillObject sizes directly off the viewport instead.
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { overflow: 'hidden' },
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 40, marginTop: 32 },
  actionBtn: { padding: 12 },
  actionText: { fontSize: 16 },
});
