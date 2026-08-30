import { useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { clampTransform, cropRectFor } from './portraitCropMath';

const FRAME = Math.min(300, Dimensions.get('window').width - 48);
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
        <View style={styles.frameWrap}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.frame, { width: FRAME, height: FRAME, borderRadius: FRAME / 2 }]}>
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
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { overflow: 'hidden', borderRadius: FRAME / 2 },
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 40, marginTop: 32 },
  actionBtn: { padding: 12 },
  actionText: { fontSize: 16 },
});
