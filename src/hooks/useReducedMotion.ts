import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the OS accessibility setting for reduced motion is on
 * (Settings > Accessibility > Motion > Reduce Motion on iOS; the
 * equivalent "Remove animations" setting on Android; prefers-reduced-motion
 * on web). Animated components should skip or shorten decorative motion
 * when this is true, while still landing on the correct end state.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduced(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);

  return reduced;
}
