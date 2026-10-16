/** Isolated Linux observation of a fixed package loaded by the published DSH host.
 * This observer is external to the package. CDP instrumentation is test-only.
 */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, copyFile, open } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { linuxSnapshot, linuxEnvironment, processCpu, summarizeObservation } from './resource-observation.mjs';

const { values: args } = parseArgs({ options: Object.fromEntries(
  ['runtime', 'package', 'output', 'source-commit', 'version', 'seconds', 'interval', 'window', 'warmup'].map(key => [key, { type: 'string' }])
) });
assert.equal(process.platform, 'linux', 'This observer currently supports Linux /proc only');
for (const name of ['runtime', 'package', 'output', 'source-commit']) assert.ok(args[name], '--' + name + ' is required');
assert.match(args['source-commit'], /^[a-f0-9]{40}$/);
assert.ok(process.env.DISPLAY, 'Start an isolated Xvfb and window manager first');
const runtime = resolve(args.runtime), archivePath = resolve(args.package), output = resolve(args.output);
const version = args.version ?? '0.2.0-rc.2';
assert.ok(['0.2.0-rc.2', '0.2.1-alpha.1'].includes(version));
const seconds = Number(args.seconds ?? 7200), interval = Number(args.interval ?? 5);
const windowSeconds = Number(args.window ?? 1800), warmup = Number(args.warmup ?? 20);
assert.ok(Number.isFinite(seconds) && seconds >= windowSeconds * 2 && windowSeconds >= 10);
assert.ok(Number.isFinite(interval) && interval >= 1 && interval <= 10 && Number.isFinite(warmup) && warmup >= 20);
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Never overwrite an earlier observation, including a failed one.
const work = join(output, 'work');
await mkdir(work);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archiveSha256 = hash(await readFile(archivePath));
await copyFile(archivePath, join(output, 'candidate.tgz'));
const collectorHashes = Object.fromEntries(await Promise.all(['observe-companion.mjs', 'resource-observation.mjs', 'run-resource-observation.sh'].map(async name => {
  const path = fileURLToPath(new URL('./' + name, import.meta.url)); return [name, hash(await readFile(path))];
})));
const ticksPerSecond = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
const profileName = 'p1-observation', home = join(work, 'dsh'), profile = join(home, 'profiles', profileName);
const petData = join(work, 'pet');
const environment = { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1',
  PATH: fileURLToPath(new URL('../node_modules/.bin/', import.meta.url)) + ':' + process.env.PATH,
  electron_config_cache: process.env.electron_config_cache ?? join(homedir(), '.cache', 'electron'),
  DSH_PET_TEST_DATA_DIR: petData, DSH_PET_TEST_NO_SANDBOX: '1',
  XDG_CONFIG_HOME: join(work, 'config'), XDG_CACHE_HOME: join(work, 'cache'),
  XDG_DATA_HOME: join(work, 'data'), XDG_STATE_HOME: join(work, 'state'),
};
let host, browser, session, logFile, rawFile, interrupted = false, complete = false, hostFailure;
const pageErrors = [], samples = [];
const rememberError = error => { if (pageErrors.length < 64) pageErrors.push(String(error).slice(0, 1000)); };
let pageErrorCount = 0;
const stopSignal = () => { interrupted = true; };
process.on('SIGTERM', stopSignal); process.on('SIGINT', stopSignal);
const log = async entry => {
  const text = JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n';
  process.stdout.write(text); await logFile?.write(text);
};
async function command(commandArgs, label, timeoutMs = 300000) {
  const file = await open(join(output, label + '.log'), 'wx');
  const child = spawn(process.execPath, commandArgs, { cwd: work, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  // A single file handle serializes stdout/stderr writes without holding output in memory.
  let writes = Promise.resolve();
  const append = chunk => { writes = writes.then(() => file.write(chunk)); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  try { const [code, signal] = await once(child, 'exit'); await writes; assert.equal(code, 0, label + ' failed (' + signal + '), see its log'); }
  finally { clearTimeout(timer); await file.close(); }
}
async function stopHost() {
  if (!host) return;
  const killGroup = signal => { try { process.kill(-host.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  if (host.exitCode !== null || host.signalCode !== null) { killGroup('SIGKILL'); return; }
  const ended = once(host, 'exit');
  if (host.connected) host.send({ type: 'shutdown-observation' }, () => {});
  else host.kill('SIGTERM');
  const killTimer = setTimeout(() => killGroup('SIGKILL'), 10000);
  try { await ended; } finally { clearTimeout(killTimer); killGroup('SIGKILL'); }
}
async function archiveStats(label) {
  const path = join(petData, 'companionship-v1', 'state.json');
  try {
    const raw = await readFile(path), data = JSON.parse(raw);
    if (label) await writeFile(join(output, 'archive-' + label + '.json'), raw, { flag: 'wx' });
    return { exists: true, bytes: raw.length, sha256: hash(raw), revision: data.revision, recentCount: data.recent.length,
      characterCount: Object.keys(data.characters).length, invitations: data.invitations, relation: data.characters.whale ?? null };
  } catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
}
try {
  logFile = await open(join(output, 'events.ndjson'), 'wx');
  rawFile = await open(join(output, 'samples.ndjson'), 'wx');
  const cli = join(runtime, 'node_modules', '@deepseek-ai/dsh/lib/bin.js');
  const hostManifest = JSON.parse(await readFile(join(runtime, 'node_modules', '@deepseek-ai/dsh/package.json'), 'utf8'));
  assert.equal(hostManifest.version, version);
  await mkdir(profile, { recursive: true });
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'p1-observation-profile', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } } }));
  await writeFile(join(profile, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n');
  await command([cli, 'plugin', '--profile', profileName, 'add', archivePath], 'plugin-install', 600000);
  const installed = join(profile, 'node_modules', '@takboo/dsh-coopanion');
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  const electronPackage = join(profile, 'node_modules', 'electron');
  assert.equal(JSON.parse(await readFile(join(electronPackage, 'package.json'), 'utf8')).version, manifest.dependencies.electron);
  await command([join(electronPackage, 'install.js')], 'electron-prepare');
  const nativeExecutable = join(electronPackage, 'dist', 'electron');
  assert.equal(execFileSync(nativeExecutable, ['--no-sandbox', '--version'], { env: environment, encoding: 'utf8', timeout: 10000 }).trim(), 'v' + manifest.dependencies.electron, 'Installed Electron dependencies must be ready before Host startup');
  const sourcePaths = ['desktop/main.cjs', 'desktop/preload.cjs', 'web/pet.js', 'web/companionship.js', 'web/companion-client.js', 'web/companion-touch.js', 'src/companion-store.ts', 'web/upstream/kit/body.js'];
  const installedSources = Object.fromEntries(await Promise.all(sourcePaths.map(async name => [name, hash(await readFile(join(installed, name)))])));
  const observer = join(work, 'observer');
  await mkdir(observer);
  await writeFile(join(observer, 'package.json'), JSON.stringify({ name: 'p1-resource-observer', private: true, type: 'module' }));
  await writeFile(join(observer, 'host.mjs'), [
    "export const inject = ['appReady', 'appExit', 'settings'];",
    'export function apply(ctx) {',
    "ctx.effect(() => { const onMessage = value => { if (value?.type === 'shutdown-observation') ctx.appExit(0); }; process.on('message', onMessage); return () => process.off('message', onMessage); });",
    'ctx.effect(() => ctx.appReady.onReady(async () => {',
    "const fibers = [...ctx.registry.values()].flatMap(runtime => [...runtime.fibers]).filter(fiber => fiber.parent.fiber.runtime?.name === 'dsh-coopanion');",
    'const errors = []; for (const fiber of fibers) { try { await fiber.await(); } catch (error) { errors.push(String(error)); } }',
    "process.send?.({ type: 'observation-ready', errors, settings: ctx.settings.describe().find(entry => entry.ns === 'dsh-coopanion')?.value });",
    '})); }',
  ].join('\n'));
  await writeFile(join(profile, 'cordis.patch.yml'), '- insert:\n    - id: observation\n      name: ' + JSON.stringify(join(observer, 'host.mjs')) +
    '\n- id: ui-settings-models\n  config:\n    credentialOnboarding: false\n- id: dsh-coopanion\n  config:\n    autoStart: true\n    size: 180\n    roam: true\n    companionship: interactive\n    dailyRhythm: false\n    notifications: true\n');
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  environment.DSH_PET_TEST_DEBUG_PORT = String(listener.address().port); await new Promise(r => listener.close(r));
  const hostOut = await open(join(output, 'host.log'), 'wx');
  let hostWrites = Promise.resolve();
  host = spawn(process.execPath, [cli, '--profile', profileName, '--no-open', '--port', '0'], { cwd: work, env: environment, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const appendHost = chunk => { hostWrites = hostWrites.then(() => hostOut.write(chunk)); };
  host.stdout.on('data', appendHost); host.stderr.on('data', appendHost);
  host.once('exit', (code, signal) => { if (!complete && !interrupted) hostFailure = 'Host exited: ' + (signal ?? code); });
  host.once('exit', () => { void hostWrites.then(() => hostOut.close()); });
  const ready = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => finish(new Error('Host startup timed out')), 120000);
    const receive = value => { if (value?.type === 'observation-ready') finish(null, value); };
    const exited = (code, signal) => finish(new Error('Host startup exited: ' + (signal ?? code)));
    const error = err => finish(err);
    function finish(failure, value) { clearTimeout(timer); host.off('message', receive); host.off('exit', exited); host.off('error', error); failure ? reject(failure) : resolveReady(value); }
    host.on('message', receive); host.once('exit', exited); host.once('error', error);
  });
  assert.deepEqual(ready.errors, []);
  assert.equal(ready.settings.companionship, 'interactive');
  // Host readiness precedes asynchronous Electron preparation and startup.
  let nativeReady = false;
  for (let attempt = 0; attempt < 1200 && !interrupted; attempt++) {
    if (hostFailure) throw new Error(hostFailure);
    const endpoint = await fetch('http://127.0.0.1:' + environment.DSH_PET_TEST_DEBUG_PORT + '/json/version', { signal: AbortSignal.timeout(1000) }).then(response => response.ok ? response.json() : null, () => null);
    if (endpoint?.webSocketDebuggerUrl) { nativeReady = true; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(nativeReady, 'Asynchronous native startup did not expose a debugger target; see host.log');
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + environment.DSH_PET_TEST_DEBUG_PORT);
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', error => { pageErrorCount++; rememberError(error.stack ?? error); });
  await page.waitForSelector('#pet[data-host-ready=true][data-character=whale][data-companionship=interactive]', { timeout: 30000 });
  await page.addInitScript(() => { let seed = 17; Math.random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }; });
  await page.reload();
  await page.waitForSelector('#pet[data-host-ready=true][data-character=whale][data-companionship=interactive]');
  await page.mouse.move(0, 0);
  const initialSummary = await page.evaluate(() => window.dshPetBridge.companionship({ type: 'read', characterId: 'whale' }));
  assert.equal(initialSummary.writable, true);
  await page.evaluate(async () => {
    const { CompanionClient } = await import(new URL('./companion-client.js', location.href).href);
    const counters = { pending: 0, maxPending: 0, requests: 0, failures: 0, invitationsShown: 0, routines: { observe: 0, play: 0, rest: 0, greeting: 0 } };
    const original = CompanionClient.prototype.request;
    CompanionClient.prototype.request = function (...args) {
      counters.requests++; counters.pending++; counters.maxPending = Math.max(counters.maxPending, counters.pending);
      let result;
      try { result = original.apply(this, args); } catch (error) { counters.pending--; counters.failures++; throw error; }
      result.then(value => { counters.pending--; if (value === null) counters.failures++; }, () => { counters.pending--; counters.failures++; });
      return result;
    };
    const pet = document.querySelector('#pet'), invitation = document.querySelector('#companion-invitation');
    let previousActivity = pet.dataset.companionActivity, previousShown = !invitation.hidden;
    new MutationObserver(() => {
      const current = pet.dataset.companionActivity, shown = !invitation.hidden;
      if (current !== previousActivity && Object.hasOwn(counters.routines, current)) counters.routines[current]++;
      if (shown && !previousShown) counters.invitationsShown++;
      previousActivity = current; previousShown = shown;
    }).observe(pet, { attributes: true, attributeFilter: ['data-companion-activity'] });
    window.__p1ObservationSnapshot = () => ({ ...structuredClone(counters), activity: pet.dataset.companionActivity, mode: pet.dataset.companionship, mood: pet.dataset.mood, visible: !document.hidden, invitationVisible: !invitation.hidden, now: performance.now(), hour: new Date().getHours(), innerWidth, innerHeight });
  });
  session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const frame = page.frames().find(f => f !== page.mainFrame());
  const graphics = await frame.evaluate(() => {
    const canvas = document.querySelector('canvas'), gl = canvas?.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { webgl2: !!gl, vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null };
  });
  assert.equal(graphics.webgl2, true);
  await log({ phase: 'warmup', seconds: warmup, graphics });
  await new Promise(r => setTimeout(r, warmup * 1000));
  let previousTree = await linuxSnapshot(host.pid), previousEnvironment = await linuxEnvironment();
  const electron = previousTree.find(row => row.command.includes('/desktop/main.cjs') && !row.command.includes('--type='));
  assert.ok(electron, 'Identify the Electron root underneath the real Host');
  const electronPid = electron.pid, initialArchive = await archiveStats('start');
  const metadata = { schema: 1, sourceCommit: args['source-commit'], archiveSha256, pluginVersion: manifest.version, dshVersion: version,
    installedSources, collectorHashes, platform: process.platform, arch: process.arch, node: process.version,
    osRelease: (await readFile('/etc/os-release', 'utf8')), display: process.env.DISPLAY, graphics,
    electronPid, electronStartTicks: electron.startTicks, hostPid: host.pid,
    sandbox: 'isolated existing test configuration (no-sandbox/SwiftShader permitted); not normal-install sandbox acceptance',
    mode: 'interactive', rngSeed: 17, clock: 'real wall and monotonic time; no local-hour override',
    warmupSeconds: warmup, requestedSeconds: seconds, intervalSeconds: interval, windowSeconds, initialArchive,
    method: 'Linux /proc process-tree RSS and CPU deltas; 100% is one core; host/sampler excluded from pet RSS; separate host tree reported; RSS can double-count shared pages',
    instrumentation: 'CDP and bounded test-page counters; no product source changes, no input during observation; default invitation response is ignore',
  };
  await writeFile(join(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  await page.screenshot({ path: join(output, 'start.png') });
  previousTree = await linuxSnapshot(host.pid); previousEnvironment = await linuxEnvironment();
  const started = performance.now(), startedAt = new Date().toISOString();
  let before = started, nextSample = started + interval * 1000, checkpointAt = 60;
  await log({ phase: 'sampling', startedAt, electronPid, hostPid: host.pid, archiveSha256, requestedSeconds: seconds });
  while (!interrupted && (performance.now() - started) / 1000 < seconds) {
    await new Promise(r => setTimeout(r, Math.max(0, nextSample - performance.now())));
    if (hostFailure) throw new Error(hostFailure);
    const tree = await linuxSnapshot(host.pid), env = await linuxEnvironment();
    const currentElectron = tree.find(row => row.pid === electronPid);
    assert.equal(currentElectron?.startTicks, electron.startTicks, 'Electron lifetime changed');
    const petIds = new Set([electronPid]); let changed = true;
    while (changed) { changed = false; for (const row of tree) if (petIds.has(row.ppid) && !petIds.has(row.pid)) { petIds.add(row.pid); changed = true; } }
    const petTree = tree.filter(row => petIds.has(row.pid)), now = performance.now(), elapsedSeconds = (now - before) / 1000;
    const telemetry = await page.evaluate(() => window.__p1ObservationSnapshot());
    const { metrics } = await session.send('Performance.getMetrics');
    const memory = await session.send('Memory.getDOMCounters');
    const selected = Object.fromEntries(metrics.filter(m => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners'].includes(m.name)).map(m => [m.name, m.value]));
    const totalTicks = env.cpuTotalTicks - previousEnvironment.cpuTotalTicks;
    const sample = { atSeconds: (now - started) / 1000, elapsedSeconds, time: new Date().toISOString(),
      cpuPercentOneCore: processCpu(previousTree, petTree, elapsedSeconds, ticksPerSecond),
      rssMiB: petTree.reduce((n, row) => n + row.rssMiB, 0),
      hostTreeCpuPercentOneCore: processCpu(previousTree, tree, elapsedSeconds, ticksPerSecond),
      hostTreeRssMiB: tree.reduce((n, row) => n + row.rssMiB, 0), processTree: tree, telemetry,
      renderer: { ...selected, ...memory }, archive: await archiveStats(),
      environment: { ...env, stealPercent: totalTicks > 0 ? (env.stealTicks - previousEnvironment.stealTicks) / totalTicks * 100 : null },
    };
    assert.equal(telemetry.mode, 'interactive'); assert.equal(telemetry.mood, 'idle'); assert.equal(telemetry.visible, true);
    assert.ok(telemetry.hour >= 7 && telemetry.hour < 22, 'Daytime observation crossed into night; retain as incomplete');
    await rawFile.write(JSON.stringify(sample) + '\n'); samples.push(sample);
    if (sample.atSeconds >= checkpointAt) {
      await log({ phase: 'progress', elapsedSeconds: sample.atSeconds, rssMiB: sample.rssMiB, cpuPercentOneCore: sample.cpuPercentOneCore,
        routines: telemetry.routines, invitationsShown: telemetry.invitationsShown, pendingRequests: telemetry.pending });
      await writeFile(join(output, 'progress.json'), JSON.stringify({ measuredAt: sample.time, elapsedSeconds: sample.atSeconds, requestedSeconds: seconds, lastSample: sample }, null, 2) + '\n');
      checkpointAt += 60;
    }
    previousTree = tree; previousEnvironment = env; before = now; nextSample += interval * 1000;
    if (nextSample < performance.now()) nextSample = performance.now() + interval * 1000;
  }
  complete = !interrupted && samples.at(-1)?.atSeconds >= seconds;
  const resource = summarizeObservation(samples, { seconds, windowSeconds, maxGapSeconds: interval * 3, complete });
  const finalArchive = await archiveStats('end'), finalTelemetry = await page.evaluate(() => window.__p1ObservationSnapshot());
  const bounds = {
    archive: samples.every(s => !s.archive.exists || s.archive.bytes <= 262144 && s.archive.recentCount <= 128 && s.archive.characterCount <= 256 && s.archive.invitations <= 2),
    requestsDrained: finalTelemetry.pending === 0, requestFailures: finalTelemetry.failures, maxPendingRequests: finalTelemetry.maxPending,
    pageErrorCount, pageErrors, finalArchive, finalTelemetry,
  };
  const coverage = { routines: ['observe', 'play', 'rest'].every(kind => finalTelemetry.routines[kind] > 0),
    invitation: finalTelemetry.invitationsShown >= 1 && finalTelemetry.invitationsShown <= 2 && finalArchive.exists && finalArchive.invitations === finalTelemetry.invitationsShown };
  const result = { schema: 1, sourceCommit: args['source-commit'], archiveSha256, startedAt, endedAt: new Date().toISOString(),
    status: resource.status === 'incomplete' ? 'incomplete' : resource.status === 'pass' && bounds.archive && bounds.requestsDrained && !bounds.requestFailures && !pageErrorCount && (seconds < 7200 || coverage.routines && coverage.invitation) ? 'pass' : 'fail',
    fullTwoHourObservation: complete && seconds >= 7200 && windowSeconds >= 1800,
    resource, bounds, coverage, renderer: { first: samples[0]?.renderer, last: samples.at(-1)?.renderer },
    environment: { maxStealPercent: Math.max(...samples.map(s => s.environment.stealPercent ?? 0)), maxSwapUsedMiB: Math.max(...samples.map(s => s.environment.swapUsedMiB)), minAvailableMiB: Math.min(...samples.map(s => s.environment.availableMiB)) },
    limitations: 'One Linux PVE VM, one real DSH version, test rendering/sandbox, and one fixed idle daytime scenario; does not prove macOS/Windows resource use, real GPU cost, seven-day value, all queues/timers, or physical lock/sleep.',
  };
  await writeFile(join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  await page.screenshot({ path: join(output, 'end.png') });
  await log({ phase: 'finished', status: result.status, fullTwoHourObservation: result.fullTwoHourObservation, rssDeltaMiB: resource.rssDeltaMiB });
  if (result.status !== 'pass') process.exitCode = 1;
} catch (error) {
  process.exitCode = 1;
  await writeFile(join(output, 'failure.json'), JSON.stringify({ status: 'incomplete', at: new Date().toISOString(), error: String(error.stack ?? error), sourceCommit: args['source-commit'], archiveSha256, samplesWritten: samples.length }, null, 2) + '\n', { flag: 'wx' });
  await log({ phase: 'failed', error: String(error.message ?? error) });
} finally {
  await session?.detach().catch(() => {});
  await browser?.close().catch(() => {});
  await stopHost();
  await rawFile?.close(); await logFile?.close();
  process.off('SIGTERM', stopSignal); process.off('SIGINT', stopSignal);
}
