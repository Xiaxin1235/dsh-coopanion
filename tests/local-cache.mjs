import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { cacheCandidates, removeGenerated, safePath, temporary, exists, inUse } from '../scripts/lib/local-cache.mjs';
import { runtimeKey } from '../scripts/lib/host-runtime.mjs';
const day = 86400000;
async function fixture(t) {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'coopanion-cache-test-')));
  const root = join(parent, 'cache'); await mkdir(root);
  t.after(() => rm(parent, { recursive: true, force: true }));
  return { root, parent };
}
const unused = () => false;
function deadPid() {
  const result = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.equal(result.status, 0); return result.pid;
}
async function stale(root, name, pid = deadPid()) {
  const path = join(root, 'tmp', name); await mkdir(path, { recursive: true });
  await writeFile(join(path, 'lease.json'), JSON.stringify({ schema: 1, kind: 'temporary', pid, created: Date.now() - 2 * day, references: [] }));
  return path;
}
test('managed profiles are isolated and disposal is idempotent', async t => {
  const { root } = await fixture(t), a = await temporary('test', [], root), b = await temporary('test', [], root);
  assert.notEqual(a.path, b.path);
  await a.dispose(); await a.dispose(); assert.equal(await exists(a.path), false); assert.equal(await exists(b.path), true);
});
test('cleanup protects live owners, orphan users, recent runs, pins and unknown files', async t => {
  const { root } = await fixture(t), dead = await stale(root, 'dead');
  await stale(root, 'live', process.pid);
  const orphan = await stale(root, 'orphan');
  await stale(root, 'pinned');
  await writeFile(join(root, 'keep.json'), JSON.stringify(['tmp/pinned']));
  await temporary('recent', [], root);
  await mkdir(join(root, 'tmp', 'unknown'));
  const candidates = await cacheCandidates(root, Date.now(), p => p === orphan);
  assert.deepEqual(candidates.map(c => c.path), [dead]);
  await removeGenerated(root, dead);
  assert.deepEqual(await cacheCandidates(root, Date.now(), p => p === orphan), []);
});
test('an active working directory protects a stale-owner lease, including partial lsof matches', async t => {
  if (process.platform === 'win32') return;
  const { root } = await fixture(t), path = await stale(root, 'orphan-real');
  // Current process working directory is visible to lsof even with no open file.
  const old = process.cwd();
  try {
    process.chdir(path);
    assert.equal(inUse(path), true);
    assert.deepEqual(await cacheCandidates(root), []);
  } finally { process.chdir(old); }
});
test('refuses root, parent traversal and symlink ancestors; nested links cannot delete targets', async t => {
  const { root, parent } = await fixture(t), outside = join(parent, 'outside'); await mkdir(outside);
  await writeFile(join(outside, 'unique'), 'keep');
  await assert.rejects(removeGenerated(root, root), /Outside/);
  await assert.rejects(removeGenerated(root, join(root, '..', 'outside')), /Outside/);
  await symlink(outside, join(root, 'escape'), 'dir');
  await assert.rejects(removeGenerated(root, join(root, 'escape', 'unique')), /Symlink/);
  const run = await temporary('links', [], root);
  await symlink(outside, join(run.path, 'nested'), 'dir'); await run.dispose();
  assert.equal(await readFile(join(outside, 'unique'), 'utf8'), 'keep');
  const alias = join(parent, 'alias'); await symlink(root, alias, 'dir');
  await assert.rejects(safePath(alias, join(alias, 'tmp')), /Symlink/);
});
test('runtime retention honors leases, selected runtime references and 30 day boundary', async t => {
  const { root } = await fixture(t);
  const runtime = async (name, extra = {}) => {
    const path = join(root, 'runtimes', name); await mkdir(path, { recursive: true });
    await writeFile(join(path, 'ready.json'), JSON.stringify({ schema: 1, kind: 'host-runtime', lastUsed: Date.now() - 31 * day, ...extra }));
    return path;
  };
  const old = await runtime('old'), active = await runtime('active');
  await temporary('reader', [active], root);
  await runtime('recent', { lastUsed: Date.now() });
  const selected = await runtime('selected');
  await mkdir(join(root, 'runtime-refs'));
  await writeFile(join(root, 'runtime-refs', 'host.json'), JSON.stringify({ schema: 1, runtime: selected }));
  assert.deepEqual((await cacheCandidates(root, Date.now(), unused)).map(c => c.path), [old]);
});
test('preview is read only and newly added pins change eligibility before apply', async t => {
  const { root } = await fixture(t), path = await stale(root, 'dead');
  assert.equal((await cacheCandidates(root, Date.now(), unused)).length, 1);
  assert.equal(await exists(path), true);
  await writeFile(join(root, 'keep.json'), '["tmp/dead"]');
  assert.equal((await cacheCandidates(root, Date.now(), unused)).length, 0);
});
test('ordinary files in managed directory lists survive preview without blocking eligible directories', async t => {
  const { root } = await fixture(t), dead = await stale(root, 'dead');
  const runtime = join(root, 'runtimes', 'old'); await mkdir(runtime, { recursive: true });
  await writeFile(join(runtime, 'ready.json'), JSON.stringify({ schema: 1, kind: 'host-runtime', lastUsed: Date.now() - 31 * day }));
  const files = [join(root, 'tmp', 'unknown.txt'), join(root, 'runtimes', '.DS_Store')];
  for (const file of files) await writeFile(file, 'retain unknown bytes');
  assert.deepEqual((await cacheCandidates(root, Date.now(), unused)).map(c => c.path), [dead, runtime]);
  for (const file of files) assert.equal(await readFile(file, 'utf8'), 'retain unknown bytes');
});
test('runtime keys change for all actual build inputs, independent of stage or profile', () => {
  const options = { version: '0.2.1-rc.2', node: 'v24.21.0', abi: '137', platform: 'darwin', arch: 'arm64', npm: '11.19.1' };
  const key = runtimeKey(Buffer.from('lock'), options);
  assert.equal(key, runtimeKey(Buffer.from('lock'), { ...options, stage: '5a' }));
  for (const field of Object.keys(options)) assert.notEqual(key, runtimeKey(Buffer.from('lock'), { ...options, [field]: options[field] + '-changed' }), field);
  assert.notEqual(key, runtimeKey(Buffer.from('changed-lock'), options));
  assert.notEqual(key, runtimeKey(Buffer.from('lock'), { ...options, installConfig: { 'ignore-scripts': true } }));
});
