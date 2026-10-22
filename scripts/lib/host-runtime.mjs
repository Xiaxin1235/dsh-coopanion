import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cacheRoot, exists, json, safePath, sha256, temporary } from './local-cache.mjs';

export function runtimeKey(lock, { version, node = process.version, abi = process.versions.modules, platform = process.platform, arch = process.arch, npm, installConfig = {} } = {}) {
  return sha256(JSON.stringify({ schema: 1, version, node, abi, platform, arch, npm, installConfig, install: 'npm-ci-default-scripts', lock: sha256(lock) }));
}
export async function hostRuntime(version, { lockFile, npm = process.env.npm_execpath } = {}) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/);
  assert.ok(npm, 'Run through npm, or supply the pinned npm CLI');
  const npmVersion = execFileSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).trim();
  const config = JSON.parse(execFileSync(process.execPath, [npm, 'config', 'list', '--json'], { encoding: 'utf8' }));
  // Select build-affecting settings only; never persist credentials from npm config.
  const installConfig = Object.fromEntries(['ignore-scripts', 'allow-scripts', 'legacy-peer-deps', 'strict-peer-deps', 'install-links', 'install-strategy', 'omit', 'include', 'optional', 'engine-strict', 'cpu', 'os', 'libc', 'bin-links', 'prefer-dedupe', 'registry'].map(k => [k, config[k] ?? null]));
  installConfig.environment = Object.fromEntries(['NODE_ENV', 'CC', 'CXX', 'CFLAGS', 'CXXFLAGS', 'LDFLAGS', 'npm_config_build_from_source', 'ELECTRON_SKIP_BINARY_DOWNLOAD'].map(k => [k, process.env[k] ?? null]));
  const locks = join(cacheRoot, 'runtime-locks');
  await mkdir(cacheRoot, { recursive: true });
  await safePath(cacheRoot, locks);
  await mkdir(locks, { recursive: true });
  const lock = lockFile ? resolve(lockFile) : join(locks, version + '.json');
  if (!lockFile) await safePath(cacheRoot, lock);
  async function run(args, cwd) {
    await new Promise((res, rej) => {
      const child = spawn(process.execPath, [npm, ...args, '--cache', join(cacheRoot, 'npm-downloads'), '--no-audit', '--no-fund'], { cwd, env: process.env, stdio: 'inherit' });
      const stop = signal => child.kill(signal);
      const int = () => stop('SIGINT'), term = () => stop('SIGTERM');
      const deadline = setTimeout(() => child.kill('SIGKILL'), process.platform === 'win32' ? 600000 : 240000);
      process.on('SIGINT', int); process.on('SIGTERM', term);
      child.once('error', rej);
      child.once('close', code => { clearTimeout(deadline); process.off('SIGINT', int); process.off('SIGTERM', term); code === 0 ? res() : rej(Error('npm exited ' + code)); });
    });
  }
  // Resolve transitive inputs once, then retain this lock until deliberately refreshed.
  if (!await exists(lock)) {
    assert.ok(!lockFile, 'Explicit runtime lock does not exist');
    const staging = await temporary('host-lock');
    try {
      await writeFile(join(staging.path, 'package.json'), JSON.stringify({ private: true, dependencies: { '@deepseek-ai/dsh': version } }));
      await run(['install', '--package-lock-only', '--ignore-scripts'], staging.path);
      const bytes = await readFile(join(staging.path, 'package-lock.json'));
      // Exclusive publication prevents concurrent resolvers silently replacing a lock.
      try { await writeFile(lock, bytes, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    } finally { await staging.dispose(); }
  }
  const bytes = await readFile(lock), parsed = JSON.parse(bytes);
  assert.equal(parsed.packages['node_modules/@deepseek-ai/dsh'].version, version);
  const key = runtimeKey(bytes, { version, npm: npmVersion, installConfig });
  const runtime = join(cacheRoot, 'runtimes', key);
  await safePath(cacheRoot, runtime);
  await mkdir(join(cacheRoot, 'runtimes'), { recursive: true });
  const lease = await temporary('host-use', [runtime]);
  try {
    if (!await exists(join(runtime, 'ready.json'))) {
      const staging = await temporary('host-build', [runtime]);
      try {
        // Keep lease.json outside the published runtime and never copy dependencies.
        const build = join(staging.path, 'runtime'); await mkdir(build);
        await writeFile(join(build, 'package.json'), JSON.stringify({ private: true, ...parsed.packages[''] }));
        await writeFile(join(build, 'package-lock.json'), bytes);
        await run(['ci'], build);
        assert.equal((await json(join(build, 'node_modules/@deepseek-ai/dsh/package.json'))).version, version);
        await writeFile(join(build, 'ready.json'), JSON.stringify({ schema: 1, kind: 'host-runtime', version, key, npm: npmVersion, node: process.version, lock, lockSha256: sha256(bytes), lastUsed: Date.now() }));
        try { await rename(build, runtime); } catch (e) { if (!['EEXIST', 'ENOTEMPTY'].includes(e.code)) throw e; }
      } finally { await staging.dispose(); }
    }
    const state = await json(join(runtime, 'ready.json'));
    assert.equal(state.key, key); assert.equal(state.lockSha256, sha256(bytes));
    assert.equal((await json(join(runtime, 'node_modules/@deepseek-ai/dsh/package.json'))).version, version);
    // Atomic update for readers; runtime payload stays unchanged.
    const update = join(lease.path, 'ready.json');
    await writeFile(update, JSON.stringify({ ...state, lastUsed: Date.now() }));
    await rename(update, join(runtime, 'ready.json'));
    const refs = join(cacheRoot, 'runtime-refs');
    await safePath(cacheRoot, refs); await mkdir(refs, { recursive: true });
    const ref = join(lease.path, 'reference.json');
    await writeFile(ref, JSON.stringify({ schema: 1, runtime }));
    await rename(ref, join(refs, `${version}-${process.platform}-${process.arch}.json`));
    return { path: runtime, key, dispose: lease.dispose };
  } catch (e) { await lease.dispose(); throw e; }
}
