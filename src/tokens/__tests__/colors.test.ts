import { light, dark } from '../colors';

// WCAG 2.1 relative-luminance contrast ratio for two #rrggbb hexes.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe('token contrast (WCAG AA, normal text)', () => {
  for (const [name, scheme] of [['light', light], ['dark', dark]] as const) {
    const surfaces = [scheme.background, scheme.card, scheme.backgroundSecondary];
    it(`${name}: textMuted clears AA on every surface`, () => {
      for (const surf of surfaces) {
        expect(ratio(scheme.textMuted, surf)).toBeGreaterThanOrEqual(AA);
      }
    });
    it(`${name}: textSecondary clears AA on every surface`, () => {
      for (const surf of surfaces) {
        expect(ratio(scheme.textSecondary, surf)).toBeGreaterThanOrEqual(AA);
      }
    });
  }
});
