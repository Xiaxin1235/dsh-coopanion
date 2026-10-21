import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { petClick, nativeClick } from './helpers/native-pointer.mjs';
const require = createRequire(import.meta.url), directory = await mkdtemp(join(tmpdir(), 'dsh-p1-native-'));
let app;
const snapshot = { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] };
const options = { size: 180, roam: true, companionship: 'interactive', notifications: true, locale: 'zh', bubbleDurationMs: 12000 };
async function launch() {
  app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', resolve('desktop/main.cjs')], env: { ...process.env, DSH_PET_TEST_DATA_DIR: directory, DSH_PET_TEST_NO_SANDBOX: '1', DSH_PET_TEST_DEBUG_PORT: '0' } });
  const page = await app.firstWindow(); await page.waitForSelector('#pet[data-mode]');
  const send = message => app.evaluate((_, value) => process.emit('message', value), message);
  await send({ type: 'init', baseline: true, options, snapshot }); await page.waitForSelector('#pet[data-host-ready=true][data-mode]'); await page.mouse.move(0, 0);
  await page.waitForSelector('#pet[data-mode=idle]');
  await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
  return { page, send };
}
try {
  let { page, send } = await launch();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  assert.equal(await page.evaluate(() => typeof window.dshPetBridge.companionship), 'function');
  assert.equal(await page.locator('#body-layer iframe').contentFrame().locator('body').evaluate(() => typeof window.dshPetBridge), 'undefined');
  await petClick(page, { button: 'right' }); await nativeClick(page, '#companion-play');
  await page.locator('#companion-turn').waitFor();
  if (process.env.COMPANION_EVIDENCE_DIR) {await mkdir(process.env.COMPANION_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.COMPANION_EVIDENCE_DIR,'turn-native.png')});}
  await nativeClick(page, '#companion-respond'); await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  await page.waitForFunction(() => document.querySelector('#companion-feedback').textContent.includes('记住') && !document.querySelector('#companion-feedback').hidden);
  assert.equal(await page.locator('#companion-feedback').evaluate(e=>getComputedStyle(e).overflowY),'visible');
  if (process.env.COMPANION_EVIDENCE_DIR) await page.screenshot({path:join(process.env.COMPANION_EVIDENCE_DIR,'memory-receipt-native.png')});
  const saved = JSON.parse(await readFile(join(directory, 'companionship-v1/state.json'), 'utf8')); assert.equal(saved.characters.whale.total, 1); assert.equal(saved.memories.whale.entries[0].kind, 'play');
  await send({ type: 'snapshot', snapshot: { ...snapshot, sessionId: 'native-chat', sessions: [{ id: 'native-chat', mood: 'idle', active: false, chatAvailable: true, label: 'Native chat' }] } });
  await petClick(page, {}, true); await page.locator('#message').fill('P1 native draft'); await page.locator('#message').evaluate(n => n.setSelectionRange(2, 6));
  for (const companionship of ['off', 'quiet', 'interactive']) await send({ type: 'configure', options: { ...options, companionship } });
  assert.deepEqual(await page.locator('#message').evaluate(n => [n.value, n === document.activeElement, n.selectionStart, n.selectionEnd]), ['P1 native draft', true, 2, 6]);
  const reply = { id: 'native-captured', sessionId: 'native-chat', time: 1, read: false, text: '## Native captured reader\n\n' + 'Keep the captured content and scroll.\n\n'.repeat(70) };
  await send({ type: 'snapshot', snapshot: { ...snapshot, sessionId: 'native-chat', sessions: [{ id: 'native-chat', mood: 'idle', active: false, chatAvailable: true, label: 'Native chat', replyId: reply.id, reply: reply.text }], results: [reply] } });
  await page.locator('#chat-read').click();
  await page.locator('#reader-text').evaluate(n => { n.scrollTop = 120; window.npcNativeReader = n.firstChild; });
  for (const companionship of ['off', 'quiet', 'interactive']) await send({ type: 'configure', options: { ...options, companionship } });
  assert.equal(await page.locator('#reader-text').evaluate(n => n.firstChild === window.npcNativeReader && n.scrollTop === 120), true);
  await app.close(); app = undefined;
  ({ page, send } = await launch());
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  const summary = await page.evaluate(() => window.dshPetBridge.companionship({ type: 'read', characterId: 'whale' })); assert.equal(summary.relation.total, 1); assert.equal(summary.writable, true);
  assert.equal(summary.memory.entries[0].kind, 'play');
  await petClick(page, { button: 'right' }); await nativeClick(page, '#companion-memories summary');
  await page.locator('#memory-list li').waitFor();
  await nativeClick(page, '#memory-list button[data-memory-action="memory-correct"]');
  await page.waitForFunction(() => document.querySelector('#memory-list').textContent.includes('已纠正'));
  const memoryOutput = process.env.COMPANION_EVIDENCE_DIR;
  if (memoryOutput) { await mkdir(memoryOutput, { recursive: true }); await page.screenshot({ path: join(memoryOutput, 'memory-native-corrected.png') }); }
  await nativeClick(page, '#memory-list button[data-memory-action="memory-delete"]');
  await page.waitForFunction(() => document.querySelector('#memory-status').textContent.includes('还没有'));
  const deleted = await page.evaluate(() => window.dshPetBridge.companionship({ type: 'read', characterId: 'whale' }));
  assert.equal(deleted.memory.entries.length, 0); assert.equal(deleted.relation.total, 1);
  await page.keyboard.press('Escape');
  await send({ type: 'snapshot', snapshot: { ...snapshot, mood: 'working', active: true, sessionId: 'native-work', sessions: [{ id: 'native-work', mood: 'working', active: true }] } });
  await page.waitForSelector('#pet[data-mood=working]'); assert.equal(await page.locator('#companion-invitation').isVisible(), false); assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'working');
  assert.deepEqual(errors, []);
  await writeFile(process.env.COMPANION_EVIDENCE_DIR ? join(process.env.COMPANION_EVIDENCE_DIR, 'companionship-native.json') : 'artifacts/companionship-native.json', JSON.stringify({ sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sources: Object.fromEntries(await Promise.all(['desktop/main.cjs', 'web/pet.js', 'web/companionship.js', 'src/companion-store.ts'].map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]))), platform: process.platform, arch: process.arch, nativeIpc: true, memoryRestoreCorrectDelete: true, realInputPlay: true, durableRelationship: summary.relation, noSessionRequired: true, hotDraftSelection: true, hotCapturedReaderAndScroll: true, taskPreemption: true, sandboxUnchanged: true }, null, 2) + '\n');
  console.log('P1 native companion play, durable progress, recovery, settings and task precedence passed.');
} finally { await app?.close(); await rm(directory, { recursive: true, force: true }); }
