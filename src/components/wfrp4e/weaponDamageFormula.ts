import { characteristicBonus } from '@/types/wfrp4e';
import type { Wfrp4eCharacter, CharacteristicKey } from '@/types/wfrp4e';

// Fixed rulebook abbreviations for each characteristic bonus, English and
// Spanish (mirrors wfrp.charBonus in src/i18n/en.ts and src/i18n/es.ts — keep
// these in sync if those ever change). Matched case-insensitively.
const ABBREV_TO_KEY: Record<string, CharacteristicKey> = {
  WSB: 'ws', BSB: 'bs', SB: 's', TB: 't', IB: 'i',
  AGB: 'ag', DEXB: 'dex', INTB: 'int', WPB: 'wp', FELB: 'fel',
  BHA: 'ws', BHP: 'bs', BF: 's', BR: 't', BI: 'i',
  BAG: 'ag', BDES: 'dex', BINT: 'int', BV: 'wp', BEM: 'fel',
};

// Sorted longest-first so the tokenizer greedily matches e.g. "BINT" before
// falling back to the shorter "BI" (a real prefix collision in the table
// above), and so "DEXB" is consumed as one token instead of splitting off
// its internal "x" as a multiply operator.
const ABBREV_ENTRIES: Array<[string, CharacteristicKey]> = Object.entries(ABBREV_TO_KEY).sort(
  (a, b) => b[0].length - a[0].length,
);

type Token =
  | { type: 'NUMBER'; value: number }
  | { type: 'ABBREV'; key: CharacteristicKey }
  | { type: 'PLUS' }
  | { type: 'TIMES' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

/** Turns a formula string into tokens, or null on any unrecognized character. */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '+') { tokens.push({ type: 'PLUS' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }

    let matchedAbbrev = false;
    for (const [abbrev, key] of ABBREV_ENTRIES) {
      if (input.slice(i, i + abbrev.length).toUpperCase() === abbrev) {
        tokens.push({ type: 'ABBREV', key });
        i += abbrev.length;
        matchedAbbrev = true;
        break;
      }
    }
    if (matchedAbbrev) continue;

    if (ch === 'x' || ch === 'X' || ch === '*') { tokens.push({ type: 'TIMES' }); i++; continue; }

    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < n && input[j] >= '0' && input[j] <= '9') j++;
      tokens.push({ type: 'NUMBER', value: parseInt(input.slice(i, j), 10) });
      i = j;
      continue;
    }

    return null; // unrecognized character
  }
  return tokens;
}

type ParseState = { tokens: Token[]; pos: number; usedAbbrev: boolean };

function peek(state: ParseState): Token | undefined {
  return state.tokens[state.pos];
}

// expr := term ('+' term)*
function parseExpr(state: ParseState, char: Wfrp4eCharacter): number | null {
  let value = parseTerm(state, char);
  if (value === null) return null;
  while (peek(state)?.type === 'PLUS') {
    state.pos++;
    const rhs = parseTerm(state, char);
    if (rhs === null) return null;
    value += rhs;
  }
  return value;
}

// term := factor (('x'|'X'|'*') factor)*
function parseTerm(state: ParseState, char: Wfrp4eCharacter): number | null {
  let value = parseFactor(state, char);
  if (value === null) return null;
  while (peek(state)?.type === 'TIMES') {
    state.pos++;
    const rhs = parseFactor(state, char);
    if (rhs === null) return null;
    value *= rhs;
  }
  return value;
}

// factor := NUMBER | ABBREV | '(' expr ')'
function parseFactor(state: ParseState, char: Wfrp4eCharacter): number | null {
  const tok = peek(state);
  if (!tok) return null;
  if (tok.type === 'NUMBER') { state.pos++; return tok.value; }
  if (tok.type === 'ABBREV') {
    state.pos++;
    state.usedAbbrev = true;
    return characteristicBonus(char, tok.key);
  }
  if (tok.type === 'LPAREN') {
    state.pos++;
    const value = parseExpr(state, char);
    if (value === null) return null;
    if (peek(state)?.type !== 'RPAREN') return null;
    state.pos++;
    return value;
  }
  return null;
}

/**
 * Resolves a weapon's free-text damage formula (e.g. "SB+4", "(SBx2)+TB+4")
 * against a character's current stats. Recognizes any of the 10
 * characteristic-bonus abbreviations in English or Spanish, `+` for addition,
 * `x`/`X`/`*` for multiplication (binds tighter than `+`), and parentheses
 * for grouping.
 *
 * Returns null — meaning "nothing new to show" — when the formula has no
 * characteristic term at all (a bare number already shows its own final
 * value), or when it fails to parse (unknown token, unmatched parenthesis,
 * trailing garbage, empty string). Never throws.
 */
export function resolveWeaponDamage(char: Wfrp4eCharacter, formula: string): number | null {
  const trimmed = formula.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return null;

  const state: ParseState = { tokens, pos: 0, usedAbbrev: false };
  const value = parseExpr(state, char);
  if (value === null) return null;
  if (state.pos !== tokens.length) return null; // trailing tokens after a valid expression
  if (!state.usedAbbrev) return null;

  return value;
}
