import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPet, FACES, HIPS } from '../web/upstream/kit/body.js';
import { createWhaleFigure } from '../web/upstream/whale/figure.js';

// Observe the final rig parameters, not an extracted copy of the arm algorithm.
// Real WebGL, texture pixels and prop contact are covered by the browser matrix.
const rendered = vi.hoisted(() => ({ arms: null }));
vi.mock('../web/upstream/kit/rig.js', () => ({
  createRig: () => ({
    upload() {}, dispose() {},
    point(_parent, _state, x, y) { return [x, y]; },
    render(state) { rendered.arms = [state.armNear.a, state.armFar.a]; },
  }),
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function body(roam = 'off', options = {}) {
  let frame;
  const element = () => ({ setAttribute() {}, innerHTML: '' });
  const pet = createPet({ petG: element(), shadowEl: element(), fxG: element() }, {
    figure: { draw(_group, face, pose) { frame = { face, pose }; } },
    sfx: { play() {} }, roam, ...options,
    bounds: () => ({ W: 1200, H: 800, floorY: 740, S: 180 / 256 }),
  });
  return { pet, get frame() { return frame; }, run(seconds) {
    for (let i = 0; i < Math.round(seconds * 60); i++) { pet.step(1 / 60); pet.render(); }
  } };
}

describe('upstream awake sitting', () => {
  it('keeps an explicitly held sit awake and releases it with stand', () => {
    const r = body();
    r.pet.doWord('sit'); r.run(120);
    expect(r.pet.pet.mode).toBe('sit');
    expect(r.pet.pet.drowse).toBeLessThan(.2);
    expect(r.frame.face.eyes.every(eye => eye.shape === 'lid' && eye.ry > 10)).toBe(true);
    r.pet.doWord('stand'); r.run(3);
    expect(r.pet.pet.mode).toBe('idle');
  });

  it.each([false, true])('decides a self-chosen sit willSleep=%s before it starts', willSleep => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.9);
    const r = body('free');
    r.run(1 / 60); // initialize the glance before choosing the next activity
    r.pet.pet.nextAt = 0;
    random.mockReturnValueOnce(.7).mockReturnValueOnce(.5).mockReturnValueOnce(willSleep ? .1 : .9);
    r.run(1 / 60);
    expect(r.pet.pet.mode).toBe('sit');
    expect(r.pet.pet.willSleep).toBe(willSleep);
    const duration = r.pet.pet.dur;
    r.run(duration - 2);
    expect(r.frame.face.eyes.every(eye => eye.shape === 'lid' && eye.ry > 10)).toBe(true);
    r.run(1.8);
    if (willSleep) {
      expect(r.frame.face.eyes.every(eye => eye.shape === 'down')).toBe(true);
    } else {
      expect(r.frame.face.eyes.every(eye => eye.shape === 'lid' && eye.ry > 10)).toBe(true);
    }
    r.run(.3);
    expect(r.pet.pet.mode).toBe(willSleep ? 'sleep' : 'idle');
  });

  it('an explicit sit clears a previous sleep intention', () => {
    const r = body();
    r.pet.pet.willSleep = true;
    r.pet.doWord('sit'); r.run(5);
    expect(r.pet.pet.willSleep).toBe(false);
    expect(r.pet.pet.drowse).toBeLessThan(.2);
  });

  it('keeps yawn eyes open enough and slows a drowsy blink', () => {
    expect(Math.min(...FACES.sleepy.f(.8).eyes.map(eye => eye.ry))).toBeGreaterThanOrEqual(5);
    const r = body();
    r.pet.pet.drowse = 1; r.pet.pet.blinkAge = .23; r.pet.render();
    expect(r.frame.pose.blink).toBeGreaterThan(.9);
    r.pet.pet.drowse = 0; r.pet.render();
    expect(r.frame.pose.blink).toBe(0);
  });
});

const model = JSON.parse(readFileSync(new URL('../web/upstream/whale/model.json', import.meta.url)));
const framePng = 'data:image/png;base64,' + readFileSync(new URL('../web/upstream/whale/feat/eyeL_iris.png', import.meta.url)).toString('base64');
const noop = () => {};
function drawingElement() {
  const gradient = () => ({ addColorStop() {} });
  const context = new Proxy({ createRadialGradient: gradient, createLinearGradient: gradient }, {
    get: (target, key) => target[key] ?? noop,
  });
  const attributes = new Map(), children = [];
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  return {
    style: {}, append: (...nodes) => children.push(...nodes), appendChild: node => children.push(node),
    contains: node => children.includes(node),
    setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key),
    getContext: () => context, getCTM: () => matrix, getScreenCTM: () => matrix, toDataURL: () => framePng,
  };
}
async function whale(options = {}) {
  vi.stubGlobal('document', { createElement: drawingElement, createElementNS: drawingElement });
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  const figure = await createWhaleFigure(new URL('../web/upstream/whale/', import.meta.url), {
    model, loadImage: async () => ({}), ...options,
  });
  const group = drawingElement();
  return { figure, draw(i, { mode = 'walk', face = 'neutral', angle, gesture } = {}) {
    // A known hip-to-ankle rotation in each direction, independent of the renderer's conversion.
    angle ??= 22 * Math.sin(2 * Math.PI * 2.1 * i / 60);
    const legs = HIPS.map(([x, y], side) => {
      const a = (side ? -angle : angle) * Math.PI / 180;
      return [x, y, x - 36 * Math.sin(a), y + 36 * Math.cos(a)];
    });
    figure.draw(group, FACES[face].f(i / 60), {
      t: i / 60, mode, face, legs, look: [0, 0], facing: 1,
      sit: 0, low: 0, swing: 0, tilt: 0, lean: 0, blink: 0, eyeClose: 0, gesture,
    });
    return [...rendered.arms];
  } };
}
const correlation = (pairs) => {
  const mean = axis => pairs.reduce((sum, pair) => sum + pair[axis], 0) / pairs.length;
  const x = mean(0), y = mean(1);
  const sum = fn => pairs.reduce((total, pair) => total + fn(pair[0] - x, pair[1] - y), 0);
  return sum((a, b) => a * b) / Math.sqrt(sum(a => a * a) * sum((_a, b) => b * b));
};

describe('upstream whale arm phase with local pose ownership', () => {
  it('reports actual standing geometry after releasing authored poses for work travel', async () => {
    const r=await whale({gripProp:{url:'shell.png',box:[150,180,20,20],hand:[166,199],grip:[.5,.05],ground:[.5,1]}});
    r.draw(0,{mode:'idle'});
    expect(r.figure.gripFrame.sit).toBe(0);
    expect(r.figure.gripFrame.facing).toBe(1);
    expect(r.figure.gripFrame.feet).toHaveLength(2);
  });
  it('bounds raster image URL ownership across draws, disposal and remount', async () => {
    const live = new Set(); let sequence = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { const url = 'blob:frame-' + sequence++; live.add(url); return url; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => live.delete(url));
    const r = await whale({ raster: true });
    for (let i = 0; i < 10; i++) { r.draw(i); expect(live.size).toBe(1); }
    r.figure.dispose(); expect(live.size).toBe(0);
    r.draw(11); expect(live.size).toBe(1);
    r.figure.dispose(); expect(live.size).toBe(0);
  });

  it.each(['walk', 'navigate'])('swings both arms against their same-side legs in %s', async mode => {
    const r = await whale(), samples = [[], []];
    for (let i = 0; i < 480; i++) {
      const angle = 22 * Math.sin(2 * Math.PI * 2.1 * i / 60), arms = r.draw(i, { angle, mode });
      if (i >= 180) arms.forEach((arm, side) => samples[side].push([side ? -angle : angle, arm]));
    }
    for (const pairs of samples) expect(correlation(pairs)).toBeLessThan(-.99);
  });

  it.each([
    { face: 'determined' }, { face: 'angry' }, { mode: 'run' },
    { gesture: { kind: 'wave', k: .4 } }, { gesture: { kind: 'shiver', k: .4 } },
  ])('does not add walking swing through a fixed pose %j', async pose => {
    const movingLegs = await whale(), stillLegs = await whale();
    for (let i = 0; i < 360; i++) {
      const a = movingLegs.draw(i, pose), b = stillLegs.draw(i, { ...pose, angle: 0 });
      if (i >= 300) for (let side = 0; side < 2; side++) expect(Math.abs(a[side] - b[side])).toBeLessThan(.01);
    }
  });

  it.each([0, 1])('keeps authored arm %i exact while the other arm can swing', async side => {
    const angle = side ? -42 : -23;
    const r = await whale({ motionPose: () => ({ [side ? 'armFar' : 'armNear']: angle }) });
    const free = [];
    for (let i = 0; i < 300; i++) {
      const arms = r.draw(i);
      expect(arms[side]).toBe(angle);
      if (i > 180) free.push(arms[1 - side]);
    }
    expect(Math.max(...free) - Math.min(...free)).toBeGreaterThan(10);
  });

  it('does not add gait to the original spring-driven prop grip', async () => {
    const r = await whale({
      gripProp: { url: 'shell', hand: [166, 199], box: [150, 180, 30, 20], grip: [.5, .5], ground: [.5, 1] },
      gripPose: () => ({ armFar: -42, visible: true }),
    });
    const far = [];
    for (let i = 0; i < 360; i++) { const arms = r.draw(i); if (i > 300) far.push(arms[1]); }
    expect(Math.max(...far) - Math.min(...far)).toBeLessThan(.01);
    expect(far.at(-1)).toBeCloseTo(-42, 2);
  });

  it('reset removes the previous walk envelope before replaying a timeline', async () => {
    const used = await whale(), fresh = await whale();
    for (let i = 0; i < 180; i++) used.draw(i);
    used.figure.reset();
    for (let i = 0; i < 30; i++) expect(used.draw(i)).toEqual(fresh.draw(i));
  });
});

it('keeps the contact heading owned while a nearby cursor is behind the body', () => {
  let owned = true;
  const r = body('off', { facingOwned: () => owned });
  r.run(.1);
  const heading = r.pet.pet.facing, gaze = r.pet.toStage(140,117);
  r.pet.pointerMove({x:gaze.x-heading*200,y:gaze.y,t:10});
  r.run(2);
  expect(r.pet.pet.facing).toBe(heading);
  owned = false; r.run(2);
  expect(r.pet.pet.facing).toBe(-heading);
});
