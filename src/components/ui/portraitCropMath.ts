/** Pure math behind the pan/pinch crop screen (see PortraitCropper.tsx). All
 *  units are screen/frame pixels except where noted "source pixels" (the
 *  original image's own pixel grid, used only by cropRectFor). */

export type Transform = { scale: number; translateX: number; translateY: number };

/** The scale at which the image's SHORTER dimension exactly fills a square
 *  frame of the given size — the smallest scale allowed, so the image always
 *  fully covers the circular crop area with no gaps. */
export function MIN_SCALE_FOR(imageW: number, imageH: number, frame: number): number {
  return frame / Math.min(imageW, imageH);
}

/** Clamp a proposed transform so scale never drops below the frame-filling
 *  minimum, and translation never lets an image edge show inside the frame. */
export function clampTransform(t: Transform, imageW: number, imageH: number, frame: number): Transform {
  const minScale = MIN_SCALE_FOR(imageW, imageH, frame);
  const scale = Math.max(t.scale, minScale);
  const scaledW = imageW * scale;
  const scaledH = imageH * scale;
  const maxX = Math.max(0, (scaledW - frame) / 2);
  const maxY = Math.max(0, (scaledH - frame) / 2);
  return {
    scale,
    translateX: Math.min(maxX, Math.max(-maxX, t.translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, t.translateY)),
  };
}

/** Given a (clamped) transform, the square region of the ORIGINAL image (in
 *  its own source-pixel coordinates) that lands inside the frame — the input
 *  to expo-image-manipulator's crop action. */
export function cropRectFor(
  t: Transform,
  imageW: number,
  imageH: number,
  frame: number,
): { originX: number; originY: number; width: number; height: number } {
  const sourceSize = frame / t.scale;
  const centerX = imageW / 2 - t.translateX / t.scale;
  const centerY = imageH / 2 - t.translateY / t.scale;
  return {
    originX: centerX - sourceSize / 2,
    originY: centerY - sourceSize / 2,
    width: sourceSize,
    height: sourceSize,
  };
}
