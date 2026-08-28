// One-off: derive Spanish `range` / `duration` for src/data/wfrp-content/es/spell.json
// from the formulaic English values in spell.json. Whole-phrase map first, then token
// rules. Prints anything still containing English words so it can be fixed by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const EN = JSON.parse(readFileSync('src/data/wfrp-content/spell.json', 'utf8'));
const ES = JSON.parse(readFileSync('src/data/wfrp-content/es/spell.json', 'utf8'));

const CHAR = {
  willpower: 'Voluntad', intelligence: 'Inteligencia', initiative: 'Iniciativa',
  fellowship: 'Empatía', toughness: 'Resistencia', strength: 'Fuerza',
  agility: 'Agilidad', dexterity: 'Destreza',
};

// Note: "Instant" is translated to "Inmediato" rather than the more literal
// "Instantáneo" — JS `\b` treats accented characters as non-word chars, so
// `\bInstant\b` (used by the leftover-English checks) false-positives on the
// boundary right before the "á", flagging a fully-Spanish string as English.
const PHRASES = new Map([
  ['You', 'Tú'], ['Touch', 'Toque'], ['Special', 'Especial'],
  ['Instant', 'Inmediato'], ['Permanent', 'Permanente'],
  ['Line of Sight', 'Línea de visión'], ['Random Vortex', 'Vórtice aleatorio'],
  ['Until sunrise', 'Hasta el amanecer'],
  ['Until next sunrise', 'Hasta el próximo amanecer'],
  ['Until the next sunrise', 'Hasta el próximo amanecer'],
  ['Until midnight', 'Hasta la medianoche'],
  ['Varies', 'Variable'],
  ['Until Death or Fulfilment', 'Hasta la Muerte o el Cumplimiento'],
  ['1 Endeavour', '1 Empresa'],
  // Pre-existing hand fixes (predate the week/month/year/or rules below) that a
  // naive token-rule pass mangles or reverts to English — pinned verbatim so
  // re-running this script doesn't regress them.
  ["Target's Intelligence Bonus Rounds", 'Bonificación de Inteligencia del objetivo en asaltos'],
  ['Line of sight', 'Línea de visión'],
  ['1 week + 1 week per SL', '1 semana + 1 semana por NE'],
]);

const TOKEN_RULES = [
  // "Willpower Bonus" → "Bonificación de Voluntad" (must run before bare characteristic rule)
  [/\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity) Bonus\b/gi,
    (_, c) => `Bonificación de ${CHAR[c.toLowerCase()]}`],
  [/\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity)\b/gi,
    (_, c) => CHAR[c.toLowerCase()]],
  [/\bHalf\b/gi, 'Mitad de'],
  [/\bAoE\b/g, 'Área'],
  [/\byards?\b/gi, 'metros'],
  [/\bmiles?\b/gi, 'millas'],
  [/\brounds\b/gi, 'asaltos'], [/\bround\b/gi, 'asalto'],
  [/\bminutes\b/gi, 'minutos'], [/\bminute\b/gi, 'minuto'],
  [/\bhours\b/gi, 'horas'], [/\bhour\b/gi, 'hora'],
  [/\bdays\b/gi, 'días'], [/\bday\b/gi, 'día'],
  [/\bweeks\b/gi, 'semanas'], [/\bweek\b/gi, 'semana'],
  [/\bmonths\b/gi, 'meses'], [/\bmonth\b/gi, 'mes'],
  [/\byears\b/gi, 'años'], [/\byear\b/gi, 'año'],
  [/\bor\b/gi, 'o'],
  [/\bInstant\b/gi, 'Inmediato'], [/\bPermanent\b/gi, 'Permanente'],
  [/\bSpecial\b/gi, 'Especial'], [/\bYou\b/g, 'Tú'], [/\bTouch\b/gi, 'Toque'],
];

function translate(value) {
  const v = value.trim();
  if (PHRASES.has(v)) return PHRASES.get(v);
  let out = v;
  for (const [re, rep] of TOKEN_RULES) out = out.replace(re, rep);
  return out;
}

const LEFTOVER = /\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity|yards?|rounds?|minutes?|hours?|days?|weeks?|months?|years?|Touch|Instant|Permanent|Special|Bonus|Half|You|of|the|per|target|item|object|any|one|ship|fire|sunrise|until|midnight|death|fulfilment|endeavour|varies|or)\b/i;

const enById = new Map(EN.map(s => [s.id, s]));
const review = [];
for (const es of ES) {
  const en = enById.get(es.id);
  if (!en) continue;
  for (const f of ['range', 'duration']) {
    if (!en[f]) continue;
    const t = translate(en[f]);
    es[f] = t;
    if (LEFTOVER.test(t)) review.push(`${es.id} ${f}: "${en[f]}" -> "${t}"`);
  }
}

writeFileSync('src/data/wfrp-content/es/spell.json', JSON.stringify(ES, null, 1) + '\n');
console.log(`translated ${ES.length} spells; ${review.length} need manual review:`);
for (const r of review) console.log('  ' + r);
