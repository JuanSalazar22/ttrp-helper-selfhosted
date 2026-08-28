export type AdvantageMode = 'normal' | 'advantage' | 'disadvantage';

export type DieResult = {
  sides: number;
  value: number;
  dropped?: boolean;
};

export type RollResult = {
  expression: string;
  label?: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: AdvantageMode;
  isCrit: boolean;
  isFumble: boolean;
  timestamp: number;
};

export type WfrpDifficulty = { label: string; mod: number };

export const WFRP_DIFFICULTIES: WfrpDifficulty[] = [
  { label: 'Very Easy', mod: 60 },
  { label: 'Easy', mod: 40 },
  { label: 'Average', mod: 20 },
  { label: 'Challenging', mod: 0 },
  { label: 'Difficult', mod: -10 },
  { label: 'Hard', mod: -20 },
  { label: 'Very Hard', mod: -30 },
];

export type WfrpRollResult = {
  kind: 'wfrp';
  label: string;
  roll: number;
  baseTarget: number;
  difficulty: number;
  effectiveTarget: number;
  sl: number;
  success: boolean;
  isCrit: boolean;
  isFumble: boolean;
  timestamp: number;
};
