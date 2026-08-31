import { Platform } from 'react-native';

/** Turns a button's accessibilityLabel into a web hover tooltip too — one
 *  string serves both screen readers and sighted mouse users. Spread the
 *  result onto an icon-only button alongside `accessibilityLabel={label}`.
 *
 *  react-native-web's `View` (which every RN element rides on) only forwards
 *  an explicit allowlist of DOM attributes, and plain `title` isn't in it —
 *  so passing `title` as a regular prop is silently dropped. `ref`, however,
 *  is always honored by React itself (it's extracted before the allowlist
 *  ever runs), and react-native-web forwards that ref to the real underlying
 *  DOM node. A callback ref lets us set the native `title` attribute
 *  directly, which the browser then renders as a hover tooltip. Native
 *  platforms have no concept of hover, so this is a no-op there, matching
 *  this codebase's existing `Platform.OS === 'web' ? {...} : {}`
 *  conditional-prop pattern (see `onWheel` in PortraitCropper.tsx). */
export function hoverTitle(label: string): { ref?: (node: unknown) => void } {
  if (Platform.OS !== 'web') return {};
  return {
    ref: (node: unknown) => {
      if (node && typeof (node as { setAttribute?: unknown }).setAttribute === 'function') {
        (node as { setAttribute: (name: string, value: string) => void }).setAttribute('title', label);
      }
    },
  };
}
