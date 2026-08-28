import { CONTENT_SOURCES, type ContentCategory } from '@/data/wfrp-content';
import esSkill from '../skill.json';
import esTalent from '../talent.json';
import esSpell from '../spell.json';
import esPrayer from '../prayer.json';
import esTrapping from '../trapping.json';
import esCareer from '../career.json';
import esMutation from '../mutation.json';

type EsName = { id: string; name: string };

const ES: Partial<Record<ContentCategory, EsName[]>> = {
  skill: esSkill as EsName[],
  talent: esTalent as EsName[],
  spell: esSpell as EsName[],
  prayer: esPrayer as EsName[],
  trapping: esTrapping as EsName[],
  career: esCareer as EsName[],
  mutation: esMutation as EsName[],
};

describe('Spanish content overlay', () => {
  for (const cat of Object.keys(ES) as ContentCategory[]) {
    const rows = ES[cat]!;
    const enIds = new Set(CONTENT_SOURCES[cat].map((r) => r.id));

    test(`${cat}: every ES id resolves to an English entry`, () => {
      const orphans = rows.filter((r) => !enIds.has(r.id)).map((r) => r.id);
      expect(orphans).toEqual([]);
    });

    test(`${cat}: every name is a non-empty string`, () => {
      const bad = rows.filter((r) => typeof r.name !== 'string' || r.name.trim() === '');
      expect(bad).toEqual([]);
    });

    test(`${cat}: no duplicate ids`, () => {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    });
  }
});
