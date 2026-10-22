// Calibrated default-whale envelope. Desktop pixels are ground coordinates;
// an animation's elevation is separate from this support plane.
export function desktopPlane({ width, height, size = 180, revision = 1 }) {
  const s = size / 180;
  return { revision, width, height,
    body: { left: 100*s, right: 100*s, top: 205*s, bottom: 8*s },
    groundBody: { left: 100*s, right: 100*s, top: 24*s, bottom: 8*s },
    margin: Math.min(12*s, 24-8*s), obstacles: [] };
}
export function planePoint(model, point) {
  // Leave half a pixel for the raster rig's projected contact round-trip.
  // A prop parked exactly on the world edge can otherwise reconstruct its
  // pickup root a few float32 ulps outside the strict navigation domain.
  const b = model.body, m = model.margin + .5;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { x: clamp(point.x, b.left+m, model.width-b.right-m),
    y: clamp(point.y, b.top+m, model.height-b.bottom-m) };
}
