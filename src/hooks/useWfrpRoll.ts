import { useState, useCallback, useRef } from 'react';
import { rollWfrpTest, evaluateWfrpTest, flairOf } from '@/dice/wfrp';
import { haptic, hapticHeavy } from '@/lib/haptics';
import { playRollSound } from '@/lib/sound';
import type { WfrpRollResult } from '@/dice/types';

export function useWfrpRoll() {
  const [result, setResult] = useState<WfrpRollResult | null>(null);
  const last = useRef<{ roll: number; target: number; label: string; difficulty: number }>({
    roll: 0,
    target: 0,
    label: 'Test',
    difficulty: 0,
  });

  const apply = useCallback((r: WfrpRollResult) => {
    last.current = { roll: r.roll, target: r.baseTarget, label: r.label, difficulty: r.difficulty };
    if (r.isCrit || r.isFumble) hapticHeavy(); else haptic();
    playRollSound(flairOf(r));
    setResult(r);
  }, []);

  // Tap a stat/skill — first roll at Challenging (0), dice rolled for you.
  const rollTest = useCallback((target: number, label: string) => {
    apply(rollWfrpTest(target, { difficulty: 0, label }));
  }, [apply]);

  // "Roll Again" always generates a fresh virtual roll.
  const reroll = useCallback(() => {
    apply(rollWfrpTest(last.current.target, { difficulty: last.current.difficulty, label: last.current.label }));
  }, [apply]);

  // Difficulty chips recompute against whichever roll is already showing (virtual or
  // typed in) rather than discarding it for a new random one.
  const setDifficulty = useCallback((difficulty: number) => {
    apply(evaluateWfrpTest(last.current.roll, last.current.target, difficulty, last.current.label));
  }, [apply]);

  // The player rolled physically and is telling the app what they got.
  const setManualRoll = useCallback((roll: number) => {
    apply(evaluateWfrpTest(roll, last.current.target, last.current.difficulty, last.current.label));
  }, [apply]);

  const dismiss = useCallback(() => setResult(null), []);

  return { result, rollTest, setDifficulty, setManualRoll, reroll, dismiss };
}
