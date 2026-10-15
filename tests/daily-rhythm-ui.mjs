import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { previewServer } from '../scripts/preview.mjs';
import { controlRhythmClock, advanceRhythm, recordBodyOrders, rhythmWords } from './helpers/daily-rhythm.mjs';

let directory, server, browser;
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const session = { id: 'rhythm-focus', label: 'Rhythm session', mood: 'idle', active: false, chatAvailable: true };
const snapshot = (patch = {}) => ({ mood: 'idle', active: false, sessionId: session.id, sessions: [session], results: [], ...patch });
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'dsh-rhythm-ui-'));
  server = previewServer({ dataDir: directory }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  await mkdir('artifacts', { recursive: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); if (directory) await rm(directory, { recursive: true, force: true }); });
async function fixture(t, enabled = true, vocabulary) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } }); t.after(() => page.close()); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', error => errors.push(error.message)); t.after(() => assert.deepEqual(errors, []));
  await controlRhythmClock(page);
  if (vocabulary) await page.route('**/api/characters/load', async route => {
    const response = await route.fetch(), result = await response.json();
    result.value.vocab = result.value.vocab.filter(word => vocabulary.includes(word.id));
    await route.fulfill({ response, json: result });
  });
  await page.addInitScript(() => { window.rhythmActions = []; window.dshPetBridge = { subscribe(fn) { window.rhythmReceive = fn; }, action(a) { window.rhythmActions.push(a); }, hit() {} }; });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector('#pet[data-mode]');
  const receive = message => page.evaluate(message => window.rhythmReceive(message), message);
  await receive({ type: 'init', baseline: true, options: { dailyRhythm: enabled, size: 180, roam: true }, snapshot: snapshot() });
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => !['air', 'crouch', 'drag'].includes(document.querySelector('#pet').dataset.mode));
  // Wait until the initial landing stops occupying the strategy.
  if (enabled) await page.waitForFunction(() => window.rhythmState?.dueAt === 45000);
  return { page, receive, configure: options => receive({ type: 'configure', options }), body: await recordBodyOrders(page) };
}

test('legacy default uses calm; optional day/night scheduling emits API 2 words and restores without notifications', async t => {
  const { page, configure, body } = await fixture(t, false);
  await advanceRhythm(page, 200000); assert.deepEqual(await rhythmWords(page), []);
  await configure({ size: 181 }); // Observe unchanged legacy control values without replacing the body.
  assert.equal(await page.locator('#pet').getAttribute('data-rhythm'), 'off');
  await configure({ roam: false }); await configure({ roam: true });
  assert.ok(await body.evaluate(() => window.rhythmOrders.some(e => e.t === 'set' && e.state.roam === 'calm')), 'legacy calm path stays intact');
  await page.evaluate(() => { window.rhythmNow = 0; });
  await configure({ dailyRhythm: true }); await page.waitForFunction(() => window.rhythmState?.dueAt === 45000);
  await advanceRhythm(page, 45000); assert.deepEqual(await rhythmWords(page), ['look']);
  assert.ok(await body.evaluate(() => window.rhythmOrders.some(e => e.t === 'do' && e.word === 'look')));
  assert.ok(await body.evaluate(() => window.rhythmOrders.some(e => e.t === 'set' && e.state.roam === 'off')));
  await advanceRhythm(page, 49000);
  await page.waitForSelector('#pet[data-mode=idle]');
  await advanceRhythm(page, 94000); assert.deepEqual(await rhythmWords(page), ['look', 'nod']);
  await page.evaluate(() => { window.rhythmHour = 23; }); await advanceRhythm(page, 95000);
  assert.ok(['day', 'night'].includes(await page.locator('#pet').getAttribute('data-rhythm'))); // Production local clock is independent of the wrapper.
  assert.equal(await page.evaluate(() => window.rhythmState.period), 'night');
  await advanceRhythm(page, 215000); assert.deepEqual(await rhythmWords(page), ['look', 'nod', 'sit']);
  await page.waitForSelector('#pet[data-mode=sit]');
  await advanceRhythm(page, 230000); await page.waitForSelector('#pet[data-mode=idle]');
  const orders = await body.evaluate(() => window.rhythmOrders.filter(e => e.t === 'do').map(e => e.word));
  assert.ok(orders.includes('stand')); assert.ok(orders.includes('neutral'));
  assert.deepEqual(await page.evaluate(() => window.rhythmActions.filter(a => ['read', 'select', 'chat', 'notification-snooze'].includes(a.type))), []);
  assert.equal(await page.locator('#bubble').isVisible(), false); assert.equal(await page.locator('#interaction').isVisible(), false);
  await page.screenshot({ path: 'artifacts/daily-rhythm-ui.png' });
  await writeFile('artifacts/daily-rhythm-ui.json', JSON.stringify({ sourceCommit, controlledPolicyClock: true, realPhysics: true, api2Orders: orders, events: await page.evaluate(() => window.rhythmEvents), noNewNotificationsOrMessages: true }, null, 2) + '\n');
});

test('task, pending requests, input, reader, reduced motion and user rest preempt idle activity', async t => {
  const { page, receive, configure, body } = await fixture(t);
  await advanceRhythm(page, 45000);
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await advanceRhythm(page, 200000); assert.deepEqual(await rhythmWords(page), ['look']);
  assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'working');
  const lastTask = await body.evaluate(() => window.rhythmOrders.filter(e => e.t === 'do').at(-1)); assert.equal(lastTask.word, 'determined');
  const runtime = { phase: 'running', visible: true, suspended: false, generation: 1, visibilityRevision: 1 };
  const request = { id: 'rhythm-request', sessionId: session.id, nativeId: 'rhythm-approval', kind: 'approval', turn: 1, seq: 1, state: 'open', preview: 'Pending approval', dueAt: null };
  await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime, interactions: [request] } });
  await receive({ type: 'snapshot', snapshot: snapshot() }); await advanceRhythm(page, 350000);
  assert.deepEqual(await rhythmWords(page), ['look']); assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'waiting');
  await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime, interactions: [] } });
  await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill('unfinished draft'); await page.keyboard.press('Escape');
  await advanceRhythm(page, 500000); assert.deepEqual(await rhythmWords(page), ['look']);
  await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill(''); await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await advanceRhythm(page, 650000); assert.deepEqual(await rhythmWords(page), ['look']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await receive({ type: 'ui-control', command: 'sleep' }); await page.waitForSelector('#pet[data-mood=sleeping]');
  await advanceRhythm(page, 800000); assert.deepEqual(await rhythmWords(page), ['look']);
  assert.equal(await page.locator('#pet').getAttribute('data-mode'), 'sleep');
  await configure({ dailyRhythm: false }); await page.waitForSelector('#pet[data-mood=sleeping]');
});

test('hot preference keeps reader DOM/scroll, draft/focus/selection, request identity and bubble expiry', async t => {
  const { page, receive, configure } = await fixture(t);
  const reply = { id: 'rhythm-reply', sessionId: session.id, time: 1, read: false, text: '## Captured\n\n' + 'Keep reading this captured reply.\n\n'.repeat(60) };
  await receive({ type: 'snapshot', snapshot: snapshot({ results: [reply], sessions: [{ ...session, replyId: reply.id, reply: reply.text }] }) });
  await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill('stable draft'); await page.locator('#message').evaluate(n => n.setSelectionRange(2, 7));
  await page.locator('#chat-read').click(); await page.locator('#reader-text').evaluate(n => { n.scrollTop = 120; window.rhythmReader = n.firstChild; });
  const html = await page.locator('#reader-text').innerHTML(), actions = await page.evaluate(() => window.rhythmActions.filter(a => a.type !== 'presentation'));
  for (const dailyRhythm of [false, true, false, true]) await configure({ dailyRhythm });
  assert.equal(await page.locator('#reader-text').innerHTML(), html); assert.equal(await page.locator('#reader-text').evaluate(n => n.firstChild === window.rhythmReader && n.scrollTop === 120), true);
  assert.deepEqual(await page.evaluate(() => window.rhythmActions.filter(a => a.type !== 'presentation')), actions);
  await page.keyboard.press('Escape'); await receive({ type: 'ui-control', command: 'chat' });
  assert.equal(await page.locator('#message').inputValue(), 'stable draft');
  await page.locator('#message').evaluate(n => n.setSelectionRange(2, 7));
  for (const dailyRhythm of [false, true]) await configure({ dailyRhythm });
  assert.deepEqual(await page.locator('#message').evaluate(n => [n === document.activeElement, n.selectionStart, n.selectionEnd]), [true, 2, 7]);
  await page.locator('#send').click(); const sent = await page.evaluate(() => window.rhythmActions.find(a => a.type === 'chat'));
  assert.ok(sent?.requestId); await configure({ dailyRhythm: false }); await configure({ dailyRhythm: true });
  assert.equal(await page.locator('#message').inputValue(), 'stable draft');
  await receive({ type: 'chat-result', sessionId: sent.sessionId, requestId: sent.requestId, status: 'accepted' });
  assert.equal(await page.locator('#message').inputValue(), ''); assert.equal(await page.evaluate(() => window.rhythmActions.filter(a => a.type === 'chat').length), 1);
  await page.keyboard.press('Escape'); await configure({ bubbleDurationMs: 2000 });
  await receive({ type: 'snapshot', snapshot: snapshot({ results: [{ ...reply, id: 'rhythm-short', text: 'Short reply' }] }) });
  // Short speech can finish during the entrance animation, hiding Show now
  // before a real click becomes actionable. Expiry starts at speech completion.
  await page.waitForSelector('#bubble[data-typing=false]');
  await page.mouse.move(0, 0); await page.locator('#pet').focus();
  await page.waitForTimeout(1200); for (const dailyRhythm of [false, true, false, true]) await configure({ dailyRhythm });
  await page.locator('#bubble').waitFor({ state: 'hidden', timeout: 1500 });
});

test('roam off, native hidden/suspended and pointer dragging each suppress scheduling', async t => {
  const { page, receive, configure } = await fixture(t);
  await configure({ roam: false }); await advanceRhythm(page, 150000); assert.deepEqual(await rhythmWords(page), []);
  await configure({ roam: true });
  for (const runtime of [{ phase: 'running', visible: false, suspended: false }, { phase: 'running', visible: true, suspended: true }]) {
    await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime: { ...runtime, generation: 1 }, interactions: [] } });
    await advanceRhythm(page, await page.evaluate(() => window.rhythmNow + 150000)); assert.deepEqual(await rhythmWords(page), []);
  }
  await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime: { phase: 'running', visible: true, suspended: false, generation: 1 }, interactions: [] } });
  await page.locator('#pet').hover(); await page.mouse.down();
  const b = await page.locator('#pet').boundingBox(); await page.mouse.move(b.x - 60, b.y - 80, { steps: 8 }); await page.waitForSelector('#pet[data-mode=drag]');
  await advanceRhythm(page, await page.evaluate(() => window.rhythmNow + 150000)); assert.deepEqual(await rhythmWords(page), []);
  await page.mouse.up(); await page.mouse.move(0, 0); await page.waitForFunction(() => !['air', 'drag', 'crouch'].includes(document.querySelector('#pet').dataset.mode));
});

test('missing manifest vocabulary falls back to idle without issuing unsupported words', async t => {
  const { page, body } = await fixture(t, true, ['neutral', 'stand']);
  await advanceRhythm(page, 400000);
  assert.deepEqual(await rhythmWords(page), []);
  assert.equal(await page.locator('#pet').getAttribute('data-mode'), 'idle');
  assert.deepEqual(await body.evaluate(() => window.rhythmOrders.filter(e => e.t === 'do' && ['look', 'nod', 'wave', 'sit'].includes(e.word))), []);
});

test('renderer observes changed system local hours while monotonic deadlines survive midnight', async t => {
  const { page } = await fixture(t);
  await page.evaluate(() => {
    window.rhythmHour = null; window.testLocalHour = 12;
    const OriginalDate = Date; window.Date = class extends OriginalDate { getHours() { return window.testLocalHour; } };
  });
  await page.waitForSelector('#pet[data-rhythm=day]');
  await advanceRhythm(page, 20000);
  await page.evaluate(() => { window.testLocalHour = 22; }); await page.waitForSelector('#pet[data-rhythm=night]');
  await page.waitForFunction(() => window.rhythmState.period === 'night' && window.rhythmState.dueAt === 140000);
  await page.evaluate(() => { window.testLocalHour = 0; }); await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.rhythmState.dueAt), 140000, 'midnight does not shorten or replay the night interval');
  await page.evaluate(() => { window.testLocalHour = 7; }); await page.waitForSelector('#pet[data-rhythm=day]');
  await page.waitForFunction(() => window.rhythmState.dueAt === 65000);
  assert.deepEqual(await rhythmWords(page), []);
});
