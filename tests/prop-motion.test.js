import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { initialMotion, stepMotion, sampleMotion, contactRoute } from '../web/prop-motion.js';
const profile = JSON.parse(readFileSync(new URL('../web/props/shell/motion-profile.json', import.meta.url)));
const defaults = { now: 0, dt: .05, canWalk: true, minX: 70, maxX: 530, bodyX: 250, moving: false, facingReady: true,
  pickupRoute: { x: 250, facing: 1, drop: 8 }, dropRoute: { x: 450, facing: 1, drop: 8 },
  contact: { distance: 0, groundDistance: 0, settled: true } };
function rig() {
  let state = initialMotion(profile), now = 0;
  return { get state() { return state; }, step(input = {}) { now += 50; const result = stepMotion(state, { ...defaults, now, ...input }, profile); state = result.state; return result; },
    until(phase, input = {}, limit = 200) { while (state.phase !== phase && limit--) this.step(input); expect(state.phase).toBe(phase); return state; } };
}
function arrive(r, command = 'pickup') {
  r.step({ command: { type: command } });
  r.step({ event: { kind: 'arrived', walkId: r.state.walkId }, bodyX: r.state.route.x });
}
describe('authored prop motion', () => {
  it('requires the actual target and current receipt before lowering the body', () => {
    const r = rig(); r.step({ command: { type: 'pickup' } }); const id = r.state.walkId;
    r.step({ event: { kind: 'arrived', walkId: id - 1 } }); expect(r.state.phase).toBe('approach');
    r.step({ bodyX: 300, event: { kind: 'arrived', walkId: id } });
    expect(r.state.phase).toBe('paused'); expect(r.state.owner).toBe('ground');
  });
  it('does not grasp on elapsed time without stable measured contact', () => {
    const r = rig(); arrive(r); r.until('reach');
    for (let i = 0; i < 80; i++) r.step({ contact: { distance: 9, groundDistance: 0, settled: true } });
    expect(r.state.phase).toBe('reach'); expect(r.state.commits.pickup).toBe(0);
    r.until('grasp'); r.until('held'); expect(r.state.owner).toBe('hand'); expect(r.state.commits.pickup).toBe(1);
  });
  it('keeps the key pose continuous through grasp and starts lift from contact', () => {
    const r = rig(); arrive(r); r.until('grasp');
    const atContact = sampleMotion(r.state, profile); r.until('lift');
    expect(sampleMotion(r.state, profile)).toEqual(atContact);
    r.until('held'); expect(sampleMotion(r.state, profile).drop).toBe(0);
    expect(sampleMotion(r.state, profile).armFar).toBe(-42);
  });
  it('pauses the authored clock and resumes the same pose without restarting the reach', () => {
    const r = rig(); arrive(r); r.until('reach'); r.step(); r.step();
    r.step({ dt: 0, command: { type: 'pause' } });
    const saved = sampleMotion(r.state, profile), elapsed = r.state.elapsed;
    for (let i = 0; i < 20; i++) r.step();
    expect(sampleMotion(r.state, profile)).toEqual(saved); expect(r.state.elapsed).toBe(elapsed);
    r.step({ command: { type: 'resume' } }); expect(r.state.phase).toBe('reach'); expect(sampleMotion(r.state, profile)).toEqual(saved);
  });
  it('keeps hand ownership while a carrying route is interrupted and rejects its stale identity', () => {
    const r = rig(); arrive(r); r.until('held'); r.step({ command: { type: 'drop' } }); const oldId = r.state.walkId;
    r.step({ command: { type: 'pause' } }); expect(r.state.owner).toBe('hand');
    r.step({ command: { type: 'resume' } }); expect(r.state.walkId).not.toBe(oldId);
    r.step({ event: { kind: 'arrived', walkId: oldId }, bodyX: 450 }); expect(r.state.phase).toBe('carry');
  });
  it('touches the ground before releasing, retracts the hand before rising, and can repeat', () => {
    const r = rig();
    for (let round = 1; round <= 3; round++) {
      arrive(r); r.until('held'); arrive(r, 'drop'); r.until('lower');
      for (let i = 0; i < 35; i++) r.step({ contact: { distance: 0, groundDistance: 15, settled: true } });
      expect(r.state.owner).toBe('hand'); expect(r.state.commits.drop).toBe(round - 1);
      r.until('release'); expect(r.state.owner).toBe('ground'); expect(r.state.commits.drop).toBe(round);
      r.until('retract'); r.until('rise'); expect(sampleMotion(r.state, profile).waist).toBe(20);
      r.until('idle'); expect(sampleMotion(r.state, profile).waist).toBe(0);
      expect(r.state.commits).toEqual({ pickup: round, drop: round });
    }
  });
  it('stops on missing capabilities, contact timeout, clock gaps and resets into a new generation', () => {
    const r = rig(); r.step({ command: { type: 'pickup' }, canWalk: false }); expect(r.state.error).toBe('unreachable');
    arrive(r); r.until('reach');
    for (let i = 0; i < 130; i++) r.step({ contact: null });
    expect(r.state.error).toBe('contact-timeout'); expect(r.state.owner).toBe('ground');
    const old = r.state.generation; r.step({ command: { type: 'reset' } }); expect(r.state.generation).toBe(old + 1);
    r.step(); r.step({ now: 99999 }); expect(r.state.phase).toBe('paused');
  });
  it('never treats pose inspection or object relocation as an interaction commit', () => {
    const r = rig(); r.step({ command: { type: 'inspect', pose: 'contactHeld' } });
    expect(r.state.inspection).toBe('contactHeld'); expect(r.state.owner).toBe('hand'); expect(r.state.commits.pickup).toBe(0);
    r.step({ command: { type: 'reset' } }); r.step({ command: { type: 'relocate', x: 330 } }); expect(r.state.commits).toEqual({ pickup: 0, drop: 0 });
  });
  it('plans the same reachable contact geometry for both orientations without declaring contact', () => {
    const pivots = { armFar: [153.65, 168.98], waist: [128, 188.93] };
    const input = { profile, pivots, hand: [166, 199], grip: { x: 300, y: 293.430603448 }, floor: 320, scale: 180 / 256 };
    const right = contactRoute({ ...input, facing: 1 }), left = contactRoute({ ...input, facing: -1 });
    expect(right.drop).toBeCloseTo(7.80983, 4); expect(left.drop).toBe(right.drop);
    expect(right.x + left.x).toBeCloseTo(600); expect(Object.keys(right).sort()).toEqual(['drop', 'facing', 'x']);
  });
});
