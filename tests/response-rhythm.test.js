import { describe, it, expect } from 'vitest';
import { ResponseRhythm, RESPONSE_RHYTHM } from '../web/response-rhythm.js';

const context = { characterId: 'whale', epoch: 1, generation: 'g1' };
const entry = id => ({ id, kind: 'pet' });
function fixture() {
  const rhythm = new ResponseRhythm();
  const input = { ...context, mode: 'quiet', now: 0, permitted: true, entries: [] };
  const add = (id, now = input.now) => rhythm.observe({ ...context, id, now, reacted: true });
  const save = (id, saved = true, now = input.now) => {
    if (saved) input.entries.push(entry(id));
    rhythm.receipt({ ...context, id, now, saved });
  };
  const step = patch => rhythm.step(Object.assign(input, patch));
  return { rhythm, input, add, save, step };
}
describe('bounded stroke response rhythm', () => {
  it('merges distinct real sources, remembers executed reflexes and emits only once after a pause', () => {
    const f = fixture(); f.add('a'); f.save('a'); f.add('b', 2500); f.save('b', true, 2500);
    expect(f.rhythm.pending.sources).toHaveLength(2);
    expect(f.rhythm.pending.sources.every(s => s.reacted)).toBe(true);
    expect(f.step({ now: 6000 })).toBe(null);
    expect(f.step({ now: 6500 })).toEqual({ saved: true, count: 2 });
    expect(f.step({ now: 7000 })).toBe(null);
    expect(f.add('a', 7100)).toBe(false);
  });
  it('bounds both source storage and duplicate history without extending the first expiry', () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) f.add(String(i), i);
    expect(f.rhythm.pending.sources).toHaveLength(RESPONSE_RHYTHM.sources);
    expect(f.rhythm.seen.length).toBeLessThanOrEqual(RESPONSE_RHYTHM.history);
    expect(f.rhythm.pending.expiresAt).toBe(RESPONSE_RHYTHM.ttlMs);
    expect(f.step({ now: RESPONSE_RHYTHM.ttlMs, permitted: false })).toBe(null);
    expect(f.rhythm.pending).toBe(null);
  });
  it('waits under occupation, rechecks current permission, and never bursts on recovery', () => {
    const f = fixture(); f.add('a'); f.save('a');
    expect(f.step({ now: 5000, permitted: false })).toBe(null);
    expect(f.step({ now: 6000, permitted: true })).toEqual({ saved: true, count: 1 });
    f.add('b', 7000); f.save('b', true, 7000);
    f.step({ now: 12000, permitted: false });
    expect(f.step({ now: 27000, permitted: true })).toBe(null);
    expect(f.rhythm.pending).toBe(null);
  });
  it('caps the merge window even with continuous strokes and does not duplicate writes or reflexes', () => {
    const f = fixture();
    for (let i = 0; i <= 4; i++) { f.add(String(i), i * 2500); f.save(String(i), true, i * 2500); }
    expect(f.step({ now: 10000 })).toEqual({ saved: true, count: 5 });
    expect(f.step({ now: 10001 })).toBe(null);
  });
  it('does not absorb a later fragment while an older response waits for permission', () => {
    const f = fixture(); f.add('a'); f.save('a'); f.step({ now: 10000, permitted: false });
    expect(f.add('b', 11000)).toBe(false);
    expect(f.rhythm.pending.sources.map(s => s.id)).toEqual(['a']);
    expect(f.step({ now: 12000, permitted: true })).toEqual({ saved: true, count: 1 });
  });
  it('waits for receipts and cannot turn failures or absent entries into a memory claim', () => {
    const f = fixture(); f.add('a');
    expect(f.step({ now: 5000 })).toBe(null);
    f.save('a', false, 5100);
    expect(f.step({ now: 5200 })).toEqual({ saved: false, count: 1 });
    f.add('b', 6000); f.save('b', true, 6000);
    expect(f.step({ now: 10000, entries: [] })).toBe(null);
    expect(f.rhythm.pending).toBe(null);
  });
  for (const patch of [{ mode: 'off' }, { cancel: true }, { epoch: 2 }, { characterId: 'star' }, { generation: 'g2' }]) {
    it(`revokes pending work for ${JSON.stringify(patch)} and ignores late receipts`, () => {
      const f = fixture(); f.add('a'); f.step({ now: 1000, ...patch }); f.save('a', true, 2000);
      expect(f.rhythm.pending).toBe(null);
      expect(f.step({ now: 5000, ...context, mode: 'quiet', cancel: false })).toBe(null);
    });
  }
  it('drops corrected/deleted saved sources and cannot restore them from a delayed receipt', () => {
    const f = fixture(); f.add('a'); f.save('a');
    expect(f.step({ now: 5000, entries: [{ ...entry('a'), correctedKind: 'play' }] })).toBe(null);
    f.save('a', true, 6000); expect(f.rhythm.pending).toBe(null);
  });
  for (const now of [-1, NaN, Infinity]) it(`drops on invalid or regressed clock ${now}`, () => {
    const f = fixture(); f.add('a'); f.save('a'); f.step({ now: 2000 });
    expect(f.step({ now })).toBe(null); expect(f.rhythm.pending).toBe(null);
  });
  it('does not admit unreacted, unidentified or old events, and receipts never enqueue', () => {
    const f = fixture();
    expect(f.rhythm.observe({ ...context, id: 'x', now: 0, reacted: false })).toBe(false);
    expect(f.rhythm.observe({ ...context, generation: undefined, id: 'x', now: 0, reacted: true })).toBe(false);
    f.save('unknown'); expect(f.rhythm.pending).toBe(null);
    f.add('a', 100); expect(f.add('b', 0)).toBe(false); expect(f.rhythm.pending).toBe(null);
  });
});
