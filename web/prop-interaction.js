// One object, one body owner. Physics and contact observations are supplied by the body.
// No elapsed timer can substitute for arrival or contact.
export const initialPropInteraction = (generation = 1) => ({ generation, serial: 0, phase: 'idle', suspended: null,
  owner: 'ground', walkId: null, destination: null, stable: 0, startedAt: null, lastAt: null, commits: { pickup: 0, drop: 0 }, error: null });
export function stepPropInteraction(state, input) {
  const next = { ...state, commits: { ...state.commits }, lastAt: input.now };
  const effects = [];
  const out = () => ({ state: next, effects });
  const stop = () => { if (next.walkId) effects.push({ type: 'stop', id: next.walkId }); next.walkId = null; };
  const pause = () => { if (next.phase !== 'paused') { next.suspended = next.phase; next.phase = 'paused'; next.stable = 0; stop(); } };
  const walk = (target, phase) => {
    if (!Number.isFinite(target) || target < input.minX || target > input.maxX || !input.canWalk) {
      next.error = 'unreachable'; return false;
    }
    if (next.serial >= 999999 || !Number.isSafeInteger(next.generation*1_000_000+next.serial+1)) { next.error='identity-limit'; return false; }
    stop(); next.serial++; next.walkId = next.generation * 1_000_000 + next.serial;
    next.phase = phase; next.destination = target; next.stable = 0; next.error = null;
    next.startedAt = input.now;
    effects.push({ type: 'walk', x: target, id: next.walkId }); return true;
  };
  const command = input.command;
  if (command?.type === 'reset') { stop(); return { state: initialPropInteraction(state.generation + 1), effects: [...effects, { type: 'reset' }] }; }
  if (command?.type === 'relocate' && next.owner === 'ground') {
    if (!Number.isFinite(command.x)) return out();
    stop(); next.phase = 'idle'; next.suspended = null; next.stable = 0; next.destination = null; effects.push({ type: 'relocate', x: command.x }); return out();
  }
  if (input.blocked || command?.type === 'pause' || state.lastAt !== null && (input.now < state.lastAt || input.now-state.lastAt > 1000)) { pause(); return out(); }
  if (command?.type === 'resume' && next.phase === 'paused') {
    next.error=null;
    const phase = next.suspended; next.suspended = null;
    if (phase === 'approach' || phase === 'carry') walk(next.destination,phase);
    else { next.phase = phase; next.stable = 0; next.startedAt=input.now; effects.push({ type:'stance', value: phase === 'reach' || phase === 'lower' ? 'sit' : 'stand' }); }
    return out();
  }
  if (next.phase === 'paused') return out();
  if (command?.type === 'pickup' && next.owner === 'ground' && next.phase === 'idle') { walk(input.pickupTarget, 'approach'); return out(); }
  if (command?.type === 'drop' && next.owner === 'hand' && next.phase === 'held') { walk(input.dropTarget, 'carry'); return out(); }
  if (next.walkId) {
    if (input.now-next.startedAt>30000) { next.error='arrival-timeout'; pause(); return out(); }
    const event = input.event;
    if (event?.walkId !== next.walkId) return out();
    const arrived = event.kind === 'arrived' && Math.abs(input.bodyX-next.destination) <= 2;
    next.walkId = null;
    if (!arrived) { next.error = 'interrupted'; pause(); return out(); }
    next.phase = next.phase === 'approach' ? 'reach' : 'lower'; next.stable = 0; next.startedAt=input.now;
    effects.push({ type:'face', value:1 }, { type:'stance', value:'sit' }); return out();
  }
  if (next.phase === 'reach' || next.phase === 'lower') {
    if(input.now-next.startedAt>6000){next.error='contact-timeout';pause();return out();}
    const valid = input.contact?.settled && !input.moving &&
      (next.phase === 'reach' ? input.contact.distance <= 2 : input.contact.groundDistance <= 2);
    next.stable = valid ? next.stable + 1 : 0;
    if (next.stable >= 4) {
      if (next.phase === 'reach') { next.owner = 'hand'; next.phase = 'lift'; next.commits.pickup++; effects.push({ type:'pickup' },{ type:'stance', value:'stand' }); }
      else { next.owner = 'ground'; next.phase = 'release'; next.commits.drop++; effects.push({ type:'drop' },{ type:'stance', value:'stand' }); }
      next.stable = 0;
    }
  } else if (next.phase === 'lift' && input.contact?.settled && !input.moving) next.phase = 'held';
  else if (next.phase === 'release' && input.contact?.settled && !input.moving) next.phase = 'idle';
  return out();
}
