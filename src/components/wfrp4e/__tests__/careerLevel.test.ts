import { matchedLevelIndex } from '../careerLevel';

const physician = [
  { name: "Physician's Apprentice" },
  { name: 'Physician' },
  { name: 'Doktor' },
  { name: 'Court Physician' },
];

describe('matchedLevelIndex', () => {
  it('starts at the level whose title was searched', () => {
    expect(matchedLevelIndex(physician, 'Doktor')).toBe(2);
    expect(matchedLevelIndex(physician, 'court')).toBe(3);
  });
  it('is case-insensitive and trims', () => {
    expect(matchedLevelIndex(physician, '  doKTor ')).toBe(2);
  });
  it('falls back to level 1 for an empty query or no match', () => {
    expect(matchedLevelIndex(physician, '')).toBe(0);
    expect(matchedLevelIndex(physician, 'wizard')).toBe(0);
  });
});
