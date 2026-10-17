import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listDiagnostics, readDiagnostics } from '../scripts/diagnostics-client.mjs';
const require = createRequire(import.meta.url), packageRoot = resolve(process.env.DSH_LIFECYCLE_PACKAGE_ROOT ?? '.');
const real = process.env.DSH_LIFECYCLE_NATIVE_REAL === '1';
const records = [];
for (const initialState of real ? ['system'] : ['locked', 'unknown', 'restore-locked', 'system']) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-initial-lock-'));
  const env = { ...process.env, DSH_PET_TEST_DATA_DIR: join(root, 'pet'), DSH_PET_TEST_DIAGNOSTICS_DIR: join(root, 'registry'), DSH_PET_SCREEN_LOCKED: initialState === 'restore-locked' ? '1' : '0', DSH_PET_SYSTEM_ASLEEP: '0' };
  delete env.ELECTRON_RUN_AS_NODE;
  if (real) { delete env.DSH_PET_TEST_NO_SANDBOX; delete env.DSH_PET_TEST_DEBUG_PORT; delete env.DSH_PET_TEST_INITIAL_LOCK_STATE; }
  else { env.DSH_PET_TEST_NO_SANDBOX = '1'; env.DSH_PET_TEST_DEBUG_PORT = '0'; env.DSH_PET_TEST_INITIAL_LOCK_STATE = initialState === 'restore-locked' ? 'unlocked' : initialState; }
  const child = spawn(require('electron'), [...(real ? [] : ['--no-sandbox']), join(packageRoot, 'desktop/main.cjs')], { env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const exited = once(child, 'exit'); let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    child.send({ type: 'init', baseline: true, options: { size: 150, companionship: 'quiet', roam: true, diagnostics: true, notifications: false }, snapshot: { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] } });
    let snapshot;
    for (let attempt = 0; attempt < 80; attempt++) {
      const [endpoint] = await listDiagnostics(join(root, 'registry'));
      if (endpoint) { snapshot = await readDiagnostics(endpoint); break; }
      assert.equal(child.exitCode, null, stderr); await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(snapshot, 'Initial diagnostic endpoint must become available');
    const state = snapshot.value.runtime;
    if (initialState === 'locked' || initialState === 'restore-locked' || real) {
      assert.equal(state.screenLocked, true, 'A cold start on a locked desktop must initialize locked');
      assert.equal(state.suspended, true); assert.equal(state.lockStateKnown, true);
    } else if (initialState === 'unknown') {
      assert.equal(state.lockStateKnown, false); assert.equal(state.suspended, true);
    } else {
      assert.equal(typeof state.lockStateKnown, 'boolean');
      if (!state.lockStateKnown || state.screenLocked) assert.equal(state.suspended, true);
    }
    records.push({ platform: process.platform, build: snapshot.build, controlledInitialState: real ? null : initialState, normalSandbox: real, runtime: state });
  } finally {
    const deadline = setTimeout(() => child.kill('SIGKILL'), 10000);
    try {
      // Windows SIGTERM forcibly terminates the main process before Chromium
      // releases its profile. Use the desktop's normal IPC quit path instead.
      if (child.connected) child.send({ type: 'quit' }); else child.kill('SIGTERM');
      const [code, signal] = await exited;
      assert.equal(signal, null, stderr); assert.equal(code, 0, stderr);
    } finally {
      clearTimeout(deadline);
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}
await mkdir('artifacts', { recursive: true });
await writeFile(real ? 'artifacts/lifecycle-startup-real.json' : 'artifacts/lifecycle-startup-native.json', JSON.stringify({ records }, null, 2) + '\n');
console.log('Native lifecycle startup: locked cold start, conservative unknown and system adapter observation passed.');
