/** AP → glow level (0-4), mirroring opengym's 5-step L0-L4 shading. WFRP armour
 *  rarely exceeds 4-5 AP at one location even with layering, so the scale tops
 *  out there rather than needing a wider range. */
export function apLevel(ap: number): 0 | 1 | 2 | 3 | 4 {
  const clamped = Math.max(0, ap);
  if (clamped <= 0) return 0;
  if (clamped <= 2) return 1;
  if (clamped === 3) return 2;
  if (clamped === 4) return 3;
  return 4;
}

/** Hex alpha suffixes appended to the theme accent color, one per level — matches
 *  this codebase's existing `color + 'NN'` translucency pattern rather than pulling
 *  in a color-math library for 5 fixed steps. */
export const GLOW_ALPHA = ['14', '33', '66', '99', 'ff'] as const;
