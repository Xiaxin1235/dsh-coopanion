import assert from 'node:assert/strict';

/** Instrument only the policy's inputs. Real renderer, API 2 iframe and physics remain active. */
export async function controlRhythmClock(page) {
  await page.addInitScript(() => { window.rhythmNow = 0; window.rhythmHour = 12; window.rhythmRandom = 0; window.rhythmEvents = []; });
  await page.route('**/daily-rhythm.js', async route => {
    const response = await route.fetch(), source = await response.text();
    assert.ok(source.includes('export function stepRhythm('));
    await route.fulfill({ response, body: source.replace('export function stepRhythm(', 'function actualStepRhythm(') + `
export function stepRhythm(state, input, random) {
  input = {...input, now: window.rhythmNow ?? input.now, hour: window.rhythmHour ?? input.hour};
  const result = actualStepRhythm(state, input, () => window.rhythmRandom);
  window.rhythmInput = input; window.rhythmState = result.state;
  if (result.word || result.release) window.rhythmEvents.push({now:input.now,word:result.word,release:result.release,occupied:input.occupied});
  return result;
}
` });
  });
}

export async function advanceRhythm(page, target) {
  await page.evaluate(async target => {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    while (window.rhythmNow < target) { window.rhythmNow = Math.min(target, window.rhythmNow + 5000); await frame(); }
    await frame();
  }, target);
}
export async function recordBodyOrders(page) {
  const frame = page.frames().find(frame => frame.url().includes('figure-frame.html'));
  assert.ok(frame, 'API 2 sandbox frame exists');
  await frame.evaluate(() => { window.rhythmOrders = []; addEventListener('message', e => { if (['do', 'set'].includes(e.data?.t)) window.rhythmOrders.push(e.data); }); });
  return frame;
}
export const rhythmWords = page => page.evaluate(() => window.rhythmEvents.filter(e => e.word).map(e => e.word));
