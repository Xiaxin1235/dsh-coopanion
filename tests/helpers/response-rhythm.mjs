import assert from 'node:assert/strict';
/** Inject only a monotonic policy clock and observations; real DOM, input and persistence remain. */
export async function controlResponseClock(page) {
  await page.addInitScript(() => { window.responseNow = 0; window.responseEvents = []; });
  await page.route('**/response-rhythm.js', async route => {
    const response = await route.fetch(), source = await response.text();
    assert.ok(source.includes('export class ResponseRhythm'));
    await route.fulfill({ response, body: source.replace('export class ResponseRhythm', 'class ActualResponseRhythm') + `
export class ResponseRhythm extends ActualResponseRhythm {
  observe(input) { return super.observe({...input, now: window.responseNow}); }
  receipt(input) { return super.receipt({...input, now: window.responseNow}); }
  step(input) {
    const result = super.step({...input, now: window.responseNow});
    window.responseState = this.pending; window.responseInput = input;
    if (result) window.responseEvents.push(result);
    return result;
  }
}
` });
  });
}
export async function responseTick(page, now) {
  await page.evaluate(async now => { window.responseNow = now; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, now);
}
