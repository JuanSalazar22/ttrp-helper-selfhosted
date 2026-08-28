import spellEn from '../spell.json';
import spellEs from '../es/spell.json';

type EnSpell = { id: string; range?: string; duration?: string };
type EsSpell = { id: string; range?: string; duration?: string };

describe('ES spell overlay range/duration', () => {
  const enById = new Map((spellEn as EnSpell[]).map(s => [s.id, s]));

  test('every ES spell whose EN source has range/duration carries a non-empty translation', () => {
    const missing: string[] = [];
    for (const es of spellEs as EsSpell[]) {
      const en = enById.get(es.id);
      if (!en) continue;
      if (en.range && !(es.range ?? '').trim()) missing.push(`${es.id} range`);
      if (en.duration && !(es.duration ?? '').trim()) missing.push(`${es.id} duration`);
    }
    expect(missing).toEqual([]);
  });

  test('no leftover untranslated English tokens in ES fields', () => {
    const english = /\b(Willpower|Intelligence|Initiative|Fellowship|Toughness|Strength|Agility|Dexterity|yards?|rounds?|minutes?|hours?|days?|weeks?|months?|years?|Touch|Instant|Permanent|Special|Bonus|Half|You|sunrise|until|midnight|death|fulfilment|endeavour|varies|or)\b/i;
    const bad: string[] = [];
    for (const es of spellEs as EsSpell[]) {
      for (const f of ['range', 'duration'] as const) {
        const v = es[f];
        if (v && english.test(v)) bad.push(`${es.id} ${f}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
