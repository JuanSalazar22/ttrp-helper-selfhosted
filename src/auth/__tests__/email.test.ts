import { isValidEmail } from '../email';

describe('isValidEmail', () => {
  it.each(['a@b.co', ' user@example.com '])('accepts %p', (v) => {
    expect(isValidEmail(v)).toBe(true);
  });
  it.each(['', 'nope', 'a@b', 'a@b.', '@b.co'])('rejects %p', (v) => {
    expect(isValidEmail(v)).toBe(false);
  });
});
