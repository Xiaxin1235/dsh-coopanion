import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createRequire } from 'node:module';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright-core';
import { controlCompanionClock, advanceCompanion } from './helpers/companionship.mjs';
import { controlNpc, npcTick, npcUntil } from './helpers/npc-life.mjs';
import { recordBodyOrders } from './helpers/body-orders.mjs';
const require = createRequire(import.meta.url);
const { CharacterStore } = require('../dist/character-store.cjs'), { CompanionStore } = require('../dist/companion-store.cjs'), { createPetServer } = require('../dist/figure-server.cjs');
let browser;
before(async () => { await mkdir('artifacts', { recursive: true }); browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); });
after(async () => { await browser?.close(); });
const session = { id: 'companion-focus', label: 'Companion focus', mood: 'idle', active: false, chatAvailable: true };
const snapshot = patch => ({ mood: 'idle', active: false, sessionId: session.id, sessions: [session], results: [], ...patch });
async function fixture(t, mode = 'interactive', vocab, star = false, timing = null) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-companion-ui-'));
  let ownerNow = new Date(2026, 9, 15, 12).getTime();
  const store = new CompanionStore(join(directory, 'care'), () => ownerNow);
  const characters = new CharacterStore(join(directory, 'figures'), resolve('web/upstream/whale'));
  if (star) {
    const manifest = JSON.parse(await readFile('examples/star/figure.json', 'utf8')); manifest.can = { walk: false };
    const imported = await characters.import(zipSync({ 'figure.json': strToU8(JSON.stringify(manifest)), 'figure.js': new Uint8Array(await readFile('examples/star/figure.js')) }));
    await characters.select(imported.importedId);
  }
  const server = createPetServer({ webRoot: resolve('web'), store: characters, companions: store });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } }); page.setDefaultTimeout(10000);
  t.after(async () => { await page.close(); await new Promise(r => server.close(r)); await store.close(); await rm(directory, { recursive: true, force: true }); });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); t.after(() => assert.deepEqual(errors, []));
  if (timing) {
    // A frame timestamp can precede a click callback's performance.now().
    // Keep real event time and physics; expose that ordering deterministically.
    await page.addInitScript(lag => { const raf = requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => raf(time => callback(time - lag)); }, timing.frameLag ?? 0);
  } else { await controlCompanionClock(page); await controlNpc(page); }
  if (vocab) await page.route('**/api/characters/load', async route => { const response = await route.fetch(), result = await response.json(); result.value.vocab = result.value.vocab.filter(w => vocab.includes(w.id)); await route.fulfill({ response, json: result }); });
  await page.addInitScript(() => { window.actions = []; addEventListener('message', e => { if (e.data?.t === 'frame' && e.data.layout) window.lastNpcLayout = e.data.layout; }); window.dshPetBridge = { subscribe(fn) { window.receive = fn; }, action(a) { window.actions.push(a); }, hit() {} }; });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector('#pet[data-mode]');
  const receive = msg => page.evaluate(msg => window.receive(msg), msg);
  await receive({ type: 'init', baseline: true, options: { companionship: mode, roam: true, locale: 'zh' }, snapshot: snapshot() });
  await page.mouse.move(0, 0);
  if (timing) await page.waitForSelector('#pet[data-mode=idle]');
  else await page.waitForFunction(() => window.companionState?.blocked === false);
  const body = await recordBodyOrders(page);
  return { page, directory, store, receive, setDay: (day, minutes = 0) => { ownerNow = new Date(2026, 9, day, 12).getTime() + minutes * 60000; }, read: () => store.request({ type: 'read', characterId: 'whale' }), configure: options => receive({ type: 'configure', options }), body };
}
async function tickNext(page, extra = 0) { await advanceCompanion(page, await page.evaluate(() => window.companionState.active?.dueAt) + extra); }
async function finishActivity(page) {
  if (await page.evaluate(() => window.companionState.active?.phase === 'await')) {
    await page.locator('#companion-respond').click(); await page.mouse.move(0, 0);
  }
  for (let i = 0; i < 6 && await page.evaluate(() => !!window.companionState.active); i++) {
    const index = await page.evaluate(() => window.companionState.active.index);
    await tickNext(page);
    await page.waitForFunction(index => !window.companionState.active || window.companionState.active.index !== index, index);
  }
}
async function menu(page) { await page.locator('#pet').dispatchEvent('contextmenu', { button: 2 }); await page.locator('#menu').waitFor(); }

test('NPC follows real arrival, pauses typing, resumes retained intent and returns home', async t => {
  const { page, receive, body, configure } = await fixture(t, 'quiet');
  await npcUntil(page, 'outbound');
  const original = await page.evaluate(() => ({ id: window.npcState.walkId, target: window.npcState.target }));
  assert.ok(original.id > 0);
  await page.evaluate(() => { window.npcKeyboard = 'active'; }); await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.phase), 'yield');
  assert.equal(await page.evaluate(() => window.npcState.target), original.target);
  await page.waitForFunction(() => document.querySelector('#pet').dataset.mode !== 'walk');
  assert.equal(await page.locator('#companion-invitation').isVisible(), false);
  await page.evaluate(() => { window.npcKeyboard = 'idle'; }); await npcTick(page); await npcTick(page, 5000);
  assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  await npcUntil(page, 'outbound');
  assert.ok(await page.evaluate(id => window.npcState.walkId > id, original.id));
  assert.equal(await page.evaluate(() => window.npcState.target), original.target);
  await body.evaluate(({ id, layout }) => parent.postMessage({ t: 'frame', layout, events: [{ kind: 'arrived', detail: { walkId: id } }] }, '*'), { id: original.id, layout: await page.evaluate(() => window.lastNpcLayout) });
  await page.waitForSelector('#pet[data-mode=walk]');
  await page.waitForFunction(() => window.npcState.phase === 'observe', null, { timeout: 20000 });
  assert.ok(await page.evaluate(() => window.npcState.recent.length > 0));
  await page.screenshot({ path: 'artifacts/npc-life-observe.png' });
  await npcUntil(page, 'return');
  await page.waitForFunction(() => window.npcState.phase === 'home', null, { timeout: 20000 });
  await page.waitForSelector('#pet[data-mode=sit]');
  await page.evaluate(() => { window.npcBodyFrame = document.querySelector('#body-layer iframe'); });
  await configure({ companionship: 'off' }); await page.waitForFunction(() => document.querySelector('#pet').dataset.mode !== 'sit');
  assert.equal(await page.evaluate(() => document.querySelector('#body-layer iframe') === window.npcBodyFrame), true);
  await configure({ companionship: 'quiet' });
  await npcUntil(page, 'outbound');
  const target = await page.evaluate(() => window.npcState.target);
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await page.waitForFunction(() => window.npcState.phase === 'yield');
  assert.equal(await page.evaluate(() => window.npcState.target), target);
  assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'working');
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
  const orders = await missing.body.evaluate(() => window.bodyOrders.filter(e => e.t === 'do').map(e => e.word)); assert.deepEqual(orders.filter(w => !['neutral', 'stand'].includes(w)), []);
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
    window.strokeLatencies = []; window.strokeRecorded = -1; window.strokeTrial = 0;
    document.addEventListener('pointermove', () => { window.strokeInputAt = performance.now(); }, { capture: true });
    new MutationObserver(records => {
      if (records.some(r => r.type === 'childList') && !document.querySelector('#companion-feedback').hidden && window.strokeRecorded !== window.strokeTrial) {
        window.strokeRecorded = window.strokeTrial; window.strokeLatencies.push(performance.now() - window.strokeInputAt);
      }
    }).observe(document.querySelector('#companion-feedback'), { childList: true });
  });
  for (let trial = 0; trial < 20; trial++) {
    await page.evaluate(trial => { window.strokeTrial = trial; }, trial);
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
  assert.ok(await f.body.evaluate(() => window.bodyOrders.some(e => e.t === 'do' && e.word === 'love')));
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
  await configure({ companionship: 'off' }); const disabled = await sample();
  const hasHeadroom = disabled.ticks.length / disabled.elapsed >= 40;
  assert.ok(idle.ticks.length > 0 && idle.ticks.length / idle.elapsed <= 31, JSON.stringify({ idle, disabled }));
  if (hasHeadroom) assert.ok(idle.ticks.length < disabled.ticks.length * .8 && idle.ticks.length > disabled.ticks.length * .25, JSON.stringify({ idle: idle.ticks.length, disabled: disabled.ticks.length }));
  else t.diagnostic('Renderer baseline is below 40fps; relative speedup is not exercised here. Controlled render-cadence tests cover cap/bypass and dt.');
  if (hasHeadroom) assert.ok(Math.abs(idle.ticks.reduce((a, b) => a + b, 0) - idle.elapsed) < .25, JSON.stringify(idle));
  await configure({ companionship: 'quiet' });
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  const work = await sample(); assert.ok(work.ticks.length > 0); if (hasHeadroom) assert.ok(work.ticks.length > idle.ticks.length * 1.3);
  await receive({ type: 'snapshot', snapshot: snapshot() }); await receive({ type: 'ui-control', command: 'chat' }); await page.locator('#message').fill('Keep the input cadence');
  const input = await sample(); assert.ok(input.ticks.length > 0); if (hasHeadroom) assert.ok(input.ticks.length > idle.ticks.length * 1.3);
});


test('unknown input, mouse proximity, lifecycle and limited star keep control and vocabulary safe', async t => {
  const f = await fixture(t, 'quiet'); const { page, receive, configure, body } = f;
  await configure({ size: 181 }); await configure({ size: 180 });
  await body.waitForFunction(() => window.bodyOrders.some(o => o.t === 'set' && o.state.bounds?.S === 180 / 256));
  const scale = () => body.evaluate(() => window.bodyOrders.filter(o => o.t === 'set' && o.state.bounds).at(-1)?.state.bounds.S);
  await npcUntil(page, 'outbound');
  const target = await page.evaluate(() => window.npcState.target);
  const box = await page.locator('#pet').boundingBox();
  await page.mouse.move(box.x - 25, box.y + box.height / 2); await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.phase), 'yield');
  assert.equal(await page.evaluate(() => window.npcState.target), target);
  await page.mouse.move(0, 0); await page.evaluate(() => { window.npcKeyboard = 'unknown'; }); await npcTick(page);
  assert.equal(await page.locator('#pet').getAttribute('data-npc-reason'), 'unknown');
  assert.equal(await scale(), 180 / 256, 'unknown perception must not shrink the body');
  await page.evaluate(() => { window.npcKeyboard = 'idle'; }); await npcTick(page); await npcTick(page, 5000);
  assert.equal(await scale(), 180 / 256, 'idle recovery must retain configured size');
  const runtime = { phase: 'running', visible: false, suspended: false, generation: 1, visibilityRevision: 1 };
  await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime, interactions: [] } }); await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.reason), 'lifecycle');
  assert.equal(await page.locator('#npc-home').isVisible(), false);
  await receive({ type: 'notification-state', snapshot: { protocol: 1, runtime: { ...runtime, visible: true, suspended: true }, interactions: [] } }); await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.reason), 'lifecycle');
  await configure({ roam: false }); assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  assert.equal(await page.locator('#npc-home').evaluate(n => getComputedStyle(n).pointerEvents), 'none');
  const star = await fixture(t, 'quiet', undefined, true);
  await star.page.waitForSelector('#pet[data-character=paper-star]');
  for (let i = 0; i < 50; i++) await npcTick(star.page);
  assert.equal(await star.page.evaluate(() => window.npcEvents.some(e => e.walk)), false);
  const words = await star.body.evaluate(() => window.bodyOrders.filter(e => e.t === 'do').map(e => e.word));
  assert.ok(!words.includes('look') && !words.includes('sit') && !words.includes('dance'), JSON.stringify(words));
});


test('native NPC waits for acknowledged workArea before establishing home', async t => {
  const { page, receive } = await fixture(t, 'quiet');
  await page.reload(); await page.waitForSelector('#pet[data-mode]');
  await page.evaluate(() => { window.dshPetBridge.nativeGeometry = true; });
  await receive({ type: 'init', baseline: true, options: { companionship: 'quiet', roam: true }, snapshot: snapshot() });
  for (let i = 0; i < 10; i++) await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.placed), false);
  assert.equal(await page.evaluate(() => window.npcState.reason), 'geometry');
  await receive({ type: 'display-changed', revision: 1, displayId: 2, workArea: { x: -1000, y: 0, width: 1000, height: 750 }, contentBounds: { x: -1000, y: 0, width: 1000, height: 750 }, scaleFactor: 2 });
  await npcUntil(page, 'outbound');
  assert.ok(await page.evaluate(() => window.npcEvents.some(e => e.place !== undefined && Math.abs(e.place - 850) < 1)));
});

test('manual interaction survives a frame timestamp preceding the click event clock', async t => {
  const { page, read, configure } = await fixture(t, 'quiet', undefined, false, { frameLag: 100 });
  await configure({ roam: false });
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'play', 'A stale frame timestamp must not cancel explicit play');
  assert.equal((await read()).relation.total, 0, 'Starting still does not grant growth');
  await page.locator('#companion-respond').click();
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  assert.equal((await read()).relation.total, 1);
});

for (const jump of [false, true]) test(`manual interaction follows a real poke reaction while actual work still preempts it (jump=${jump})`, async t => {
  const { page, body, read, receive, configure } = await fixture(t, 'quiet', undefined, false, {});
  await configure({ roam: false });
  await page.waitForFunction(() => window.lastNpcLayout?.mode === 'idle' && !window.lastNpcLayout.busy);
  // The upstream poke randomly jumps. Exercise both real physics paths rather
  // than mistaking the air/crouch guard for a short expression blocking play.
  await body.evaluate(jump => { Math.random = () => jump ? .1 : .9; }, jump);
  await page.locator('#pet').click(); await page.mouse.move(0, 0);
  if (jump) {
    // Admit the action within the observed physical frame, so automation latency
    // cannot turn an airborne attempt into a click after landing.
    await page.waitForFunction(() => {
      if (!['crouch', 'air'].includes(window.lastNpcLayout?.mode)) return false;
      document.querySelector('#companion-play').click();
      return true;
    });
    assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'idle', 'Airborne physics still owns the body');
    assert.equal((await read()).relation.total, 0);
    await page.waitForSelector('#pet[data-mode=idle]');
  } else await page.waitForSelector('#pet[data-mood=happy]');
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#pet').getAttribute('data-companion-activity'), 'play', 'A brief poke expression is not task occupancy');
  assert.equal((await read()).relation.total, 0);
  await receive({ type: 'snapshot', snapshot: snapshot({ mood: 'working', active: true, sessions: [{ ...session, mood: 'working', active: true }] }) });
  await page.waitForSelector('#pet[data-companion-activity=idle][data-mood=working]');
  assert.equal((await read()).relation.total, 0, 'Work interruption never grants growth');
});

// Stage 5B uses genuine trusted play completion, not a forged sandbox event.
test('shared memory can be inspected, corrected and deleted after real play and reload, including while off', async t => {
  const { page, read, receive, configure, directory } = await fixture(t, 'quiet');
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  assert.equal((await read()).memory.entries.length, 0);
  await finishActivity(page);
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('记得上次一起活动'));
  assert.equal((await read()).memory.entries[0].kind, 'play');
  if (process.env.COMPANION_EVIDENCE_DIR) { await mkdir(process.env.COMPANION_EVIDENCE_DIR, { recursive: true }); await menu(page); await page.locator('#companion-memories summary').click(); await page.locator('#memory-list li').waitFor(); await page.screenshot({ path: join(process.env.COMPANION_EVIDENCE_DIR, 'memory-completed.png') }); await page.keyboard.press('Escape'); }
  await page.reload(); await page.waitForSelector('#pet[data-mode]');
  await receive({ type: 'init', baseline: true, options: { companionship: 'quiet', roam: true, locale: 'zh' }, snapshot: snapshot() });
  await menu(page); await page.locator('#companion-memories summary').click();
  await page.locator('#memory-list li').waitFor();
  await page.getByRole('button', { name: '纠正为抚摸', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#memory-list').textContent.includes('已纠正'));
  assert.equal((await read()).memory.entries[0].correctedKind, 'pet');
  assert.equal((await read()).relation.total, 1);
  await configure({ companionship: 'off' });
  await page.getByRole('button', { name: '删除这条', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#memory-status').textContent.includes('还没有'));
  assert.equal((await read()).memory.entries.length, 0); assert.equal((await read()).relation.total, 1);
  const saved = JSON.parse(await readFile(join(directory, 'care/state.json'), 'utf8')); assert.equal(saved.schema, 2);
  const out = process.env.COMPANION_EVIDENCE_DIR;
  if (out) { await mkdir(out, { recursive: true }); await page.screenshot({ path: join(out, 'memory-deleted-off.png') }); }
});

test('opening memory controls interrupts real play and a cleared memory stays empty', async t => {
  const { page, read, store } = await fixture(t, 'quiet');
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0);
  const before = await read();
  await store.request({ type: 'memory-clear', characterId: 'whale', revision: before.revision, requestId: 'clear-during-play' });
  // Viewing memories is user occupation, so the running play must yield.
  await menu(page); await page.locator('#companion-memories summary').click();
  await page.keyboard.press('Escape');
  // Opening the menu correctly interrupts play; no success may be inferred.
  await finishActivity(page);
  assert.equal((await read()).memory.entries.length, 0); assert.equal((await read()).relation.total, 0);
});

test('shared play waits for a real response, confirms saved memory and recalls it next time', async t => {
  const {page,read,configure}=await fixture(t,'quiet');
  await menu(page);await page.locator('#companion-play').click();
  await page.locator('#companion-turn').waitFor();
  await advanceCompanion(page,5000);
  assert.equal((await read()).memory.entries.length,0);
  assert.equal(await page.evaluate(()=>window.companionState.active.phase),'await');
  await page.locator('#companion-respond').focus();await page.keyboard.press('Enter');
  await finishActivity(page);
  await page.waitForFunction(()=>document.querySelector('#companion-feedback').textContent.includes('记住'));
  assert.equal((await read()).memory.entries.length,1);
  const feedback=await page.locator('#companion-feedback').evaluate(e=>({width:e.getBoundingClientRect().width,overflow:getComputedStyle(e).overflowY}));
  assert.ok(feedback.width<=252);assert.equal(feedback.overflow,'visible');
  await menu(page);await page.locator('#companion-play').click();
  assert.match(await page.locator('#companion-turn-hint').innerText(),/上次一起玩/);
  await page.locator('#companion-cancel').click();
  assert.equal((await read()).memory.entries.length,1);
  for(const locale of ['zh','en']) for(const textScale of [1,1.25,1.5]) {
    await page.setViewportSize({width:320,height:640});await configure({locale,textScale});
    await menu(page);await page.locator('#companion-play').click();await page.locator('#companion-turn').waitFor();
    await page.waitForFunction(()=>{const r=document.querySelector('#companion-turn').getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    const geometry=await page.locator('#companion-turn').evaluate(e=>({overflow:getComputedStyle(e).overflowY,noX:e.scrollWidth<=e.clientWidth+1}));
    assert.equal(geometry.overflow,'visible');assert.ok(geometry.noX);
    if(process.env.COMPANION_EVIDENCE_DIR) {await mkdir(process.env.COMPANION_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.COMPANION_EVIDENCE_DIR,`turn-${locale}-${textScale}.png`)});}
    await page.keyboard.press('Escape');assert.equal(await page.locator('#companion-turn').isVisible(),false);
  }
});

test('waiting expires without growth and an in-flight save cannot promise success or revive after work', async t => {
  const {page,read,receive}=await fixture(t,'quiet');
  await menu(page);await page.locator('#companion-play').click();await advanceCompanion(page,20001);
  assert.equal(await page.locator('#companion-turn').isVisible(),false);assert.equal((await read()).memory.entries.length,0);
  let release;const gate=new Promise(r=>{release=r;});let requested=false;
  await page.route('**/api/companionship',async route=>{if(route.request().postDataJSON().type==='play'){requested=true;await gate;}await route.continue();});
  await menu(page);await page.locator('#companion-play').click();await finishActivity(page);
  await page.waitForFunction(()=>document.querySelector('#pet').dataset.companionActivity==='idle');
  assert.equal(requested,true);assert.doesNotMatch(await page.locator('#companion-feedback').innerText(),/记住/);
  assert.equal((await read()).memory.entries.length,0);
  await receive({type:'snapshot',snapshot:snapshot({mood:'working',active:true,sessions:[{...session,mood:'working',active:true}]})});
  release();await page.waitForFunction(()=>document.querySelector('#companion-status').textContent.includes('记得上次一起活动'));
  assert.equal(await page.locator('#companion-feedback').isVisible(),false);assert.equal((await read()).memory.entries.length,1);
  await receive({type:'snapshot',snapshot:snapshot()});
  await page.unroute('**/api/companionship');
  await page.route('**/api/companionship',async route=>{if(route.request().postDataJSON().type==='play')await route.fulfill({status:503,json:{ok:false,error:'companion/write-failed'}});else await route.continue();});
  await menu(page);await page.locator('#companion-play').click();await finishActivity(page);
  await page.waitForFunction(()=>document.querySelector('#companion-feedback').textContent.includes('没能保存'));
  assert.equal((await read()).memory.entries.length,1);
});


test('remembered play changes the next permitted greeting without another interaction or model call', async t => {
  const { page, read, body } = await fixture(t, 'interactive', ['neutral', 'stand', 'wave', 'happy', 'nod']);
  await menu(page); await page.locator('#companion-play').click(); await page.mouse.move(0, 0); await finishActivity(page);
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('记得上次一起活动'));
  const before = await read();
  await body.evaluate(() => { window.bodyOrders = []; });
  await advanceCompanion(page, await page.evaluate(() => window.companionState.inviteAt));
  await page.locator('#companion-invitation').waitFor();
  await advanceCompanion(page, await page.evaluate(() => window.companionState.active.dueAt + 1));
  await body.waitForFunction(() => window.bodyOrders.some(order => order.t === 'do' && order.word === 'nod'));
  assert.ok(await body.evaluate(() => window.bodyOrders.some(order => order.t === 'do' && order.word === 'nod')));
  const after = await read(); assert.deepEqual(after.relation, before.relation); assert.deepEqual(after.memory.entries, before.memory.entries);
  assert.equal(after.invitation.remaining, before.invitation.remaining - 1);
  assert.deepEqual(await page.evaluate(() => window.actions.filter(a => a.type !== 'presentation')), []);
});
