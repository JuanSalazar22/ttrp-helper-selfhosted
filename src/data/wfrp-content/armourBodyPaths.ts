import type { ArmourLocation } from '@/types/wfrp4e';

/** Front-view body silhouette split into WFRP4e's 6 body-part armour zones (shield
 *  isn't a body part, so it's not here — see ArmourBodyMap's separate badge).
 *  Simple hand-authored flat shapes (circle head, trapezoid torso, rectangle limbs) —
 *  not derived from any third-party art, no attribution needed. A first version
 *  adapted a muscle-atlas silhouette instead; that didn't look right once rendered,
 *  so it was replaced with this — which is exactly why the geometry lives in its own
 *  file: ArmourBodyMap.tsx only depends on this exact shape, nothing else about the
 *  art, so swapping styles again later is a one-file change.
 *
 *  Left/right: a front-facing figure, so screen-left is the character's own right
 *  side and vice versa (same convention as looking at another person, or a mirror). */
export const ARMOUR_BODY_VIEWBOX = '0 0 200 340';

export const ARMOUR_BODY_REGIONS: Record<Exclude<ArmourLocation, 'shield'>, string[]> = {
  head: [
    'M 70,35 A 30,30 0 1,0 130,35 A 30,30 0 1,0 70,35 Z',
  ],
  body: [
    'M 60,65 L 140,65 L 130,180 L 70,180 Z',
  ],
  rightArm: [
    'M 22,70 L 54,70 L 54,185 L 22,185 Z',
  ],
  leftArm: [
    'M 146,70 L 178,70 L 178,185 L 146,185 Z',
  ],
  rightLeg: [
    'M 68,182 L 96,182 L 96,330 L 68,330 Z',
  ],
  leftLeg: [
    'M 104,182 L 132,182 L 132,330 L 104,330 Z',
  ],
};
