// Spanish name overlays for bundled WFRP book content. Seeded into content_translations
// (locale 'es') on launch. Bump ES_CONTENT_SEED_VERSION whenever any es/*.json changes.
import skill from './skill.json';
import talent from './talent.json';
import spell from './spell.json';
import prayer from './prayer.json';
import trapping from './trapping.json';
import career from './career.json';
import mutation from './mutation.json';
import critical_wound from './critical_wound.json';

export const ES_CONTENT_SEED_VERSION = 'es-7';

export type EsOverlay = { id: string; name: string; description?: string; page?: string; range?: string; duration?: string };

export const WFRP_CONTENT_ES: EsOverlay[] = [
  ...(skill as EsOverlay[]),
  ...(talent as EsOverlay[]),
  ...(spell as EsOverlay[]),
  ...(prayer as EsOverlay[]),
  ...(trapping as EsOverlay[]),
  ...(career as EsOverlay[]),
  ...(mutation as EsOverlay[]),
  ...(critical_wound as EsOverlay[]),
];
