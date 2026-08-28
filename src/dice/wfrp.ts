import type { WfrpRollResult } from './types';

function isDouble(roll: number): boolean {
  return roll === 100 || (roll % 11 === 0 && roll >= 11 && roll <= 99);
}

export function evaluateWfrpTest(
  roll: number,
  baseTarget: number,
  difficulty = 0,
  label = 'Test',
): WfrpRollResult {
  const effectiveTarget = baseTarget + difficulty;
  // RAW: 01–05 always succeeds, 96–00 always fails, regardless of target.
  const success = roll <= 5 ? true : roll >= 96 ? false : roll <= effectiveTarget;
  const sl = Math.floor(effectiveTarget / 10) - Math.floor(roll / 10);
  const dbl = isDouble(roll);
  return {
    kind: 'wfrp',
    label,
    roll,
    baseTarget,
    difficulty,
    effectiveTarget,
    sl,
    success,
    isCrit: success && dbl,
    isFumble: !success && dbl,
    timestamp: Date.now(),
  };
}

export function rollWfrpTest(
  baseTarget: number,
  opts: { difficulty?: number; label?: string } = {},
): WfrpRollResult {
  const roll = Math.floor(Math.random() * 100) + 1;
  return evaluateWfrpTest(roll, baseTarget, opts.difficulty ?? 0, opts.label ?? 'Test');
}

export type WfrpFlair = 'chaos' | 'crit' | 'fumble' | 'autoSuccess' | 'autoFailure' | null;

// Presentation tier for special rolls. Priority: 88 is Chaos-flavored above all;
// doubles crit/fumble; then RAW auto bands.
export function flairOf(r: WfrpRollResult): WfrpFlair {
  if (r.roll === 88) return 'chaos';
  if (r.isCrit) return 'crit';
  if (r.isFumble) return 'fumble';
  if (r.roll <= 5) return 'autoSuccess';
  if (r.roll >= 96) return 'autoFailure';
  return null;
}
