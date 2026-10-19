import { createWhaleFigure } from '/web/upstream/whale/figure.js';
import { initialMotion, sampleMotion, stepMotion, contactRoute } from '/web/prop-motion.js';
import { handWeights } from '/web/upstream/whale/hand-art.js';

export async function createMotionBody(base, options) {
  const { shell: originalSpec, whale: model, motion: profile, hands: handSpec } = options.model;
  const spec = { ...originalSpec, grip: { ...originalSpec.grip, ...handSpec.propGrip } };
  const bounds = () => options.host.bounds(), scale = bounds().S;
  const b = spec.visibleBounds, c = spec.canvas, hand = spec.binding.hand;
  const w = spec.displayWidth / scale, h = w * b.height / b.width;
  const box = [hand[0] - w * spec.grip.x, hand[1] - h * spec.grip.y, w, h];
  let state = initialMotion(profile), pending = null, arrival = null, previous = null, sequence = 0;
  let destination = bounds().W * .78, speed = 1, stepOnce = false, forcePause = false, handArtEnabled = true;
  let groundQuad, wallAt = performance.now(), activeTime = 0;
  const putGround = x => { const height = spec.displayWidth * b.height / b.width;
    groundQuad = [{ x: x - spec.displayWidth / 2, y: bounds().floorY - height }, { x: x + spec.displayWidth / 2, y: bounds().floorY - height }, { x: x - spec.displayWidth / 2, y: bounds().floorY }]; };
  putGround(bounds().W * .50);
  const authoredPose = () => {
    const pose = sampleMotion(state, profile), phase = state.phase === 'paused' ? state.suspended : state.phase;
    const walking = ['approach', 'carry'].includes(phase);
    const k = ['settle', 'settleDrop'].includes(phase) ? Math.min(1, state.elapsed / profile.seconds[phase]) : 1;
    return { ...pose, plant: !walking, plantWeight: k * k * (3 - 2 * k), hands: handWeights(state, profile), handArt: handArtEnabled,
      ...(walking ? { armNear: undefined, ...(state.owner === 'ground' ? { armFar: undefined, look: [3, 0] } : {}) } : {}) };
  };
  const figure = await createWhaleFigure(new URL('/web/upstream/whale/', base), {
    ...options, model, raster: true, handDetail: true, externalProp:true, asset: path => new URL(path, new URL('/web/upstream/whale/', base)),
    gripProp: { url: new URL('/web/props/shell/shell.png', base), box, hand,
      uvBox: [b.x / c.width, b.y / c.height, (b.x + b.width) / c.width, (b.y + b.height) / c.height], grip: [spec.grip.x, spec.grip.y], ground: [spec.ground.x, spec.ground.y] },
    gripPose: () => ({ visible: state.owner === 'hand' }), motionPose: authoredPose,
    handArt: { ...handSpec, assets: Object.fromEntries(Object.entries(handSpec.assets).map(([name, a]) => [name, { ...a, url: new URL('/web/props/shell/hands/' + a.image, base) }])) },
  });
  const actor = options.kit.createBody({ ...options.host, emit(kind, detail) {
    if (['arrived', 'interrupted'].includes(kind)) arrival = { kind, ...detail };
    options.host.emit(kind, detail);
  } }, { figure });
  actor.set({ roam: 'off' });
  const groundGrip = () => ({
    x: groundQuad[0].x + (groundQuad[1].x - groundQuad[0].x) * spec.grip.x + (groundQuad[2].x - groundQuad[0].x) * spec.grip.y,
    y: groundQuad[0].y + (groundQuad[1].y - groundQuad[0].y) * spec.grip.x + (groundQuad[2].y - groundQuad[0].y) * spec.grip.y,
  });
  const route = (grip, facing) => contactRoute({ profile, pivots: model.pivots, hand, grip, floor: bounds().floorY, scale, facing });
  function inputs(now, dt, command, event) {
    const layout = actor.layout(), grip = figure.gripFrame;
    const point = groundGrip(), motion = grip && previous ? Math.hypot(grip.hand.x - previous.x, grip.hand.y - previous.y) : Infinity;
    return { now, dt, command, event, bodyX: layout.x, moving: layout.moving,
      facingReady: grip ? Math.abs(grip.facing - layout.facing) < .005 : false, angles: grip?.angles,
      canWalk: true, minX: 104 * scale + 8, maxX: bounds().W - 104 * scale - 8,
      pickupRoute: route(point, point.x >= layout.x ? 1 : -1),
      dropRoute: route({ x: destination, y: bounds().floorY - spec.displayWidth * b.height / b.width * (1 - spec.grip.y) }, destination >= layout.x ? 1 : -1),
      contact: grip ? { distance: Math.hypot(grip.hand.x - point.x, grip.hand.y - point.y), groundDistance: Math.abs(grip.ground.y - bounds().floorY), settled: motion < .1 } : null,
      hand: grip?.handArt,
    };
  }
  function apply(result, input) {
    state = result.state;
    for (const e of result.effects) {
      if (e.type === 'walk') actor.walk(e.x, false, e.id);
      if (e.type === 'stop') { arrival = null; actor.stopWalk(e.id); }
      if (e.type === 'face' && actor.layout().facing !== e.facing) actor.do('turn');
      if (e.type === 'drop') groundQuad = figure.gripFrame.quad.map(p => ({ ...p }));
      if (e.type === 'relocate') putGround(Math.max(125, Math.min(bounds().W - 100, e.x)));
      if (e.type === 'reset') { actor.do('stand'); actor.place(bounds().W * .22, 1); figure.reset(); putGround(bounds().W * .50); previous = null; arrival = null; }
      if (e.type === 'inspect') {
        actor.do('stand'); actor.place(input.pickupRoute.x, 1); figure.reset();
        // Inspection poses are explicitly unscored and always use a right-facing reference.
        state.reachDrop = route(groundGrip(), 1).drop;
        actor.place(route(groundGrip(), 1).x, 1); previous = null;
      }
      options.host.emit('motion-action', { ...e, phase: state.phase, generation: state.generation, owner: state.owner,
        commits: { ...state.commits }, contact: input.contact, handArt: input.hand, activeTime });
    }
  }
  function emitFrame() {
    const grip = figure.gripFrame, layout = actor.layout(), point = groundGrip();
    const contact = grip ? { distance: Math.hypot(grip.hand.x - point.x, grip.hand.y - point.y), groundDistance: Math.abs(grip.ground.y - bounds().floorY) } : null;
    options.host.emit('motion-frame', { phase: state.phase, suspended: state.suspended, elapsed: state.elapsed,
      owner: state.owner, renderedOwner: grip?.visible ? 'hand' : 'ground', generation: state.generation, walkId: state.walkId,
      commits: { ...state.commits }, error: state.error, inspection: state.inspection, loop: state.loop,
      bodyX: layout.x, moving: layout.moving, facing: layout.facing, visualFacing: grip?.facing, destinationX: destination,
      groundQuad, groundGrip: point, hand: grip?.hand, heldGrip: grip?.propGrip, heldQuad: grip?.quad, feet: grip?.feet, pose: grip?.pose, sit: grip?.sit,
      handArt: grip?.handArt,
      detail: grip?.detail,
      contact, bindingError: grip ? Math.hypot(grip.hand.x - grip.propGrip.x, grip.hand.y - grip.propGrip.y) : null,
      activeTime, speed, sequence: ++sequence });
  }
  return {
    words: actor.words,
    step(dt) {
      const now = performance.now(), gap = now - wallAt; wallAt = now;
      if (gap > 1000 || forcePause) { pending = pending?.type === 'reset' ? pending : { type: 'pause' }; forcePause = false; }
      if (pending) { const input = inputs(now, 0, pending, null); pending = null; apply(stepMotion(state, input, profile), input); }
      const stepping = state.phase === 'paused' && stepOnce, suspended = state.suspended;
      stepOnce = false;
      if (stepping) { state = { ...state, phase: suspended, suspended: null }; }
      if (state.phase !== 'paused') {
        const amount = stepping ? 1 / 60 : Math.max(0, Math.min(.05, dt)) * speed;
        const input = inputs(now, amount, null, arrival); arrival = null;
        apply(stepMotion(state, input, profile), input);
        previous = figure.gripFrame?.hand;
        actor.step(Math.max(1e-6, amount)); activeTime += amount;
        if (stepping) { const inputPause = inputs(now, 0, { type: 'pause' }, null); apply(stepMotion(state, inputPause, profile), inputPause); }
      } else {
        // Freeze the authored clock, not the safety heartbeat. Otherwise the
        // first explicit resume after >1s is itself rejected as a stale gap.
        const input = inputs(now, 0, null, null);
        apply(stepMotion(state, input, profile), input);
      }
      // An inspect/reset command must draw at least once even if the page was paused.
      if (!figure.gripFrame) actor.step(1e-6);
      emitFrame();
    },
    set(value) {
      if (value.motionCommand) {
        const cmd = value.motionCommand;
        if (['pickup', 'drop', 'loop', 'pause', 'resume', 'reset', 'inspect', 'relocate'].includes(cmd.type)) pending = cmd;
        if (cmd.type === 'speed' && [.25, .5, 1].includes(cmd.value)) speed = cmd.value;
        if (cmd.type === 'hand-art' && ['idle', 'inspect'].includes(state.phase)) handArtEnabled = cmd.enabled !== false;
        if (cmd.type === 'step') stepOnce = true;
        if (cmd.type === 'destination' && Number.isFinite(cmd.x)) destination = Math.max(125, Math.min(bounds().W - 100, cmd.x));
      }
      if (value.bounds) { actor.resize(); forcePause = !['idle', 'inspect'].includes(state.phase); }
      actor.set(value);
    },
    layout: actor.layout, resize() { actor.resize(); forcePause = !['idle', 'inspect'].includes(state.phase); },
    do: actor.do, walk: actor.walk, stopWalk: actor.stopWalk, place: actor.place,
    pointer(type, p) { pending = { type: 'pause' }; actor.pointer(type, p); },
    dispose: actor.dispose,
  };
}
