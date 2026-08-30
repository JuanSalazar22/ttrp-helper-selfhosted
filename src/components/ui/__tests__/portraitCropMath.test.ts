import { clampTransform, cropRectFor, MIN_SCALE_FOR } from '../portraitCropMath';

describe('MIN_SCALE_FOR', () => {
  it('is the scale at which the shorter image dimension exactly fills the frame', () => {
    // A 1000x2000 portrait image in a 300x300 frame: shorter side (1000) must
    // reach 300, so min scale is 300/1000 = 0.3.
    expect(MIN_SCALE_FOR(1000, 2000, 300)).toBeCloseTo(0.3);
    // A 2000x1000 landscape image in a 300x300 frame: shorter side (1000) must
    // reach 300, so min scale is 300/1000 = 0.3 too (shorter side always drives it).
    expect(MIN_SCALE_FOR(2000, 1000, 300)).toBeCloseTo(0.3);
  });
});

describe('clampTransform', () => {
  const frame = 300;
  const imageW = 1000;
  const imageH = 2000; // portrait image, min scale = 0.3

  it('clamps scale up to the minimum that fills the frame', () => {
    const r = clampTransform({ scale: 0.1, translateX: 0, translateY: 0 }, imageW, imageH, frame);
    expect(r.scale).toBeCloseTo(0.3);
  });

  it('leaves scale unchanged when already above the minimum', () => {
    const r = clampTransform({ scale: 0.5, translateX: 0, translateY: 0 }, imageW, imageH, frame);
    expect(r.scale).toBeCloseTo(0.5);
  });

  it('clamps translation so the image edge never enters the frame', () => {
    // At scale 0.3, scaled image is 300x600 — centered, it can pan at most
    // (600-300)/2 = 150 vertically before an edge shows; horizontally it's
    // already exactly the frame width, so translateX must clamp to 0.
    const r = clampTransform({ scale: 0.3, translateX: 999, translateY: 999 }, imageW, imageH, frame);
    expect(r.translateX).toBeCloseTo(0);
    expect(r.translateY).toBeCloseTo(150);
  });

  it('clamps negative translation symmetrically', () => {
    const r = clampTransform({ scale: 0.3, translateX: -999, translateY: -999 }, imageW, imageH, frame);
    expect(r.translateX).toBeCloseTo(0);
    expect(r.translateY).toBeCloseTo(-150);
  });
});

describe('cropRectFor', () => {
  it('maps a centered, minimum-scale transform to the full shorter-side square', () => {
    // 1000x2000 image, frame 300, scale 0.3 (fills width), no pan: the crop
    // should be the full width (1000) and a centered 1000-tall vertical slice.
    const rect = cropRectFor({ scale: 0.3, translateX: 0, translateY: 0 }, 1000, 2000, 300);
    expect(rect.originX).toBeCloseTo(0);
    expect(rect.originY).toBeCloseTo(500); // (2000 - 1000) / 2
    expect(rect.width).toBeCloseTo(1000);
    expect(rect.height).toBeCloseTo(1000);
  });

  it('shifts the crop origin opposite to a pan', () => {
    // Panning the image down by 30 screen px at scale 0.3 reveals more of the
    // top of the image — in source pixels that's translateY / scale = 100px,
    // shifting the crop's originY up (i.e. showing an earlier/higher region).
    const rect = cropRectFor({ scale: 0.3, translateX: 0, translateY: 30 }, 1000, 2000, 300);
    expect(rect.originY).toBeCloseTo(400); // 500 - (30 / 0.3)
  });
});
