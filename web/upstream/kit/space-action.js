// Opt-in courtyard action executor. Navigation receipts and rig contact are facts;
// clocks only blend poses and bound failures. No scene timer can commit ownership.
import { initialMotion, sampleMotion, blendPose, stepMotion } from '../../prop-motion.js';
export const pickupMirror = (quad, facing) => (quad[1].x < quad[0].x ? -1 : 1) * (facing === -1 ? -1 : 1);
const traveling = phase => ['approach', 'carry'].includes(phase);
const activePhase = state => state.phase === 'paused' ? state.suspended : state.phase;
export const initialSpaceAction = (profile, generation = 1) => ({ ...initialMotion(profile, generation),
  navigation: null, revision: null, objectRevision: null, afterPrepare: null });
export function sampleSpaceAction(state, profile) {
  const phase = activePhase(state);
  if (phase === 'prepare') return blendPose(state.from, profile.poses[state.owner === 'hand' ? 'carry' : 'stand'], state.elapsed / .8);
  return sampleMotion(state, profile);
}
export function stepSpaceAction(state, input, profile) {
  let next = { ...state, commits: { ...state.commits }, lastAt: input.now }, effects = [];
  const out = () => ({ state: next, effects });
  const stop = () => { if (next.navigation) effects.push({ type: 'cancel-navigation', ...next.navigation }); next.navigation = null; next.walkId = null; };
  const pause = reason => {
    if (next.phase !== 'paused') { next.suspended = next.phase; next.phase = 'paused'; next.stable = 0; stop(); }
    if (reason) next.error = reason;
  };
  const prepare = phase => {
    const route = phase === 'approach' ? input.pickupRoute : input.dropRoute;
    if (!input.canNavigate || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Number.isSafeInteger(input.objectRevision) || input.objectRevision < 0 || !route || ![route.x, route.y, route.drop].every(Number.isFinite) || route.drop < 0 || route.drop > 22) {
      pause('unreachable'); return;
    }
    const before = activePhase(next);
    next.prepareSeated = before === 'rest' || before === 'prepare' && next.prepareSeated;
    next.preparePlantFrom = before === 'prepare' ? next.preparePlantFrom : traveling(before) || before === 'rest' ? 0 : 1;
    next.from = sampleSpaceAction(next, profile); stop();
    next.phase = 'prepare'; next.afterPrepare = phase; next.suspended = null; next.elapsed = next.stable = 0;
    next.route = { ...route }; next.reachDrop = route.drop; next.revision = input.revision; next.objectRevision = input.objectRevision; next.error = null;
    effects.push({ type: 'stand' });
  };
  const cmd = input.command;
  if (cmd?.type === 'reset') { stop(); return { state: initialSpaceAction(profile, state.generation + 1), effects: [...effects, { type: 'reset' }] }; }
  if (cmd?.type === 'relocate' && next.owner === 'ground' && ['idle','rest'].includes(next.phase)) {
    if (Number.isFinite(cmd.x) && Number.isFinite(cmd.y)) effects.push({ type:'relocate', x:cmd.x, y:cmd.y });
    return out();
  }
  if (cmd?.type === 'sit' && next.phase === 'idle' && next.owner === 'ground') { next.phase = 'rest'; effects.push({ type: 'sit' }); return out(); }
  if (cmd?.type === 'pause' || input.blocked || state.lastAt !== null && (input.now < state.lastAt || input.now - state.lastAt > 1000)) { pause(); return out(); }
  if (!['idle','rest','paused'].includes(next.phase) && (next.revision !== input.revision || next.objectRevision !== input.objectRevision)) { pause('world-changed'); return out(); }
  if (cmd?.type === 'resume' && next.phase === 'paused') {
    next.error = null;
    if (['idle','rest'].includes(next.suspended)) { next.phase = next.suspended; next.suspended = null; return out(); }
    if (traveling(next.suspended) || next.suspended === 'prepare' || next.revision !== input.revision || next.objectRevision !== input.objectRevision) {
      // Re-evaluate the still-owned object and target from the actual pose/root.
      if (['lift','held','retract','rise'].includes(next.suspended)) { next.phase = next.suspended; next.suspended = null; next.revision = input.revision; next.objectRevision = input.objectRevision; next.stable = 0; }
      else prepare(next.owner === 'ground' ? 'approach' : 'carry');
    } else { next.phase = next.suspended; next.suspended = null; next.stable = 0; }
    return out();
  }
  if (next.phase === 'paused') return out();
  if (['pickup','loop'].includes(cmd?.type) && ['idle','rest'].includes(next.phase)) { next.loop = cmd.type === 'loop'; prepare('approach'); return out(); }
  if (cmd?.type === 'drop' && next.phase === 'held') { next.loop = false; prepare('carry'); return out(); }
  if (next.phase === 'held' && next.loop && next.elapsed >= profile.seconds.held) { prepare('carry'); return out(); }
  const dt = Number.isFinite(input.dt) ? Math.max(0, Math.min(.05, input.dt)) : 0;
  if (next.phase === 'rest') return out();
  if (next.phase === 'prepare') {
    next.elapsed += dt;
    if (next.elapsed >= .8 && !input.moving && input.standingReady) {
      if (next.serial >= 999999 || !Number.isSafeInteger(next.generation * 1e6 + next.serial + 1)) { pause('identity-limit'); return out(); }
      next.serial++; next.navigation = { id: next.generation * 1e6 + next.serial, generation: next.generation, revision: input.revision };
      next.walkId = next.navigation.id; next.from = sampleSpaceAction(next, profile);
      next.phase = next.afterPrepare; next.elapsed = next.walkingTime = 0;
      effects.push({ type: 'navigate', ...next.navigation, target: { x: next.route.x, y: next.route.y } });
    } else if (next.elapsed > 6) pause('stance-timeout');
    return out();
  }
  if (traveling(next.phase)) {
    next.walkingTime += dt;
    if (next.walkingTime > 30) { pause('arrival-timeout'); return out(); }
    const event = input.event, identity = next.navigation;
    if (!identity || !event || event.id !== identity.id || event.generation !== identity.generation || event.revision !== identity.revision) return out();
    if (event.kind !== 'navigation-arrived' || Math.hypot(input.bodyX-next.route.x, input.bodyY-next.route.y) > .5 || input.speed > .001) { pause('interrupted'); return out(); }
    next.navigation = null; next.walkId = null;
    next.from = { ...sampleSpaceAction(next, profile), ...input.angles, look: [3, 0] };
    next.phase = next.phase === 'approach' ? 'settle' : 'settleDrop'; next.elapsed = next.stable = 0;
    effects.push({ type: 'face', facing: next.route.facing }, { type: 'phase', phase: next.phase }); return out();
  }
  // The established O03 executor retains the contact/closure gates and commits.
  const loop = next.loop;
  const result = stepMotion(next.phase === 'held' ? { ...next, loop: false } : next, { ...input, command: null, event: null }, profile);
  if (next.phase === 'held') result.state.loop = loop;
  next = result.state; effects.push(...result.effects); return out();
}

// Manual routes and action routes have distinct public identities but share one
// physical navigator. Translate through a single bounded monotonic channel.
export function createSpaceNavigationChannel() {
  let serial = 0;
  const receipts = new Map();
  return {
    encode(command) {
      if (!Number.isSafeInteger(serial + 1)) throw new Error('navigation identity exhausted');
      const id = ++serial;
      receipts.set(id, { id:command.id, generation:command.generation, revision:command.model.revision });
      if (receipts.size > 64) receipts.delete(receipts.keys().next().value);
      return { ...command, id, generation:1 };
    },
    decode(value) {
      if (value?.id == null) return value;
      const logical = receipts.get(value.id);
      return value.generation === 1 && logical?.revision === value.revision ? { ...value, ...logical } : null;
    },
  };
}
