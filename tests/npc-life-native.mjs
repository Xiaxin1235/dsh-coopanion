import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { parkNativePointer } from './helpers/native-pointer.mjs';
import { controlNpc, npcTick, npcUntil } from './helpers/npc-life.mjs';
import { listDiagnostics, readDiagnostics } from '../scripts/diagnostics-client.mjs';
const require = createRequire(import.meta.url), root = await mkdtemp(join(tmpdir(), 'dsh-npc-native-'));
const packageRoot = resolve(process.env.DSH_NPC_PACKAGE_ROOT ?? '.');
let app, page;
let debugStage = 'launch', debugStageAt = Date.now();
const debugAt = Date.now();
const debugStageMark = stage => { debugStage = stage; debugStageAt = Date.now(); console.log('[DEBUG-npc-stage-20261017]', stage, Date.now() - debugAt, process.env.DSH_PET_TEST_DEBUG_PORT); };
const debugWatch = setInterval(async () => {
  if (Date.now() - debugStageAt > 45000) {
    console.error('[DEBUG-npc-stage-20261017] STALLED', debugStage, Date.now() - debugStageAt);
    process.exit(86);
  }
  let displayPower;
  try { displayPower = execFileSync('/usr/sbin/ioreg',['-r','-n','IODisplayWrangler','-d','1'],{encoding:'utf8',timeout:1500}).split('\n').filter(line=>line.includes('IOPowerManagement')); } catch(error) { displayPower=error.message; }
  console.log('[DEBUG-npc-stage-20261017] power', JSON.stringify(displayPower));
  const native = await app?.evaluate(({ app, BrowserWindow }) => ({ hidden: app.isHidden?.(), windows: BrowserWindow.getAllWindows().map(w => ({ visible: w.isVisible(), focused: w.isFocused(), minimized: w.isMinimized(), bounds: w.getBounds() })) })).catch(error => ({ error: error.message }));
  const renderer = page ? await Promise.race([
    page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, raf: window.__debugNpcRaf, npc: window.npcState, input: window.npcInput, mode: document.querySelector('#pet')?.dataset.mode })).catch(error => ({ error: error.message })),
    new Promise(resolve => setTimeout(() => resolve({ pending: true }), 1000)),
  ]) : null;
  console.log('[DEBUG-npc-stage-20261017]', JSON.stringify({ stage: debugStage, ms: Date.now() - debugAt, native, renderer }));
}, 5000);
debugWatch.unref();
try {
  debugStageMark('launch');
  app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', join(packageRoot, 'desktop/main.cjs')], env: { ...process.env, DSH_PET_TEST_DATA_DIR: root, DSH_PET_TEST_DIAGNOSTICS_DIR: join(root, 'diagnostics'), DSH_PET_TEST_NO_SANDBOX: '1' } });
  debugStageMark('first-window');
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.addInitScript(() => { window.__debugNpcRaf = 0; const count = () => { window.__debugNpcRaf++; requestAnimationFrame(count); }; requestAnimationFrame(count); });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const send = value => app.evaluate((_, value) => process.emit('message', value), value);
  const options = { size: 180, roam: true, companionship: 'quiet', diagnostics: true, npcHome: .85, npcRange: .3, notifications: false, bubbleDurationMs: 12000 };
  debugStageMark('init');
  await send({ type: 'init', baseline: true, options, snapshot: { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] } });
  await page.waitForSelector('#pet[data-mode]'); await parkNativePointer(page);
  debugStageMark('diagnostics');
  let endpoint;
  for (let i = 0; i < 50; i++) { [endpoint] = await listDiagnostics(join(root, 'diagnostics')); if (endpoint) break; await new Promise(r => setTimeout(r, 100)); }
  let actual;
  for (let i = 0; i < 30; i++) { actual = await readDiagnostics(endpoint); if (actual.value.renderer.npc.keyboardStatus !== 'starting') break; await new Promise(r => setTimeout(r, 500)); }
  if (process.platform === 'darwin') { assert.equal(actual.value.renderer.npc.keyboardBackend, 'macos'); assert.equal(actual.value.renderer.npc.keyboardStatus, 'available'); }
  assert.ok(['active', 'idle', 'unknown'].includes(actual.value.renderer.npc.keyboard));
  // Perception-only controls from here; native IPC, sandbox, body physics and rendering are real.
  debugStageMark('control-and-reload');
  await controlNpc(page); await page.reload();
  debugStageMark('reload-ready');
  await page.waitForSelector('#pet[data-mode][data-display-revision]'); await parkNativePointer(page);
  debugStageMark('outbound');
  await npcUntil(page, 'outbound');
  debugStageMark('interrupt');
  const target = await page.evaluate(() => window.npcState.target), id = await page.evaluate(() => window.npcState.walkId);
  await page.evaluate(() => { window.npcKeyboard = 'active'; }); await npcTick(page);
  await page.waitForFunction(() => document.querySelector('#pet').dataset.mode !== 'walk');
  assert.equal(await page.evaluate(() => window.npcState.target), target);
  assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  await page.evaluate(() => { window.npcKeyboard = 'idle'; }); await npcTick(page); await npcTick(page, 5000);
  assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  debugStageMark('resume');
  await npcUntil(page, 'outbound'); assert.ok(await page.evaluate(id => window.npcState.walkId > id, id));
  debugStageMark('observe');
  await page.waitForFunction(() => window.npcState.phase === 'observe', null, { timeout: 25000 });
  debugStageMark('return');
  await npcUntil(page, 'return'); await page.waitForFunction(() => window.npcState.phase === 'home', null, { timeout: 25000 });
  debugStageMark('home');
  await page.screenshot({ path: 'artifacts/npc-life-native-home.png' });
  await send({ type: 'configure', options: { ...options, npcHome: .15, npcRange: .2 } });
  await npcTick(page); assert.equal(await page.evaluate(() => window.npcInput.space.key.includes(':0.15:0.2')), true);
  const runtime = { phase: 'running', visible: false, suspended: false, generation: 1, visibilityRevision: 1 };
  await send({ type: 'notification-state', snapshot: { protocol: 1, runtime, interactions: [] } }); await npcTick(page);
  assert.equal(await page.evaluate(() => window.npcState.reason), 'lifecycle');
  assert.equal(await page.locator('#npc-home').isVisible(), false);
  assert.equal(await page.locator('#body-layer iframe').contentFrame().locator('body').evaluate(() => typeof window.dshPetBridge), 'undefined');
  assert.deepEqual(errors, []);
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/npc-life-native.json', JSON.stringify({ build: JSON.parse(await readFile(join(packageRoot, 'dist/build-info.json'), 'utf8')), electron: await app.evaluate(() => process.versions.electron), platform: process.platform, arch: process.arch, actualKeyboard: actual.value.renderer.npc.keyboard, keyboardBackend: actual.value.renderer.npc.keyboardBackend, keyboardStatus: actual.value.renderer.npc.keyboardStatus, controlledPerceptionForMovement: true, realNativeWalkArrivalReturn: true, interruptionRetainsTarget: true, stableRecovery: true, hotRelativeSettings: true, lifecyclePause: true, sandboxIsolated: true, physicalTypingValidated: false }, null, 2) + '\n');
  console.log('NPC isolated native cycle, interruption, arrival, return, relative settings and diagnostics passed.');
} catch (error) { console.error('NPC native state:', JSON.stringify(await page?.evaluate(() => ({ state: window.npcState, input: window.npcInput, events: window.npcEvents?.slice(-8), trace: window.npcTrace, mode: document.querySelector('#pet').dataset.mode })).catch(() => null))); throw error; } finally { debugStageMark('close'); clearInterval(debugWatch); await app?.close(); await rm(root, { recursive: true, force: true }); debugStageMark('done'); }
