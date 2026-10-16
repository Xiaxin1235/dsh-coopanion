import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
try {
  app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', join(packageRoot, 'desktop/main.cjs')], env: { ...process.env, DSH_PET_TEST_DATA_DIR: root, DSH_PET_TEST_DIAGNOSTICS_DIR: join(root, 'diagnostics'), DSH_PET_TEST_NO_SANDBOX: '1' } });
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const send = value => app.evaluate((_, value) => process.emit('message', value), value);
  const options = { size: 180, roam: true, companionship: 'quiet', diagnostics: true, npcHome: .85, npcRange: .3, notifications: false, bubbleDurationMs: 12000 };
  await send({ type: 'init', baseline: true, options, snapshot: { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] } });
  await page.waitForSelector('#pet[data-mode]'); await parkNativePointer(page);
  let endpoint;
  for (let i = 0; i < 50; i++) { [endpoint] = await listDiagnostics(join(root, 'diagnostics')); if (endpoint) break; await new Promise(r => setTimeout(r, 100)); }
  let actual;
  for (let i = 0; i < 30; i++) { actual = await readDiagnostics(endpoint); if (actual.value.renderer.npc.keyboardStatus !== 'starting') break; await new Promise(r => setTimeout(r, 500)); }
  if (process.platform === 'darwin') { assert.equal(actual.value.renderer.npc.keyboardBackend, 'macos'); assert.equal(actual.value.renderer.npc.keyboardStatus, 'available'); }
  assert.ok(['active', 'idle', 'unknown'].includes(actual.value.renderer.npc.keyboard));
  // Perception-only controls from here; native IPC, sandbox, body physics and rendering are real.
  await controlNpc(page); await page.reload(); await page.waitForSelector('#pet[data-mode][data-display-revision]'); await parkNativePointer(page);
  await npcUntil(page, 'outbound');
  const target = await page.evaluate(() => window.npcState.target), id = await page.evaluate(() => window.npcState.walkId);
  await page.evaluate(() => { window.npcKeyboard = 'active'; }); await npcTick(page);
  await page.waitForFunction(() => document.querySelector('#pet').dataset.mode !== 'walk');
  assert.equal(await page.evaluate(() => window.npcState.target), target);
  assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  await page.evaluate(() => { window.npcKeyboard = 'idle'; }); await npcTick(page); await npcTick(page, 5000);
  assert.equal(await page.evaluate(() => window.npcState.walkId), null);
  await npcUntil(page, 'outbound'); assert.ok(await page.evaluate(id => window.npcState.walkId > id, id));
  await page.waitForFunction(() => window.npcState.phase === 'observe', null, { timeout: 25000 });
  await npcUntil(page, 'return'); await page.waitForFunction(() => window.npcState.phase === 'home', null, { timeout: 25000 });
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
} catch (error) { console.error('NPC native state:', JSON.stringify(await page?.evaluate(() => ({ state: window.npcState, input: window.npcInput, events: window.npcEvents?.slice(-8), trace: window.npcTrace, mode: document.querySelector('#pet').dataset.mode })).catch(() => null))); throw error; } finally { await app?.close(); await rm(root, { recursive: true, force: true }); }
