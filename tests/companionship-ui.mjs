import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright-core';
import { controlCompanionClock, advanceCompanion } from './helpers/companionship.mjs';
import { recordBodyOrders } from './helpers/daily-rhythm.mjs';
const require = createRequire(import.meta.url);
const { CharacterStore } = require('../dist/character-store.cjs'), { CompanionStore } = require('../dist/companion-store.cjs'), { createPetServer } = require('../dist/figure-server.cjs');
let browser;
before(async () => { await mkdir('artifacts', { recursive: true }); browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); });
after(async () => { await browser?.close(); });
const session = { id: 'companion-focus', label: 'Companion focus', mood: 'idle', active: false, chatAvailable: true };
const snapshot = patch => ({ mood: 'idle', active: false, sessionId: session.id, sessions: [session], results: [], ...patch });
async function fixture(t, mode = 'interactive', vocab) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-companion-ui-'));
  let ownerNow = new Date(2026, 9, 15, 12).getTime();
  const store = new CompanionStore(join(directory, 'care'), () => ownerNow);
  const server = createPetServer({ webRoot: resolve('web'), store: new CharacterStore(join(directory, 'figures'), resolve('web/upstream/whale')), companions: store });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } }); page.setDefaultTimeout(10000);
  t.after(async () => { await page.close(); await new Promise(r => server.close(r)); await store.close(); await rm(directory, { recursive: true, force: true }); });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); t.after(() => assert.deepEqual(errors, []));
  await controlCompanionClock(page);
  if (vocab) await page.route('**/api/characters/load', async route => { const response = await route.fetch(), result = await response.json(); result.value.vocab = result.value.vocab.filter(w => vocab.includes(w.id)); await route.fulfill({ response, json: result }); });
  await page.addInitScript(() => { window.actions = []; window.dshPetBridge = { subscribe(fn) { window.receive = fn; }, action(a) { window.actions.push(a); }, hit() {} }; });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector('#pet[data-mode]');
  const receive = msg => page.evaluate(msg => window.receive(msg), msg);
  await receive({ type: 'init', baseline: true, options: { companionship: mode, roam: true, dailyRhythm: true, locale: 'zh' }, snapshot: snapshot() });
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => window.companionState?.blocked === false);
  const body = await recordBodyOrders(page);
  return { page, directory, store, receive, setDay: (day, minutes = 0) => { ownerNow = new Date(2026, 9, day, 12).getTime() + minutes * 60000; }, read: () => store.request({ type: 'read', characterId: 'whale' }), configure: options => receive({ type: 'configure', options }), body };
}
async function tickNext(page, extra = 0) { await advanceCompanion(page, await page.evaluate(() => window.companionState.active?.dueAt ?? window.companionState.dueAt) + extra); }
async function finishActivity(page) {
  for (let i = 0; i < 6 && await page.evaluate(() => !!window.companionState.active); i++) {
    const index = await page.evaluate(() => window.companionState.active.index);
    await tickNext(page);
    await page.waitForFunction(index => !window.companionState.active || window.companionState.active.index !== index, index);
  }
}
async function menu(page) { await page.locator('#pet').dispatchEvent('contextmenu', { button: 2 }); await page.locator('#menu').waitFor(); }

test('real API 2 body runs coherent routines, gives up on tasks, keeps missing vocabulary safe', async t => {
  const { page, receive, body } = await fixture(t, 'quiet');
  await tickNext(page); assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'observe'); await finishActivity(page);
  await tickNext(page); assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'play'); await finishActivity(page);
  await page.evaluate(() => { window.companionRandom = .7; }); await tickNext(page); assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'rest');
  await page.waitForSelector('#pet[data-mode=sit]');
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await page.waitForFunction(() => window.companionState.active === null); await page.waitForFunction(() => document.querySelector('#pet').dataset.mode !== 'sit');
  assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'working');
  assert.ok(await body.evaluate(() => window.rhythmOrders.some(e => e.t === 'do' && e.word === 'determined')));
  assert.deepEqual(await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation')), []);
});

test('invitation reserves once, ignores naturally, persists quiet and cannot send model/task messages', async t => {
  const { page, read, configure } = await fixture(t, 'interactive', ['neutral', 'stand', 'wave', 'love', 'happy', 'nod']);
  await page.evaluate(() => { window.companionRandom = .999; });
  await advanceCompanion(page, 1800000); await page.locator('#companion-invitation').waitFor(); await page.screenshot({ path: 'artifacts/companionship-invitation.png' }); assert.equal((await read()).invitation.remaining, 1);
  const focus = await page.evaluate(() => document.activeElement.tagName);
  await advanceCompanion(page, 1810000); await page.locator('#companion-invitation').waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => document.activeElement.tagName), focus);
  await advanceCompanion(page, await page.evaluate(() => window.companionState.inviteAt)); await page.locator('#companion-invitation').waitFor();
  await page.locator('#companion-quiet').click(); await page.waitForFunction(() => document.querySelector('#companion-status').textContent.length > 0);
  await page.waitForTimeout(150); assert.equal((await read()).invitation.quiet, true);
  await configure({ companionship: 'quiet' }); await configure({ companionship: 'interactive' }); await advanceCompanion(page, 7200000); assert.equal(await page.locator('#companion-invitation').isVisible(), false);
  assert.deepEqual(await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation')), []);
});

test('manual play grows only after completion, aborted play does not, archive survives renderer reload', async t => {
  const f = await fixture(t, 'quiet'); const { page, read } = f;
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0); assert.equal((await read()).relation.total, 0);
  await finishActivity(page); await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  assert.equal((await read()).relation.total, 1);
  f.setDay(16); await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  await f.receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await advanceCompanion(page, await page.evaluate(() => window.companionNow + 20000)); assert.equal((await read()).relation.total, 1);
  await page.reload(); await page.waitForSelector('#pet[data-mode]');
  await f.receive({ type: 'init', baseline: true, options: { companionship: 'quiet', roam: true }, snapshot: snapshot() });
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  const raw = JSON.parse(await readFile(join(f.directory, 'care/state.json'), 'utf8')); assert.equal(raw.characters.whale.total, 1);
});

test('hot companionship modes preserve captured reader, draft selection, and in-flight identities', async t => {
  const { page, receive, configure } = await fixture(t);
  const result = { id: 'p1-long', sessionId: session.id, text: '## Captured\n\n' + 'Stable reader content.\n\n'.repeat(100), time: 1, read: false };
  await receive({ type: 'snapshot', snapshot: snapshot({ results: [result], sessions: [{ ...session, replyId: result.id, reply: result.text }] }) });
  await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill('my stable draft'); await page.locator('#message').evaluate(n => n.setSelectionRange(2, 6)); await page.locator('#chat-read').click();
  await page.locator('#reader-text').evaluate(n => { n.scrollTop = 120; window.captured = n.firstChild; });
  const actions = await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation'));
  for (const companionship of ['off', 'quiet', 'interactive']) await configure({ companionship });
  for (const diagnostics of [true, false, true]) await configure({ diagnostics });
  assert.equal(await page.locator('#reader-text').evaluate(n => n.scrollTop === 120 && n.firstChild === window.captured), true);
  assert.deepEqual(await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation')), actions);
  await page.keyboard.press('Escape'); await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').evaluate(n => n.setSelectionRange(2, 6));
  for (const companionship of ['quiet', 'interactive', 'off']) await configure({ companionship });
  for (const diagnostics of [false, true, false]) await configure({ diagnostics });
  assert.deepEqual(await page.locator('#message').evaluate(n => [n.value, n === document.activeElement, n.selectionStart, n.selectionEnd]), ['my stable draft', true, 2, 6]);
  await page.locator('#send').click(); const sent = await page.evaluate(() => window.actions.find(a => a.type === 'chat'));
  await configure({ companionship: 'interactive', diagnostics: true }); await configure({ diagnostics: false }); await receive({ type: 'chat-result', sessionId: sent.sessionId, requestId: sent.requestId, status: 'accepted' });
  assert.equal(await page.locator('#message').inputValue(), ''); assert.equal(await page.evaluate(() => window.actions.filter(a => a.type === 'chat').length), 1);
});

test('real strokes count once, forged sandbox touches do not, missing words remain safe', async t => {
  const { page, read, body } = await fixture(t, 'quiet');
  await page.mouse.move(0, 0);
  await body.evaluate(() => parent.postMessage({ t: 'frame', layout: null, events: [{ kind: 'touch', detail: { kind: 'pet' } }] }, '*'));
  await page.waitForTimeout(100); assert.equal((await read()).relation.total, 0);
  const b = await page.locator('#pet').boundingBox();
  for (let i = 0; i < 18; i++) await page.mouse.move(b.x + b.width * (i % 2 ? .35 : .65), b.y + b.height * .45, { steps: 1 });
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  assert.equal((await read()).relation.total, 1);
  const missing = await fixture(t, 'quiet', ['neutral', 'stand']);
  await advanceCompanion(missing.page, 600000); assert.equal(await missing.page.locator('#pet').getAttribute('data-companion-activity'), 'idle');
  const orders = await missing.body.evaluate(() => window.rhythmOrders.filter(e => e.t === 'do').map(e => e.word)); assert.deepEqual(orders.filter(w => !['neutral', 'stand'].includes(w)), []);
});

test('twenty manual activities react within 500ms and interrupted trials never grow', async t => {
  const { page, read, receive } = await fixture(t, 'quiet'); const latencies = [];
  for (let i = 0; i < 20; i++) {
    await menu(page);
    await page.locator('#companion-play').evaluate(n => n.addEventListener('click', () => { window.playInputAt = performance.now(); }, { once: true }));
    await page.locator('#companion-play').click();
    await page.waitForSelector('#pet[data-companion-activity=play]'); latencies.push(await page.evaluate(() => performance.now() - window.playInputAt));
    await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
    await receive({ type: 'snapshot', snapshot: snapshot() });
  }
  assert.ok(latencies.filter(n => n <= 500).length >= 19, JSON.stringify(latencies)); assert.equal((await read()).relation.total, 0);
});

test('twenty real strokes keep visible feedback while hovering and share the growth cooldown', async t => {
  const { page, read, receive } = await fixture(t, 'quiet');
  await page.evaluate(() => {
    window.strokeLatencies = [];
    document.addEventListener('pointermove', () => { window.strokeInputAt = performance.now(); }, { capture: true });
    new MutationObserver(records => {
      if (records.some(r => r.type === 'childList') && !document.querySelector('#companion-feedback').hidden)
        window.strokeLatencies.push(performance.now() - window.strokeInputAt);
    }).observe(document.querySelector('#companion-feedback'), { childList: true });
  });
  for (let trial = 0; trial < 20; trial++) {
    await page.mouse.move(0, 0);
    if (trial) await page.waitForTimeout(2550);
    const b = await page.locator('#pet').boundingBox();
    for (let i = 0; i < 18; i++) await page.mouse.move(b.x + b.width * (i % 2 ? .35 : .65), b.y + b.height * .45, { steps: 1 });
    await page.waitForFunction(n => window.strokeLatencies.length > n, trial);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#companion-feedback').isVisible(), true);
  }
  const latencies = await page.evaluate(() => window.strokeLatencies);
  assert.equal(latencies.length, 20); assert.ok(latencies.filter(n => n <= 500).length >= 19, JSON.stringify(latencies));
  assert.equal((await read()).relation.total, 1);
  assert.deepEqual(await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation')), []);
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await page.locator('#companion-feedback').waitFor({ state: 'hidden', timeout: 500 });
});


test('six stored moments across three dates unlock the real familiar greeting after rehydration', async t => {
  const f = await fixture(t, 'quiet', ['neutral', 'stand', 'wave', 'love', 'happy', 'nod']); const { page, store, read } = f;
  for (let day = 15; day < 18; day++) for (const minute of [0, 5]) {
    f.setDay(day, minute); const state = await read();
    await store.request({ type: 'play', characterId: 'whale', requestId: `shared-${day}-${minute}`, revision: state.revision });
  }
  assert.equal((await read()).relation.unlocked, true);
  await f.configure({ companionship: 'interactive' });
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('已解锁'));
  await page.evaluate(() => { window.companionRandom = .999; });
  await advanceCompanion(page, 1800000); await page.locator('#companion-invitation').waitFor();
  await advanceCompanion(page, 1802100); await page.waitForFunction(() => window.companionEvents.some(e => e.word === 'love'));
  assert.ok(await f.body.evaluate(() => window.rhythmOrders.some(e => e.t === 'do' && e.word === 'love')));
});

test('reduced motion cancels an in-progress activity and a small large-text menu remains reachable', async t => {
  const { page, configure, read } = await fixture(t, 'quiet');
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.companionState.active === null, null, { timeout: 1000 });
  assert.equal((await read()).relation.total, 0);
  await page.setViewportSize({ width: 480, height: 400 }); await configure({ textScale: 1.5 });
  await menu(page);
  await page.screenshot({ path: 'artifacts/companionship-small-menu.png' });
  const bounds = await page.locator('#menu').boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 400, JSON.stringify(bounds));
  await page.locator('#hide').scrollIntoViewIfNeeded(); assert.equal(await page.locator('#hide').isVisible(), true);
});

test('idle rendering is bounded while real elapsed time, work and input keep their cadence', async t => {
  const { page, configure, receive, body } = await fixture(t, 'quiet');
  await configure({ roam: false }); await page.mouse.move(0, 0);
  await body.evaluate(() => { window.cadence = []; addEventListener('message', e => { if (e.data?.t === 'tick') window.cadence.push(e.data.dt); }); });
  const sample = async () => { await body.evaluate(() => { window.cadence = []; }); const at = await page.evaluate(() => performance.now()); await page.waitForTimeout(2000); return { elapsed: (await page.evaluate(() => performance.now()) - at) / 1000, ticks: await body.evaluate(() => window.cadence.slice()) }; };
  const idle = await sample();
  await configure({ companionship: 'off' }); const legacy = await sample();
  const hasHeadroom = legacy.ticks.length / legacy.elapsed >= 40;
  assert.ok(idle.ticks.length > 0 && idle.ticks.length / idle.elapsed <= 31, JSON.stringify({ idle, legacy }));
  if (hasHeadroom) assert.ok(idle.ticks.length < legacy.ticks.length * .8 && idle.ticks.length > legacy.ticks.length * .25, JSON.stringify({ idle: idle.ticks.length, legacy: legacy.ticks.length }));
  else t.diagnostic('Renderer baseline is below 40fps; relative speedup is not exercised here. Controlled render-cadence tests cover cap/bypass and dt.');
  if (hasHeadroom) assert.ok(Math.abs(idle.ticks.reduce((a, b) => a + b, 0) - idle.elapsed) < .25, JSON.stringify(idle));
  await configure({ companionship: 'quiet' });
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  const work = await sample(); assert.ok(work.ticks.length > 0); if (hasHeadroom) assert.ok(work.ticks.length > idle.ticks.length * 1.3);
  await receive({ type: 'snapshot', snapshot: snapshot() }); await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill('Keep the input cadence');
  const input = await sample(); assert.ok(input.ticks.length > 0); if (hasHeadroom) assert.ok(input.ticks.length > idle.ticks.length * 1.3);
});
