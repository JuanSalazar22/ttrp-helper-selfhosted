import { apLevel, GLOW_ALPHA } from '../armourGlow';

describe('apLevel', () => {
  it('maps 0 AP to level 0', () => {
    expect(apLevel(0)).toBe(0);
  });

  it('maps increasing AP to increasing levels', () => {
    expect(apLevel(1)).toBe(1);
    expect(apLevel(2)).toBe(1);
    expect(apLevel(3)).toBe(2);
    expect(apLevel(4)).toBe(3);
  });

  it('caps at the max level for high AP', () => {
    expect(apLevel(5)).toBe(4);
    expect(apLevel(20)).toBe(4);
  });

  it('treats negative AP as 0 (defensive — AP is never negative in practice)', () => {
    expect(apLevel(-3)).toBe(0);
  });
});

describe('GLOW_ALPHA', () => {
  it('has one alpha suffix per level, strictly increasing', () => {
    expect(GLOW_ALPHA).toHaveLength(5);
    const asInt = (hex: string) => parseInt(hex, 16);
    for (let i = 1; i < GLOW_ALPHA.length; i++) {
      expect(asInt(GLOW_ALPHA[i])).toBeGreaterThan(asInt(GLOW_ALPHA[i - 1]));
    }
  });
});
