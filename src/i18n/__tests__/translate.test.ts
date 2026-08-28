import { translate } from '../translate';

const en = {
  greeting: 'Hello {name}',
  plain: 'Settings',
  items: { one: '{count} item', other: '{count} items' },
};
const es = {
  plain: 'Ajustes',
  // greeting and items intentionally omitted to test fallback
};

describe('translate', () => {
  test('returns the active-locale string when present', () => {
    expect(translate(es, en, 'plain')).toBe('Ajustes');
  });

  test('falls back to the fallback dict when the active key is missing', () => {
    expect(translate(es, en, 'greeting', { name: 'Karl' })).toBe('Hello Karl');
  });

  test('interpolates {placeholder} params', () => {
    expect(translate(en, en, 'greeting', { name: 'Karl' })).toBe('Hello Karl');
  });

  test('selects the plural "one" form when count === 1', () => {
    expect(translate(en, en, 'items', { count: 1 })).toBe('1 item');
  });

  test('selects the plural "other" form when count !== 1', () => {
    expect(translate(en, en, 'items', { count: 3 })).toBe('3 items');
  });

  test('returns the raw key when the key is absent everywhere', () => {
    expect(translate(es, en, 'missing.key')).toBe('missing.key');
  });
});
