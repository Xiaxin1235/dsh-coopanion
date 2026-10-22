// Authored desktop affordances. It consumes viewport/configuration, never screen content.
import { desktopPlane, planePoint } from './upstream/kit/desktop-plane.js';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function livingScene({ width, height, size = 180, home = .85, range = .3, revision = 1, decorated = false, dock = null }) {
  const s = size / 180, floor = height - 24, edge = 112 * s;
  if (width < 650 * s || height < 420 * s) return null;
  const homeX = clamp(width * home, edge + 80 * s, width - edge), sign = home > .5 ? -1 : 1;
  const inner = clamp(homeX + sign * Math.max(280 * s, width * range), edge, width - edge);
  const shell = { x: homeX + (inner - homeX) * .65, y: floor - 44 * s };
  const destination = { x: homeX + sign * 45 * s, y: floor - 16 * s };
  const objects = decorated ? [
    { id: 'home', kind: 'home', asset: 'home.svg', x: homeX - 84 * s, y: floor - 285 * s, w: 168 * s, h: 140 * s, band: [18/210,145/175,176/210,21/175] },
    { id: 'plant', kind: 'plant', asset: 'planter.svg', x: inner - 45 * s, y: floor - 170 * s, w: 90 * s, h: 84 * s, band: [6/112,60/105,101/112,37/105] },
  ] : [];
  const model = desktopPlane({width,height,size,revision});
  model.obstacles = objects.map(o => ({ id: o.id, kind: 'ground-solid', x: o.x+o.w*o.band[0], y: o.y+o.h*o.band[1], w: o.w*o.band[2], h: o.h*o.band[3] }));
  const rootRange={min:Math.min(inner,homeX),max:Math.max(inner,homeX)};
  const targets = (x,kind) => [clamp(x - 115*s,rootRange.min,rootRange.max),clamp(x + 115*s,rootRange.min,rootRange.max)].map(x => ({ x, y: floor - (kind==='home'?96:28)*s }));
  const interests = objects.map(o => ({ id: o.id, kind: o.kind, focus: { x: o.x+o.w*.5, y: o.y+o.h*.45 }, targets: { quiet: targets(o.x+o.w*.5,o.kind), lively: targets(o.x+o.w*.5,o.kind) } }));
  // Old horizontal home remains the initial dock. A user placement lasts for
  // this body session, normalized so a viewport resize preserves its region.
  const station=planePoint(model,dock?{x:dock.x*width,y:dock.y*height}:{x:homeX,y:floor-12*s});
  const direction=station.x>width/2?-1:1;
  const outlook=planePoint(model,{x:station.x+direction*Math.max(280*s,width*range),
    y:station.y+(station.y>(model.body.top+height)/2?-1:1)*Math.min(height*.28,210*s)});
  const affordance=(id,kind,label,target,focus)=>({id,kind,label,focus,targets:{quiet:[target],lively:[target]}});
  interests.push(
    affordance('o03-shell','shell','贝壳',{x:shell.x+100*s,y:shell.y},{x:shell.x,y:shell.y-18*s}),
    affordance('desk-outlook','edge','可活动的桌面边界',outlook,{x:outlook.x+direction*75*s,y:outlook.y-72*s}),
    affordance('desk-dock','place','停靠位置',station,{x:station.x-direction*60*s,y:station.y-148*s})
  );
  const desktop={shell:'o03-shell',outlook:'desk-outlook',dock:'desk-dock',revision};
  return { model, objects, interests, desktop, rootRange, shell, destination, station, homeX };
}
