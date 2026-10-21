import { it, expect } from 'vitest';
import { createLiveMouth } from '../web/live-mouth.js';
const snapshot = (progress, patch = {}) => ({ sessions: [{ id: 'a', mood: 'talking', active: true, streaming: true, speechRevision: progress, revision: 1, ...patch }] });
it('bounds an unchanged live state, renews on actual progress, and rejects repeated or older progress', () => {
  const mouth = createLiveMouth();
  expect(mouth.step(snapshot(1), 0)).toBe(true);
  expect(mouth.step(snapshot(1), 100)).toBe(false);
  expect(mouth.step(snapshot(1), 180)).toBe(true);
  for (let now = 200; now < 1400; now += 200) mouth.step(snapshot(1), now);
  expect(mouth.step(snapshot(1), 1400)).toBe(false);
  expect(mouth.step(snapshot(1, {revision: 999}), 1600)).toBe(false);
  expect(mouth.step(snapshot(0), 1800)).toBe(false);
  expect(mouth.step(snapshot(2), 2000)).toBe(true);
});
it('does not open on reasoning, stream end, work, quiet rendering or a lifecycle gap', () => {
  for (const patch of [{speechRevision:0}, {streaming:false}, {active:false}, {mood:'working'}]) {
    const mouth = createLiveMouth(); expect(mouth.step(snapshot(1, patch), 0)).toBe(false);
  }
  const mouth = createLiveMouth(); expect(mouth.step(snapshot(1), 0, false)).toBe(false);
  expect(mouth.step(snapshot(1), 200, true)).toBe(false);
  expect(mouth.step(snapshot(2), 400)).toBe(true);
  expect(mouth.step(snapshot(3), 2000)).toBe(false);
  expect(mouth.step(snapshot(3), 2200)).toBe(false);
  expect(mouth.step(snapshot(4), 2400)).toBe(true);
  expect(mouth.step(snapshot(4, {streaming:false}), 2600)).toBe(false);
});
it('tracks sessions independently and never renews on focus or another session ending', () => {
  const mouth = createLiveMouth(), a = snapshot(1).sessions[0], b = {...a, id:'b'};
  expect(mouth.step({sessions:[a,b], sessionId:'a'}, 0)).toBe(true);
  for (let now = 200; now <= 1400; now += 200) mouth.step({sessions:[a,b]}, now);
  expect(mouth.step({sessions:[a,b], sessionId:'b'}, 1600)).toBe(false);
  expect(mouth.step({sessions:[a,{...b,mood:'idle'}]}, 1800)).toBe(false);
  expect(mouth.step({sessions:[{...a,speechRevision:2},b]}, 2000)).toBe(true);
});
it('supports bounded legacy/demo progress without a new host field', () => {
  const mouth = createLiveMouth(), legacy = {sessionId:'demo',mood:'talking',revision:1};
  expect(mouth.step(legacy, 0)).toBe(true);
  for(let now=200;now<=1400;now+=200) mouth.step(legacy,now);
  expect(mouth.step(legacy,1600)).toBe(false);
  expect(mouth.step({...legacy,revision:2},1800)).toBe(true);
});
