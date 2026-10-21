// Authored floor affordances. It consumes viewport/configuration, never screen content.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function livingScene({ width, height, size = 180, home = .85, range = .3, revision = 1 }) {
  const s = size / 180, floor = height - 24, edge = 112 * s;
  if (width < 650 * s || height < 420 * s) return null;
  const homeX = clamp(width * home, edge + 80 * s, width - edge), sign = home > .5 ? -1 : 1;
  const inner = clamp(homeX + sign * Math.max(280 * s, width * range), edge, width - edge);
  const shell = { x: homeX + (inner - homeX) * .65, y: floor - 44 * s };
  const destination = { x: homeX + sign * 45 * s, y: floor - 16 * s };
  const objects = [
    { id: 'home', kind: 'home', asset: 'home.svg', x: homeX - 84 * s, y: floor - 285 * s, w: 168 * s, h: 140 * s, band: [18/210,145/175,176/210,21/175] },
    { id: 'plant', kind: 'plant', asset: 'planter.svg', x: inner - 45 * s, y: floor - 170 * s, w: 90 * s, h: 84 * s, band: [6/112,60/105,101/112,37/105] },
  ];
  const model = { revision, width, height, body: { left: 100*s, right: 100*s, top: 205*s, bottom: 8*s }, groundBody: { left: 100*s, right: 100*s, top: 24*s, bottom: 8*s }, margin: Math.min(12*s,24-8*s),
    obstacles: objects.map(o => ({ id: o.id, kind: 'ground-solid', x: o.x+o.w*o.band[0], y: o.y+o.h*o.band[1], w: o.w*o.band[2], h: o.h*o.band[3] })) };
  const rootRange={min:Math.min(inner,homeX),max:Math.max(inner,homeX)};
  const targets = (x,kind) => [clamp(x - 115*s,rootRange.min,rootRange.max),clamp(x + 115*s,rootRange.min,rootRange.max)].map(x => ({ x, y: floor - (kind==='home'?96:28)*s }));
  const interests = objects.map(o => ({ id: o.id, kind: o.kind, focus: { x: o.x+o.w*.5, y: o.y+o.h*.45 }, targets: { quiet: targets(o.x+o.w*.5,o.kind), lively: targets(o.x+o.w*.5,o.kind) } }));
  return { model, objects, interests, rootRange, shell, destination, station: { x: homeX, y: floor - 12*s }, homeX };
}
