// Authored poses and contact-gated ownership. The body supplies real walk receipts and rig measurements.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = k => k * k * (3 - 2 * k);
export function blendPose(a, b, k) {
  const t = ease(clamp(k, 0, 1)), out = {};
  for (const key of ['waist', 'drop', 'armNear', 'armFar', 'propAngle']) out[key] = a[key] + (b[key] - a[key]) * t;
  out.look = a.look.map((v, i) => v + (b.look[i] - v) * t);
  return out;
}
export const initialMotion = (profile, generation = 1) => ({ generation, serial: 0, phase: 'idle', owner: 'ground', elapsed: 0,
  walkId: null, route: null, from: profile.poses.stand, reachDrop: 0, stable: 0, suspended: null,
  lastAt: null, walkingTime: 0, loop: false, error: null, commits: { pickup: 0, drop: 0 }, inspection: null });
const targetOf = (state, profile) => {
  const key = ({ look: 'look', reach: 'contact', grasp: 'contact', lift: 'carry', held: 'carry', carry: 'carry',
    settleDrop: 'carry', lower: 'contact', touch: 'contact', release: 'contact', retract: 'retract' })[state.phase] ?? 'stand';
  const pose = profile.poses[key];
  return { ...pose, drop: ['contact', 'retract'].includes(key) ? state.reachDrop : pose.drop };
};
export function sampleMotion(state, profile) {
  if (state.inspection) return { ...profile.poses[state.inspection], drop: ['contact', 'contactHeld', 'retract'].includes(state.inspection) ? state.reachDrop : profile.poses[state.inspection].drop };
  const current = state.phase === 'paused' ? { ...state, phase: state.suspended } : state;
  const duration = profile.seconds[current.phase] ?? 0;
  return blendPose(current.from, targetOf(current, profile), duration ? current.elapsed / duration : 1);
}
export function stepMotion(state, input, profile) {
  const next = { ...state, commits: { ...state.commits }, lastAt: input.now }, effects = [];
  const out = () => ({ state: next, effects });
  const stop = () => { if (next.walkId) effects.push({ type: 'stop', id: next.walkId }); next.walkId = null; };
  const enter = phase => { next.from = sampleMotion(next, profile); next.phase = phase; next.elapsed = 0; next.stable = 0; effects.push({ type: 'phase', phase }); };
  const pause = error => { if (next.phase !== 'paused') { next.suspended = next.phase; next.phase = 'paused'; stop(); } if (error) next.error = error; };
  const startWalk = (route, phase) => {
    if (!route || !Number.isFinite(route.x) || !Number.isFinite(route.drop) || route.drop < 0 || route.drop > 22 || route.x < input.minX || route.x > input.maxX || !input.canWalk) { next.error = 'unreachable'; next.loop = false; return false; }
    if (next.serial >= 999999 || !Number.isSafeInteger(next.generation * 1e6 + next.serial + 1)) { next.error = 'identity-limit'; next.loop = false; return false; }
    stop(); next.serial++; next.walkId = next.generation * 1e6 + next.serial; next.route = { ...route }; next.reachDrop = route.drop;
    next.phase = phase; next.elapsed = next.walkingTime = next.stable = 0; next.error = null; next.inspection = null;
    effects.push({ type: 'walk', x: route.x, id: next.walkId }); return true;
  };
  const cmd = input.command;
  if (cmd?.type === 'reset') { stop(); return { state: initialMotion(profile, state.generation + 1), effects: [...effects, { type: 'reset' }] }; }
  if (cmd?.type === 'relocate' && next.owner === 'ground' && next.phase === 'idle' && Number.isFinite(cmd.x)) { effects.push({ type: 'relocate', x: cmd.x }); return out(); }
  if (cmd?.type === 'inspect' && Object.hasOwn(profile.poses, cmd.pose)) {
    stop(); next.inspection = cmd.pose; next.phase = 'inspect'; next.owner = ['carry', 'contactHeld'].includes(cmd.pose) ? 'hand' : 'ground'; next.reachDrop = input.pickupRoute.drop;
    next.loop = false; effects.push({ type: 'inspect', pose: cmd.pose }); return out();
  }
  if (cmd?.type === 'pause' || input.blocked || state.lastAt !== null && (input.now < state.lastAt || input.now - state.lastAt > 1000)) { pause(); return out(); }
  if (cmd?.type === 'resume' && next.phase === 'paused') {
    if (['approach', 'carry'].includes(next.suspended)) { const phase = next.suspended; if (startWalk(next.route, phase)) next.suspended = null; }
    else { next.phase = next.suspended; next.suspended = null; next.error = null; }
    return out();
  }
  if (next.phase === 'paused' || next.inspection) return out();
  if (['pickup', 'loop'].includes(cmd?.type) && next.phase === 'idle') { next.loop = cmd.type === 'loop'; startWalk(input.pickupRoute, 'approach'); return out(); }
  if (cmd?.type === 'drop' && next.phase === 'held') { next.loop = false; startWalk(input.dropRoute, 'carry'); return out(); }
  const dt = Number.isFinite(input.dt) ? clamp(input.dt, 0, .05) : 0;
  next.elapsed += dt;
  if (next.walkId) {
    next.walkingTime += dt;
    if (next.walkingTime > 30) { pause('arrival-timeout'); return out(); }
    if (input.event?.walkId !== next.walkId) return out();
    if (input.event.kind !== 'arrived' || Math.abs(input.bodyX - next.route.x) > 2) { pause('interrupted'); return out(); }
    next.walkId = null;
    next.from = { ...sampleMotion(next, profile), ...input.angles, look: [3, 0] };
    next.phase = next.phase === 'approach' ? 'settle' : 'settleDrop'; next.elapsed = next.stable = 0;
    effects.push({ type: 'face', facing: next.route.facing }, { type: 'phase', phase: next.phase }); return out();
  }
  const finished = next.elapsed >= (profile.seconds[next.phase] ?? Infinity);
  const contact = input.contact;
  const stationary = !input.moving && input.facingReady;
  const nearHand = stationary && contact?.settled && contact.distance <= 1.5;
  const nearFloor = stationary && contact?.settled && contact.groundDistance <= 1.5;
  const handClosed = !profile.handArt || input.hand?.baseline || input.hand?.enabled && input.hand.weights?.grip >= .98;
  const handOpened = input.hand?.baseline || input.hand?.enabled && input.hand.weights?.release >= .98;
  next.stable = (['reach', 'grasp'].includes(next.phase) ? nearHand : ['lower', 'touch', 'release'].includes(next.phase) ? nearFloor : stationary) ? next.stable + 1 : 0;
  if (['reach', 'grasp', 'lower', 'touch', ...(profile.handArt ? ['release'] : [])].includes(next.phase) && next.elapsed > 6) { pause('contact-timeout'); return out(); }
  if (!finished) return out();
  switch (next.phase) {
    case 'settle': if (next.stable >= 4) enter('look'); break;
    case 'look': enter('reach'); break;
    case 'reach': if (next.stable >= 4) enter('grasp'); break;
    case 'grasp':
      if (next.stable >= 4 && handClosed) { next.owner = 'hand'; next.commits.pickup++; effects.push({ type: 'pickup' }); enter('lift'); } break;
    case 'lift': enter('held'); break;
    case 'held': if (next.loop && next.elapsed >= profile.seconds.held) startWalk(input.dropRoute, 'carry'); break;
    case 'settleDrop': if (next.stable >= 4) enter('lower'); break;
    case 'lower': if (next.stable >= 4) enter('touch'); break;
    case 'touch':
      if (next.stable >= 4) {
        if (profile.handArt) enter('release');
        else { next.owner = 'ground'; next.commits.drop++; effects.push({ type: 'drop' }); enter('release'); }
      } break;
    case 'release':
      if (!profile.handArt) enter('retract');
      else if (next.stable >= 4 && nearFloor && handOpened) {
        next.owner = 'ground'; next.commits.drop++; effects.push({ type: 'drop' }); enter('retract');
      } break;
    case 'retract': enter('rise'); break;
    case 'rise': next.loop = false; enter('idle'); effects.push({ type: 'complete' }); break;
  }
  return out();
}

// Contact planning uses the same shoulder → waist transforms as the actual rig. It never signals contact.
export function contactRoute({ profile, pivots, hand, grip, floor, scale, facing }) {
  const rotate = (p, pivot, degrees) => {
    const a = degrees * Math.PI / 180, x = p[0] - pivot[0], y = p[1] - pivot[1];
    return [pivot[0] + x * Math.cos(a) - y * Math.sin(a), pivot[1] + x * Math.sin(a) + y * Math.cos(a)];
  };
  const p = rotate(rotate(hand, pivots.armFar, profile.poses.contact.armFar), pivots.waist, profile.poses.contact.waist);
  return { x: grip.x - facing * (p[0] - 128) * scale, drop: 256 + (grip.y - floor) / scale - p[1], facing };
}
