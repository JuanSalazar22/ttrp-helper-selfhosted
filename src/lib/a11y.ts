import { Platform } from 'react-native';

/** Turns a button's accessibilityLabel into a web hover tooltip too — one
 *  string serves both screen readers and sighted mouse users. Spread the
 *  result onto an icon-only button alongside `accessibilityLabel={label}`.
 *  `title` is a plain HTML attribute react-native-web forwards as-is (the
 *  browser renders it as a native tooltip on hover); native platforms have
 *  no concept of hover, so this is a no-op there, matching this codebase's
 *  existing `Platform.OS === 'web' ? {...} : {}` conditional-prop pattern
 *  (see `onWheel` in PortraitCropper.tsx). */
export function hoverTitle(label: string): { title: string } | Record<string, never> {
  return Platform.OS === 'web' ? { title: label } : {};
}
