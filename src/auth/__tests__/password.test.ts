import { isValidPassword, MIN_PASSWORD_LENGTH } from '../password';

describe('isValidPassword', () => {
  it('rejects strings shorter than the minimum', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });
  it('accepts strings at or above the minimum', () => {
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPassword('correct-horse-battery-staple')).toBe(true);
  });
  it('rejects non-string inputs defensively', () => {
    // @ts-expect-error testing runtime behavior
    expect(isValidPassword(null)).toBe(false);
    // @ts-expect-error testing runtime behavior
    expect(isValidPassword(undefined)).toBe(false);
  });
});
