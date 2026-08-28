import type { WfrpFlair } from '@/dice/wfrp';

let enabled = true;
export function setSoundEnabled(value: boolean) {
  enabled = value;
}

// Roll SFX stub — architecture only, no audio shipped yet. When sounds land
// (expo-audio + bundled clips), map each flair to its clip here; every call
// site and the Settings toggle are already wired.
export async function playRollSound(flair: WfrpFlair) {
  if (!enabled || !flair) return;
}
