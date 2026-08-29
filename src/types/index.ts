export type { Dnd5eCharacter, AbilityKey, SkillKey } from './dnd5e';
export type { Wfrp4eCharacter, CharacteristicKey } from './wfrp4e';

export type GameSystem = 'dnd5e' | 'wfrp4e';

export type CharacterData =
  | import('./dnd5e').Dnd5eCharacter
  | import('./wfrp4e').Wfrp4eCharacter;

// SQLite row shape (data column is JSON-serialized CharacterData)
export type CharacterRow = {
  id: string;
  system: GameSystem;
  name: string;
  portrait_uri: string | null;
  portrait_updated_at: string | null;
  data: string;
  schema_ver: number;
  created_at: number;
  updated_at: number;
};

export type RollHistoryRow = {
  id: string;
  character_id: string;
  label: string;
  expression: string;
  result: number;
  breakdown: string;
  rolled_at: number;
};

export type DiceMacroRow = {
  id: string;
  character_id: string;
  name: string;
  expression: string;
  created_at: number;
};
