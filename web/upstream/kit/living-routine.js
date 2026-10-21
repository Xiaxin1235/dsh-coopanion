// One finite life intention above the established body coordinator. No clocks,
// persistence, work completion inference, score writes or invitation budget.
export const initialLivingRoutine = () => ({ configured: false, permissions: null, work: null, memory: null, personality: null, elapsed: 0, arranged: false, rested: false, lastAt: null });
export function stepLivingRoutine(previous, input) {
  const state = { ...previous, lastAt: input.now }, commands = [], c = input.context;
  const result = () => ({ state, commands });
  if (!c || !Number.isFinite(input.now)) return result();
  const occupied = c.occupied || c.lifecycle || !c.enabled;
  const permissions = { mode: c.enabled ? c.mode : 'off', roam: c.enabled, input: c.keyboard, occupied };
  const key = JSON.stringify(permissions);
  if (!state.configured) { state.configured = true; commands.push({ type: 'personality-start' }); }
  if (state.permissions !== key || state.personality !== c.personality) {
    state.permissions = key; state.personality = c.personality;
    commands.push({ type: 'personality', id: c.personality ?? 'quiet', version: 1, permissions });
  }
  const work = JSON.stringify(c.facts ?? []);
  if (state.work !== work) { state.work = work; commands.push({ type: 'facts', facts: c.facts ?? [], replace: true }); }
  const memory = JSON.stringify(c.memory ?? null);
  if (state.memory !== memory) { state.memory = memory; commands.push({ type: 'personality' }); }
  if (!!input.coordination.social !== !!c.social) commands.push({ type: 'social', occupied: !!c.social });
  if (input.coordination.reason === 'life-complete' || input.coordination.reason === 'target-already-reached') state.arranged = true;
  const demand = input.coordination.sessions.some(f => f.running || f.requests.length || f.needsAttention || f.driver === 'unknown');
  if (occupied || c.keyboard !== 'idle' || c.social || demand || c.reduced) return result();
  state.elapsed += Math.max(0, Math.min(.05, input.dt ?? 0));
  if(input.coordination.phase==='paused' && state.elapsed>=.8 && /^(personality:|lifecycle|world-changed|drag|user-occupied|source-unavailable|explicit-reset)/.test(input.coordination.reason??'')) commands.push({type:'resume'});
  const available = input.action.owner === 'ground' && input.action.phase === 'idle' && !input.moving && !input.coordination.life;
  const personal = input.coordination.phase.startsWith('personal-');
  const observed = input.coordination.personality?.decision?.result === 'observed';
  // A confirmed recent stroke gives the quiet observation a little more time;
  // a completed shared activity makes the pending household task the next choice.
  const readyAfter = c.memory?.kind === 'pet' ? 10 : c.memory?.kind === 'play' ? 4 : 6;
  if (!state.arranged && state.elapsed >= readyAfter && available && personal && observed) commands.push({ type: 'start' });
  if (state.arranged && !state.rested && state.elapsed >= 65 && available && personal && observed) { state.rested = true; commands.push({ type: 'rest' }); }
  return result();
}
