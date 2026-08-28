import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  Haptics = require('expo-haptics');
}

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export async function haptic() {
  if (!enabled) return;
  try {
    await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export async function hapticHeavy() {
  if (!enabled) return;
  try {
    await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}
