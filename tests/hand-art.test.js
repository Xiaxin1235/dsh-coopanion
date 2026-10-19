import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { checkHandArt } from '../scripts/check-hand-art.mjs';
import { handWeights, planHandArt, handSurfaceModel, handSurfaceState, splitHandRgba } from '../web/upstream/whale/hand-art.js';
import { readRgbaPng } from '../scripts/lib/rgba-png.mjs';
import { initialMotion, stepMotion } from '../web/prop-motion.js';
const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const profile = load('../web/props/shell/motion-with-hands.json'), spec = load('../web/props/shell/hands/asset.json');
const seed = () => initialMotion(profile);
const input = { now: 1, dt: .05, bodyX: 250, moving: false, facingReady: true, contact: { distance: 0, groundDistance: 0, settled: true } };
const run = (state, extra = {}) => stepMotion(state, { ...input, ...extra }, profile);
describe('hand art and contact ownership', () => {
  it('checks the actual three PNG files, wrist pixels, empty grip pocket and opaque front fingertips', async () => {
    const report = await checkHandArt(fileURLToPath(new URL('../web/props/shell/hands/asset.json', import.meta.url)));
    expect(report.passed).toBe(true); expect(report.assets.grip.contactAlpha).toBe(0);
    expect(report.propRim.alpha).toBeGreaterThanOrEqual(240);
    expect(new Set(Object.values(report.assets).map(r => r.sha256)).size).toBe(3);
  });
  it('registers every original-pixel wrist and contact at the same rig anchors without modifying the PNG', () => {
    for (const p of Object.values(planHandArt(spec))) {
      const a = p.angle * Math.PI / 180, dx = p.sourceContact[0] - p.pivot[0], dy = p.sourceContact[1] - p.pivot[1];
      expect(p.pivot).toEqual(spec.wrist);
      expect(p.pivot[0] + dx * Math.cos(a) - dy * Math.sin(a)).toBeCloseTo(spec.contact[0], 10);
      expect(p.pivot[1] + dx * Math.sin(a) + dy * Math.cos(a)).toBeCloseTo(spec.contact[1], 10);
    }
    const p = planHandArt(spec).grip;
    const sourceX = spec.assets.grip.frontRect.x, sourceY = spec.assets.grip.frontRect.y;
    expect(p.front.box[0] - p.full.box[0]).toBeCloseTo((sourceX - spec.assets.grip.visibleBounds.x) * p.scale);
    expect(p.front.box[1] - p.full.box[1]).toBeCloseTo((sourceY - spec.assets.grip.visibleBounds.y) * p.scale);
  });
  it('closes fingers only after reaching contact and opens them after touching down', () => {
    expect(handWeights({ ...seed(), phase: 'reach', elapsed: profile.seconds.reach }, profile)).toEqual({ original: 0, reach: 1, grip: 0, release: 0 });
    expect(handWeights({ ...seed(), phase: 'grasp', elapsed: profile.seconds.grasp }, profile).grip).toBe(1);
    expect(handWeights({ ...seed(), phase: 'release', elapsed: 0 }, profile).grip).toBe(1);
    expect(handWeights({ ...seed(), phase: 'release', elapsed: profile.seconds.release }, profile).release).toBe(1);
  });
  it('holds the exact pose weights across pause', () => {
    for (const phase of ['reach', 'grasp', 'lift', 'carry', 'release', 'retract', 'rise']) for (const elapsed of [0, .05, .1, .2, .4, 1]) {
      const state = { ...seed(), phase, elapsed }, active = handWeights(state, profile);
      expect(handWeights({ ...state, phase: 'paused', suspended: phase }, profile)).toEqual(active);
      expect(Object.values(active).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(Object.values(active).every(v => v >= 0 && v <= 1)).toBe(true);
    }
  });
  it('partitions every actual painted pixel between palm and fingers without duplicating outlines', () => {
    const png=readRgbaPng(readFileSync(new URL('../web/props/shell/hands/grip.png',import.meta.url)));
    const surface=handSurfaceModel(spec), split=splitHandRgba(png.pixels,png.width,png.height,surface.frontBoundary);
    let palmCount=0,fingerCount=0;
    for(let i=0;i<png.pixels.length;i+=4) {
      if(split.palm[i+3]) palmCount++;if(split.fingers[i+3]) fingerCount++;
      if(split.palm[i+3] && split.fingers[i+3]) throw new Error('duplicated source pixel '+i);
      for(let c=0;c<4;c++) if(split.palm[i+c]+split.fingers[i+c]!==png.pixels[i+c]) throw new Error('lost source pixel '+i);
    }
    expect(palmCount).toBeGreaterThan(100000);expect(fingerCount).toBeGreaterThan(10000);
  });
  it('keeps a single opaque hand and fixed cuff/wrist/contact while continuously bending the real mesh', () => {
    const surface=handSurfaceModel(spec), p=surface.plan, [x,y,w,h]=p.full.box;
    expect(surface.parts.map(p=>p.tex)).toEqual(['__hand_palm','__hand_fingers']);
    let previous;
    for(let i=0;i<=60;i++) {
      const state=handSurfaceState(surface,handWeights({...seed(),phase:'grasp',elapsed:profile.seconds.grasp*i/60},profile));
      expect(Object.values(state.alpha)).toEqual([1,1]);
      expect(Math.hypot(...state.__handShape.fn(0,0,...spec.wrist))).toBe(0);
      const contact=state.__handShape.fn(0,0,...p.sourceContact);expect(Math.hypot(...contact)).toBeLessThan(1e-12);
      const mesh=[];
      for(let j=0;j<=32;j++) for(let k=0;k<=24;k++) {
        const px=x+w*k/24,py=y+h*j/32,d=state.__handShape.fn(0,0,px,py);mesh.push([px+d[0],py+d[1]]);
        if(j<8) expect(Math.hypot(...d)).toBe(0);
      }
      if(previous) expect(Math.max(...mesh.map((q,k)=>Math.hypot(q[0]-previous[k][0],q[1]-previous[k][1])))).toBeLessThan(.15);
      for(let j=0;j<32;j++) for(let k=0;k<24;k++) {
        const a=j*25+k,b=a+1,c=a+25,d=c+1;
        for(const [p,q,r] of [[mesh[a],mesh[b],mesh[c]],[mesh[b],mesh[d],mesh[c]]])
          if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])<=0) throw new Error('folded hand triangle');
      }
      previous=mesh;
    }
  });
  it('cannot pick up while the measured drawn hand is open, incomplete or absent', () => {
    const state = { ...seed(), phase: 'grasp', stable: 5, elapsed: 1 };
    for (const hand of [undefined, { enabled: true, weights: { grip: .4 } }, { enabled: true }]) {
      const result = run(state, { hand }); expect(result.state.owner).toBe('ground'); expect(result.state.commits.pickup).toBe(0);
    }
    const result = run(state, { hand: { enabled: true, weights: { grip: 1 } } });
    expect(result.state.phase).toBe('lift'); expect(result.state.commits.pickup).toBe(1);
  });
  it('keeps ownership through ground contact and only releases after the drawn fingers open', () => {
    const state = { ...seed(), phase: 'touch', owner: 'hand', stable: 5, elapsed: 1 };
    const touched = run(state, { hand: { enabled: true, weights: { grip: 1 } } });
    expect(touched.state.phase).toBe('release'); expect(touched.state.owner).toBe('hand'); expect(touched.state.commits.drop).toBe(0);
    const waiting = { ...touched.state, elapsed: 1 };
    expect(run(waiting, { hand: { enabled: true, weights: { release: .4 } } }).state.owner).toBe('hand');
    expect(run(waiting, { hand: { enabled: true, weights: { release: 1 } }, contact: { groundDistance: 12, settled: true } }).state.owner).toBe('hand');
    let opening = { ...waiting, stable: 0 };
    for (let frame = 0; frame < 3; frame++) { opening = run(opening, { hand: { enabled: true, weights: { release: 1 } } }).state; expect(opening.owner).toBe('hand'); }
    const dropped = run(opening, { hand: { enabled: true, weights: { release: 1 } } });
    expect(dropped.state.owner).toBe('ground'); expect(dropped.state.phase).toBe('retract'); expect(dropped.state.commits.drop).toBe(1);
    expect(run(dropped.state).state.commits.drop).toBe(1);
  });
  it('keeps baseline comparison explicit and old motion profiles independent of the new art', () => {
    const old = load('../web/props/shell/motion-profile.json'); expect(handWeights({ ...seed(), phase: 'carry' }, old).original).toBe(1);
    const state = { ...seed(), phase: 'grasp', stable: 5, elapsed: 1 };
    expect(run(state, { hand: { enabled: false } }).state.owner).toBe('ground');
    expect(run(state, { hand: { enabled: false, baseline: true } }).state.owner).toBe('hand');
  });
});
