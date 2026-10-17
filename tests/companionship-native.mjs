import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { petClick, nativeClick } from './helpers/native-pointer.mjs';
const require = createRequire(import.meta.url), directory = await mkdtemp(join(tmpdir(), 'dsh-p1-native-'));
let app;
const snapshot = { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] };
const options = { size: 180, roam: true, companionship: 'interactive', dailyRhythm: false, notifications: true, locale: 'zh', bubbleDurationMs: 12000 };
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
  await petClick(page, { button: 'right' }); await nativeClick(page, '#companion-play'); await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  const saved = JSON.parse(await readFile(join(directory, 'companionship-v1/state.json'), 'utf8')); assert.equal(saved.characters.whale.total, 1);
  await send({ type: 'snapshot', snapshot: { ...snapshot, sessionId: 'native-chat', sessions: [{ id: 'native-chat', mood: 'idle', active: false, chatAvailable: true, label: 'Native chat' }] } });
  await petClick(page, {}, true); await page.locator('#message').fill('P1 native draft'); await page.locator('#message').evaluate(n => n.setSelectionRange(2, 6));
  for (const companionship of ['off', 'quiet', 'interactive']) await send({ type: 'configure', options: { ...options, companionship } });
  assert.deepEqual(await page.locator('#message').evaluate(n => [n.value, n === document.activeElement, n.selectionStart, n.selectionEnd]), ['P1 native draft', true, 2, 6]);
  await app.close(); app = undefined;
  ({ page, send } = await launch());
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('1'));
  const summary = await page.evaluate(() => window.dshPetBridge.companionship({ type: 'read', characterId: 'whale' })); assert.equal(summary.relation.total, 1); assert.equal(summary.writable, true);
  await send({ type: 'snapshot', snapshot: { ...snapshot, mood: 'working', active: true, sessionId: 'native-work', sessions: [{ id: 'native-work', mood: 'working', active: true }] } });
  await page.waitForSelector('#pet[data-mood=working]'); assert.equal(await page.locator('#companion-invitation').isVisible(), false); assert.equal(await page.locator('#pet').getAttribute('data-mood'), 'working');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/companionship-native.json', JSON.stringify({ sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sources: Object.fromEntries(await Promise.all(['desktop/main.cjs', 'web/pet.js', 'web/companionship.js', 'src/companion-store.ts'].map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]))), platform: process.platform, arch: process.arch, nativeIpc: true, realInputPlay: true, durableRelationship: summary.relation, noSessionRequired: true, hotDraftSelection: true, taskPreemption: true, sandboxUnchanged: true }, null, 2) + '\n');
  console.log('P1 native companion play, durable progress, recovery, settings and task precedence passed.');
} finally {
  const closingAt = Date.now(), child = app?.process();
  console.log('[DEBUG-p1-close-20261017] closing', child?.pid);
  const watch = setInterval(() => {
    console.log('[DEBUG-p1-close-20261017]', JSON.stringify({ms:Date.now()-closingAt,pid:child?.pid,exitCode:child?.exitCode,signalCode:child?.signalCode,stdoutEnded:child?.stdout?.readableEnded,stderrEnded:child?.stderr?.readableEnded}));
    if (Date.now()-closingAt>45000) process.exit(87);
  },5000);
  try { await app?.close(); console.log('[DEBUG-p1-close-20261017] closed'); await rm(directory, { recursive: true, force: true }); console.log('[DEBUG-p1-close-20261017] removed'); }
  finally { clearInterval(watch); }
}
