import { describe, it, expect } from 'vitest';
import { initialCompanionship, stepCompanionship, companionWeights } from '../web/companionship.js';
const words = ['neutral', 'stand', 'look', 'nod', 'sit', 'sleepy', 'happy', 'dance', 'wave', 'love'];
function fixture(patch = {}, random = () => .1) {
  let state = initialCompanionship(); let input = { mode: 'interactive', now: 0, hour: 12, words, automatic: true, eligible: true, ...patch };
  const events = [];
  const tick = (change = {}) => { input = { ...input, ...change }; const old = structuredClone(state); const result = stepCompanionship(state, input, random); expect(state).toEqual(old); state = result.state; if (result.word || result.reserveInvitation || result.completed || result.hideInvitation) events.push(result); input.action = undefined; return result; };
  const to = target => { let r; while (input.now < target) r = tick({ now: Math.min(target, input.now + 1000) }); return r; };
  return { tick, to, events, get state() { return state; } };
}
describe('local companionship decisions', () => {
  it('keeps the old path completely off', () => { const f = fixture({ mode: 'off' }, () => { throw new Error('unused'); }); f.tick(); f.to(60000); expect(f.events).toEqual([]); });
  it('covers three coherent routines in a seeded day, without adjacent repeats', () => {
    let seed = 17; const f = fixture({}, () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }); f.tick(); f.to(600000);
    const starts = f.events.filter(e => e.word && e.state.active?.index === 0).map(e => e.state.active.kind);
    expect(new Set(starts)).toEqual(new Set(['observe', 'play', 'rest']));
    for (let i = 1; i < starts.length; i++) expect(starts[i]).not.toBe(starts[i - 1]);
    expect(f.state.energy).toBeGreaterThanOrEqual(0); expect(f.state.interest).toBeLessThanOrEqual(1);
  });
  it('uses motivation and only supported complete recipes', () => {
    expect(companionWeights(.1, .5).rest).toBeGreaterThan(companionWeights(.9, .5).rest);
    expect(companionWeights(.9, .1).play).toBeGreaterThan(companionWeights(.9, .9).play);
    for (const supported of [[], ['look'], ['neutral', 'sit']]) { const f = fixture({ words: supported }); f.tick(); f.to(600000); expect(f.events).toEqual([]); }
    const f = fixture({ words: ['neutral', 'nod'] }); f.tick(); f.to(60000); expect(f.events[0].word).toBe('nod');
  });
  it('night excludes play and invitation and does not catch up across gaps', () => {
    const f = fixture({ hour: 23 }); f.tick(); f.to(2400000); expect(f.events.some(e => e.reserveInvitation || e.state.active?.kind === 'play')).toBe(false);
    const g = fixture(); g.tick(); g.tick({ now: 3600000 }); expect(g.events).toEqual([]); expect(g.state.inviteAt).toBe(5400000);
  });
  it('reserves before showing, expires once and applies familiar greeting', () => {
    const f = fixture({ words: ['neutral', 'wave', 'love', 'happy', 'nod'], unlocked: true }, () => .999); f.tick(); f.to(1800000);
    expect(f.events.at(-1).reserveInvitation).toBe(true); expect(f.state.invitation).toBe('pending');
    expect(f.tick({ action: 'reserved' }).showInvitation).toBe(true); f.to(1802100); expect(f.events.some(e => e.word === 'love')).toBe(true);
    f.to(1810000); expect(f.state.invitation).toBe(null); expect(f.events.at(-1).hideInvitation).toBe(true);
  });
  it('manual activity completes only once and interruptions never count', () => {
    const f = fixture(); f.tick(); expect(f.tick({ action: 'play' }).word).toBe('happy'); f.to(6000);
    expect(f.events.filter(e => e.completed)).toHaveLength(1); f.to(20000); expect(f.events.filter(e => e.completed)).toHaveLength(1);
    f.tick({ action: 'play' }); expect(f.tick({ occupied: true }).release).toBe(true); f.to(40000); expect(f.events.filter(e => e.completed)).toHaveLength(1);
  });
  it('occupied, roam off, mode switch, time rollback and late reserve cannot revive a cancelled invite', () => {
    const f = fixture({ words: ['neutral', 'wave', 'happy', 'nod'] }, () => .999); f.tick(); f.to(1800000); f.tick({ occupied: true }); f.tick({ action: 'reserved' }); expect(f.state.invitation).toBe(null);
    f.tick({ occupied: false }); expect(f.state.inviteAt).toBe(3600000); f.tick({ automatic: false }); expect(f.state.active).toBe(null);
    f.tick({ now: 10 }); expect(f.state.inviteAt).toBe(1800010); f.tick({ mode: 'off' }); expect(f.state.mode).toBe('off');
  });
});

it('a slow or stuck real body cannot turn the activity timer into false growth', () => {
  const f = fixture(); f.tick(); f.tick({ action: 'play' });
  f.tick({ motionBusy: true }); f.to(19000); expect(f.events.some(e => e.completed)).toBe(false);
  f.to(20000); expect(f.state.active).toBe(null); expect(f.events.some(e => e.completed)).toBe(false);
});

it('cannot invite a character that has no complete shared activity', () => {
  const f = fixture({ words: ['neutral', 'stand', 'wave', 'love'] }); f.tick(); f.to(1800000);
  expect(f.events.some(e => e.reserveInvitation)).toBe(false);
});
