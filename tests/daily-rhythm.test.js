import { describe, it, expect } from 'vitest';
import { DEFAULT_DAILY_RHYTHM, initialRhythm, rhythmPeriod, stepRhythm } from '../web/daily-rhythm.js';

const words = ['neutral', 'stand', 'look', 'nod', 'wave', 'sit'];
function fixture(overrides = {}, random = () => 0) {
  let state = initialRhythm(), input = { enabled: true, now: 0, hour: 12, occupied: {}, words, ...overrides };
  const events = [];
  const tick = patch => { input = { ...input, ...patch }; const previous = structuredClone(state); const result = stepRhythm(state, input, random); expect(state).toEqual(previous); state = result.state; if (result.word || result.release) events.push(result); return result; };
  const to = target => { let result; while (input.now < target) result = tick({ now: Math.min(target, input.now + 1000) }); return result; };
  return { tick, to, events, get state() { return state; } };
}

describe('optional local daily rhythm', () => {
  it('defaults off and never consumes randomness or emits a word on the legacy path', () => {
    expect(DEFAULT_DAILY_RHYTHM).toBe(false);
    const f = fixture({ enabled: false }, () => { throw new Error('disabled policy consumed entropy'); });
    f.tick(); f.to(300000); expect(f.events).toEqual([]); expect(f.state.enabled).toBe(false);
  });
  it('classifies exact local boundaries, midnight and invalid hours', () => {
    for (const hour of [0, 6, 22, 23]) expect(rhythmPeriod(hour)).toBe('night');
    for (const hour of [7, 12, 21]) expect(rhythmPeriod(hour)).toBe('day');
    for (const hour of [-1, 24, NaN, undefined]) expect(rhythmPeriod(hour)).toBeNull();
  });
  it('waits a full sampled interval, restores and deduplicates actions', () => {
    const f = fixture(); f.tick(); expect(f.state.dueAt).toBe(45000);
    f.to(44999); expect(f.events).toEqual([]);
    expect(f.to(45000).word).toBe('look');
    expect(f.to(49000).release).toBe('look'); expect(f.state.dueAt).toBe(94000);
    expect(f.to(94000).word).toBe('nod'); expect(f.to(95000).release).toBe('nod');
  });
  it('uses independent injectable selection and interval entropy with safe invalid values', () => {
    const values = [.5, .999, 0]; const f = fixture({}, () => values.shift() ?? 0);
    f.tick(); expect(f.state.dueAt).toBe(67500);
    expect(f.to(67500).word).toBe('sit');
    expect(f.to(75500).release).toBe('sit'); expect(f.state.dueAt).toBe(120500);
    for (const value of [NaN, Infinity, -1, 2]) { const g = fixture({}, () => value); g.tick(); expect(g.state.dueAt).toBeGreaterThanOrEqual(45000); expect(g.state.dueAt).toBeLessThanOrEqual(90000); }
  });
  it('night uses longer intervals and only quiet words', () => {
    const f = fixture({ hour: 23 }, () => .999); f.tick(); expect(f.state.dueAt).toBeGreaterThan(239000);
    f.to(f.state.dueAt); expect(f.events.at(-1).word).toBe('sit');
    const end = f.state.active.endsAt; expect(end - f.state.lastAt).toBe(15000);
    expect(f.to(end).release).toBe('sit');
  });
  it.each(['task', 'pending', 'reading', 'input', 'sending', 'dragging', 'bodyBusy', 'hovered', 'resting', 'reduced', 'hidden', 'suspended'])('yields to %s and restarts a complete interval after release', flag => {
    const f = fixture(); f.tick(); f.to(45000);
    expect(f.tick({ occupied: { [flag]: true } }).release).toBe('look');
    f.to(200000); expect(f.events.filter(e => e.word)).toHaveLength(1);
    f.tick({ occupied: {} }); expect(f.state.dueAt).toBe(245000);
    f.to(244999); expect(f.events.filter(e => e.word)).toHaveLength(1);
    expect(f.to(245000).word).toBe('nod');
  });
  it('resets at day/night and time zone changes and remains quiet across midnight', () => {
    const f = fixture(); f.tick(); f.to(45000);
    expect(f.tick({ hour: 22 }).release).toBe('look'); expect(f.state.dueAt).toBe(165000);
    f.to(80000); f.tick({ hour: 0 }); expect(f.state.dueAt).toBe(165000);
    f.tick({ hour: 7 }); expect(f.state.dueAt).toBe(125000);
    f.tick({ hour: 23 }); expect(f.state.dueAt).toBe(200000);
    f.tick({ hour: NaN }); expect(f.state.enabled).toBe(false);
  });
  it('does not catch up after suspension, a clock rollback or a long scheduling gap', () => {
    const f = fixture(); f.tick(); f.to(30000);
    f.tick({ now: 300000 }); expect(f.state.dueAt).toBe(345000); expect(f.events).toEqual([]);
    f.tick({ now: 10 }); expect(f.state.dueAt).toBe(45010);
    f.to(45010); expect(f.events.at(-1).word).toBe('look');
    expect(f.tick({ now: 60000 }).release).toBe('look'); expect(f.state.dueAt).toBe(105000);
  });
  it('intersects vocabulary, requires a restore path and keeps idle when no alternative exists', () => {
    for (const missing of [[], ['look'], ['neutral', 'sit'], ['stand', 'sit']]) {
      const f = fixture({ words: missing }); f.tick(); f.to(250000); expect(f.events).toEqual([]);
    }
    const f = fixture({ words: ['neutral', 'nod'] }); f.tick(); f.to(45000); expect(f.events.at(-1).word).toBe('nod');
    f.to(250000); expect(f.events.filter(e => e.word)).toHaveLength(1);
  });
  it('disabling releases the owned action once and does not schedule further work', () => {
    const f = fixture(); f.tick(); f.to(45000);
    expect(f.tick({ enabled: false }).release).toBe('look');
    f.to(150000); expect(f.events.filter(e => e.release)).toHaveLength(1);
  });
  it('replays an identical trace without mutating caller state or occupancy', () => {
    const run = () => { const f = fixture(); f.tick(); f.to(49000); f.tick({ occupied: Object.freeze({ task: true }) }); f.to(100000); f.tick({ occupied: {} }); f.to(200000); return f.events; };
    expect(run()).toEqual(run());
  });
});
