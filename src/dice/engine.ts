import type { AdvantageMode, DieResult, RollResult } from './types';

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// Roll NdS, returns individual die results
function rollDice(count: number, sides: number): DieResult[] {
  return Array.from({ length: count }, () => ({ sides, value: rollDie(sides) }));
}

// Parse "2d6+3", "d20", "1d8-1", etc.
type ParsedExpression = { count: number; sides: number; modifier: number };

function parseExpression(expr: string): ParsedExpression {
  const clean = expr.replace(/\s/g, '').toLowerCase();
  const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Invalid dice expression: ${expr}`);
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  return { count, sides, modifier };
}

export function roll(
  expr: string,
  options: { mode?: AdvantageMode; label?: string } = {}
): RollResult {
  const { mode = 'normal', label } = options;
  const { count, sides, modifier } = parseExpression(expr);

  let dice: DieResult[];

  if (sides === 20 && count === 1 && mode !== 'normal') {
    // Roll two d20s for adv/disadv
    const [a, b] = [rollDie(20), rollDie(20)];
    const keepA = mode === 'advantage' ? a >= b : a <= b;
    dice = [
      { sides: 20, value: a, dropped: !keepA },
      { sides: 20, value: b, dropped: keepA },
    ];
  } else {
    dice = rollDice(count, sides);
  }

  const keptTotal = dice.filter(d => !d.dropped).reduce((s, d) => s + d.value, 0);
  const total = keptTotal + modifier;
  const keptDice = dice.filter(d => !d.dropped);

  const isCrit = sides === 20 && count === 1 && keptDice.length === 1 && keptDice[0].value === 20;
  const isFumble = sides === 20 && count === 1 && keptDice.length === 1 && keptDice[0].value === 1;

  return {
    expression: expr,
    label,
    dice,
    modifier,
    total,
    mode,
    isCrit,
    isFumble,
    timestamp: Date.now(),
  };
}

// Convenience: roll a D20 check with modifier (e.g. skill checks, attacks)
export function rollD20(modifier: number, options: { mode?: AdvantageMode; label?: string } = {}): RollResult {
  const sign = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const expr = modifier !== 0 ? `1d20${sign}` : '1d20';
  return roll(expr, options);
}

// Convenience: roll a plain die
export function rollPlain(sides: number, label?: string): RollResult {
  return roll(`1d${sides}`, { label });
}
