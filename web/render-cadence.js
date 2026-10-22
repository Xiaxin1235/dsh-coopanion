/** A paint cap, not a synthetic clock: busy frames bypass the cap and retain accumulated dt. */
export function advanceRenderCadence(state, now, dt, idle) {
  const elapsed = Math.min(.05, state.elapsed + Math.max(0, dt));
  const paint = !idle || now - state.at >= 1000 / 30;
  return { at: paint ? now : state.at, elapsed: paint ? 0 : elapsed, paint, dt: paint ? elapsed : 0 };
}

/** Authored contact and attention alignment can move while the root stands still. */
export function bodyAnimating(layout) {
  const life=layout?.living;
  return !!layout?.moving || !!life && (life.animating ||
    !['idle','rest','paused'].includes(life.action) ||
    ['personal-prepare','personal-align','personal-travel','work-prepare','work-travel'].includes(life.phase)
  );
}
