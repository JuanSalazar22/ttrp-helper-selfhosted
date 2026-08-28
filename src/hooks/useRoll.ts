import { useState, useCallback, useRef } from 'react';
import type { RollResult, AdvantageMode } from '@/dice/types';
import { roll, rollD20, rollPlain } from '@/dice/engine';
import { haptic, hapticHeavy } from '@/lib/haptics';

export function useRoll() {
  const [result, setResult] = useState<RollResult | null>(null);
  const lastRoll = useRef<() => RollResult>(() => rollPlain(20));

  const doRoll = useCallback((fn: () => RollResult) => {
    lastRoll.current = fn;
    const r = fn();
    if (r.isCrit || r.isFumble) hapticHeavy(); else haptic();
    setResult(r);
  }, []);

  const rollCheck = useCallback((modifier: number, label: string, mode: AdvantageMode = 'normal') => {
    doRoll(() => rollD20(modifier, { label, mode }));
  }, [doRoll]);

  const rollExpression = useCallback((expr: string, label?: string, mode: AdvantageMode = 'normal') => {
    doRoll(() => roll(expr, { label, mode }));
  }, [doRoll]);

  const rollDie = useCallback((sides: number, label?: string) => {
    doRoll(() => rollPlain(sides, label));
  }, [doRoll]);

  const reroll = useCallback(() => {
    doRoll(lastRoll.current);
  }, [doRoll]);

  const dismiss = useCallback(() => setResult(null), []);

  return { result, rollCheck, rollExpression, rollDie, reroll, dismiss };
}
