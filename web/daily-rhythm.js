/** Optional API 2 idle policy. Time, local hour, entropy and occupancy are caller inputs. */
export const DEFAULT_DAILY_RHYTHM = false;
const periods = {
  day: { min: 45000, max: 90000, words: ['look', 'nod', 'wave', 'sit'], sit: 8000 },
  night: { min: 120000, max: 240000, words: ['nod', 'sit'], sit: 15000 },
};
export const rhythmPeriod = hour => Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour >= 7 && hour < 22 ? 'day' : 'night' : null;
export const initialRhythm = () => ({ enabled: false, period: null, lastAt: null, dueAt: null, lastWord: null, active: null, blocked: false });
const entropy = random => { const n = random(); return Number.isFinite(n) ? Math.max(0, Math.min(1 - Number.EPSILON, n)) : .5; };
const interval = (period, random) => { const p = periods[period]; return p.min + entropy(random) * (p.max - p.min); };

/** No timers, model calls or mutation. `release` refers only to this policy's previous action. */
export function stepRhythm(state, input, random = Math.random) {
  const { now, hour, occupied = {}, words = [] } = input;
  const period = rhythmPeriod(hour);
  if (!input.enabled || !Number.isFinite(now) || !period) return { state: state.enabled ? initialRhythm() : state, release: state.active?.word ?? null };
  const next = { ...state, enabled: true, period, lastAt: now };
  let release = null;
  const interrupted = state.enabled && (state.period !== period || now < state.lastAt || now - state.lastAt > 10000);
  if (Object.values(occupied).some(Boolean)) {
    release = state.active?.word ?? null;
    return { state: { ...next, active: null, dueAt: null, blocked: true }, release };
  }
  if (!state.enabled || state.blocked || interrupted) {
    release = state.active?.word ?? null;
    return { state: { ...next, active: null, blocked: false, dueAt: now + interval(period, random) }, release };
  }
  if (state.active) {
    if (now < state.active.endsAt) return { state: next };
    return { state: { ...next, active: null, dueAt: now + interval(period, random) }, release: state.active.word };
  }
  if (now < state.dueAt) return { state: next };
  const candidates = words.includes('neutral') ? periods[period].words.filter(w => words.includes(w) && w !== state.lastWord && (w !== 'sit' || words.includes('stand'))) : [];
  if (!candidates.length) return { state: { ...next, dueAt: now + interval(period, random) } };
  const word = candidates[Math.floor(entropy(random) * candidates.length)];
  const duration = { look: 4000, nod: 1000, wave: 2000, sit: periods[period].sit }[word];
  return { state: { ...next, dueAt: null, lastWord: word, active: { word, endsAt: now + duration } }, word };
}
