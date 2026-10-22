import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { _electron } from '../scripts/lib/playwright.mjs';
import { petClick, nativeClick, parkNativePointer } from './helpers/native-pointer.mjs';

const require = createRequire(import.meta.url), directory = await mkdtemp(join(tmpdir(), 'dsh-response-native-'));
const output = process.env.COMPANION_EVIDENCE_DIR ?? 'artifacts';
let app;
const idle = { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] };
const options = { size: 180, roam: true, companionship: 'quiet', locale: 'zh', notifications: true };
const sourceFiles = ['web/response-rhythm.js', 'web/pet.js', 'web/locale.js', 'desktop/main.cjs', 'src/companion-store.ts', 'tests/response-rhythm-native.mjs'];
const sourceHashes = () => Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])).then(Object.fromEntries);
const sources = await sourceHashes();
try {
  await mkdir(output, { recursive: true });
  app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', resolve('desktop/main.cjs')], env: { ...process.env, DSH_PET_TEST_DATA_DIR: directory, DSH_PET_TEST_NO_SANDBOX: '1', DSH_PET_TEST_DEBUG_PORT: '0' } });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const send = message => app.evaluate((_, message) => process.emit('message', message), message);
  await page.waitForSelector('#pet[data-mode]');
  await send({ type: 'init', baseline: true, options, snapshot: idle });
  await app.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); const window = BrowserWindow.getAllWindows()[0]; window.show(); window.focus(); });
  await page.waitForSelector('#pet[data-mode=idle]');
  await page.evaluate(() => {
    window.nativeResponses = 0; window.nativeStrokes = 0;
    new MutationObserver(records => { if (records.some(record => record.type === 'childList')) {
      const kind = document.querySelector('#companion-feedback').dataset.kind;
      if (kind === 'response') window.nativeResponses++;
      if (kind === 'stroke') window.nativeStrokes++;
    } }).observe(document.querySelector('#companion-feedback'), { childList: true });
  });
  const read = () => page.evaluate(() => window.dshPetBridge.companionship({ type: 'read', characterId: 'whale' }));
  async function stroke(expected) {
    await petClick(page, { button: 'right' }); await page.keyboard.press('Escape');
    await page.waitForSelector('#pet[data-mode=idle]');
    const b = await page.locator('#pet').boundingBox();
    for (let i = 0; i < 20; i++) await page.mouse.move(b.x + b.width * (i % 2 ? .3 : .7), b.y + b.height * .45);
    await page.waitForFunction(expected => window.nativeStrokes === expected, expected);
  }
  await stroke(1); await page.waitForTimeout(2550); await stroke(2);
  assert.equal(await page.evaluate(() => window.nativeResponses), 0);
  await parkNativePointer(page);
  await page.locator('#companion-feedback[data-kind=response]').waitFor();
  assert.match(await page.locator('#companion-feedback').innerText(), /保存好/);
  assert.equal(await page.evaluate(() => window.nativeResponses), 1);
  assert.equal((await read()).memory.entries.length, 2);
  assert.equal((await read()).relation.total, 1);
  await page.screenshot({ path: join(output, 'response-native.png') });
  await stroke(3);
  await send({ type: 'snapshot', snapshot: { ...idle, mood: 'working', active: true, sessionId: 'work', sessions: [{ id: 'work', mood: 'working', active: true }] } });
  await page.locator('#companion-feedback').waitFor({ state: 'hidden' });
  await page.waitForTimeout(20500);
  await send({ type: 'snapshot', snapshot: idle }); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.nativeResponses), 1);
  await stroke(4); await petClick(page, { button: 'right' }); await nativeClick(page, '#companion-play');
  await page.locator('#companion-turn').waitFor(); await nativeClick(page, '#companion-respond');
  await parkNativePointer(page);
  await page.waitForFunction(() => document.querySelector('#companion-feedback').textContent.includes('记住'));
  assert.equal(await page.evaluate(() => window.nativeResponses), 1);
  assert.equal((await read()).memory.entries.filter(entry => entry.kind === 'play').length, 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(await sourceHashes(), sources, 'tested sources stay unchanged for the whole native run');
  await writeFile(join(output, 'response-rhythm-native.json'), JSON.stringify({ sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sources, platform: process.platform, arch: process.arch, electron: require('electron/package.json').version, realClock: true, nativeIpc: true, trustedPointerInput: true, mergedSources: 2, responses: 1, expiredWorkDoesNotReplay: true, manualResponsePriority: true, physicalKeyboardAcceptance: false }, null, 2) + '\n');
  console.log('Native stroke batching, real-clock expiry, IPC persistence and manual priority passed.');
} finally { await app?.close(); await rm(directory, { recursive: true, force: true }); }
