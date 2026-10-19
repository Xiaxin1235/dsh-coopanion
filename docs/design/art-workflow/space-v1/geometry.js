// Stage 1 editor geometry. These polylines prove clearance, never drive a body.
export const WORLD = { width: 1080, height: 660, units: 'preview-css-px', origin: 'top-left', root: 'feet-midpoint' };
// Conservative visual envelope for 180px DeepSeek + O03; checked against real
// raster frames, not the kit's smaller hit circles. Turn allowance is additional.
export const BODY = { size: 180, left: 100, right: 100, top: 205, bottom: 8, turn: 12 };
export const INITIAL = {
  revision: 1,
  actor: { x: 240, y: 555 }, shell: { x: 335, width: 40 }, destination: 390,
  objects: [
    { id: 'home', label: '小窝', asset: 'home.svg', x: 65, y: 155, w: 210, h: 175, solid: true, layer: 'depth', anchor: [170, 330] },
    { id: 'station', label: '工作岗位', asset: 'station.svg', x: 820, y: 245, w: 170, h: 120, solid: true, layer: 'depth', anchor: [850, 600] },
    { id: 'planter', label: '珊瑚花箱', asset: 'planter.svg', x: 485, y: 220, w: 112, h: 105, solid: true, layer: 'depth' },
    { id: 'gate-north', label: '门槛北柱', asset: 'post.svg', x: 621, y: 280, w: 28, h: 40, solid: true, layer: 'depth' },
    { id: 'gate-south', label: '门槛南柱', asset: 'post.svg', x: 621, y: 622, w: 28, h: 32, solid: true, layer: 'depth' },
    { id: 'panel', label: '手动内容禁区', x: 755, y: 40, w: 280, h: 195, solid: true, layer: 'restricted' },
  ],
  zones: [
    { id: 'life', label: '生活区', x: 35, y: 155, w: 410, h: 470 },
    { id: 'work', label: '岗位区', x: 735, y: 250, w: 300, h: 375 },
  ],
  route: [{ x: 240, y: 555 }, { x: 450, y: 555 }, { x: 540, y: 575 }, { x: 700, y: 600 }, { x: 850, y: 600 }],
};
export const freshLayout = () => structuredClone(INITIAL);
export const footprint = (p, body = BODY, margin = 0) => ({ x: p.x - body.left - margin, y: p.y - body.top - margin, w: body.left + body.right + 2 * margin, h: body.top + body.bottom + 2 * margin });
// Minkowski expansion around a feet-midpoint. Touching counts as collision.
export const expanded = (r, body = BODY, margin = body.turn) => ({ x: r.x - body.right - margin, y: r.y - body.bottom - margin, w: r.w + body.left + body.right + margin * 2, h: r.h + body.top + body.bottom + margin * 2 });
export function intersectsSegment(a, b, r) {
  let lo = 0, hi = 1;
  for (const [p, d, min, max] of [[a.x, b.x-a.x, r.x, r.x+r.w], [a.y, b.y-a.y, r.y, r.y+r.h]]) {
    if (d === 0) { if (p < min || p > max) return false; }
    else { const t0 = (min-p)/d, t1 = (max-p)/d; lo = Math.max(lo, Math.min(t0,t1)); hi = Math.min(hi, Math.max(t0,t1)); if (lo > hi) return false; }
  }
  return true;
}
export function checkRoute(layout, points = layout.route, body = BODY, margin = body.turn) {
  const violations = [], solids = layout.objects.filter(o => o.solid);
  if (points.length < 2 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { passed: false, violations: [{ obstacle: 'invalid-route' }], length: 0 };
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i]; length += Math.hypot(b.x-a.x,b.y-a.y);
    for (const p of [a,b]) { const f = footprint(p,body,margin); if (f.x < 0 || f.y < 0 || f.x+f.w > WORLD.width || f.y+f.h > WORLD.height) violations.push({ segment: i, obstacle: 'world-edge' }); }
    for (const r of solids) if (intersectsSegment(a,b,expanded(r,body,margin))) violations.push({ segment: i, obstacle: r.id });
  }
  return { passed: violations.length === 0, violations, length: Math.round(length), body: { ...body }, margin, revision: layout.revision };
}
export function actionRoute(layout) {
  // Enclose both left/right contact approaches as well as the shell itself.
  const xs = [layout.actor.x, layout.shell.x - 80, layout.shell.x + 80, layout.destination - 80, layout.destination + 80];
  return checkRoute(layout, [{ x: Math.min(...xs), y: layout.actor.y }, { x: Math.max(...xs), y: layout.actor.y }], BODY, 0);
}
export function occlusionOrder(objects, footY) {
  return [...objects.filter(o => o.layer === 'depth').map(o => {const floor=groundRect(o)??o;return {id:o.id,depth:floor.y+floor.h};}), { id: 'body-shell-fingers', depth: footY }].sort((a,b) => a.depth-b.depth || a.id.localeCompare(b.id)).map(o => o.id);
}

// Screen-space art is an elevation in this depth-sorted courtyard, not its
// ground occupancy. Ground bands cover the authored bases, excluding shadows;
// foliage/tabletops/roofs remain visible occluders at their physical base depth.
// The full upright body still constrains world edges and content restrictions.
export const GROUND_BODY = {left:100,right:100,top:24,bottom:8};
const SILHOUETTES = {
  home: [18/210, 2/175, 176/210, 164/175],
  station: [7/170, 6/120, 156/170, 109/120],
  planter: [6/112, 6/105, 101/112, 91/105],
  'gate-north': [3/28, 2/40, 22/28, 34/40],
  'gate-south': [3/28, 2/40, 22/28, 34/40],
};
const GROUND_BANDS = {
  home: [18/210,145/175,176/210,21/175],
  station: [7/170,81/120,156/170,34/120],
  planter: [6/112,60/105,101/112,37/105],
  'gate-north': [3/28,22/40,22/28,14/40],
  'gate-south': [3/28,22/40,22/28,14/40],
};
const mapRect=(o,shape)=>({x:o.x+shape[0]*o.w,y:o.y+shape[1]*o.h,w:shape[2]*o.w,h:shape[3]*o.h});
export function groundRect(o) {return o.layer!=='restricted'&&GROUND_BANDS[o.id]?mapRect(o,GROUND_BANDS[o.id]):null;}
export function navigationModel(layout) {
  return {revision:layout.revision,width:WORLD.width,height:WORLD.height,body:{...BODY},groundBody:{...GROUND_BODY},margin:BODY.turn,
    obstacles:layout.objects.filter(o=>o.solid).map(o=>{
      const silhouette=mapRect(o,o.layer==='restricted'?[0,0,1,1]:SILHOUETTES[o.id]??[0,0,1,1]),ground=groundRect(o);
      return {id:o.id,label:o.label,kind:o.layer==='restricted'?'full-body-restricted':ground?'ground-solid':'solid-silhouette',...(ground??silhouette),silhouette,art:{x:o.x,y:o.y,w:o.w,h:o.h}};
    })};
}
