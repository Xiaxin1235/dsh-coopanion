import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';

export const project = fileURLToPath(new URL('../../', import.meta.url));
export const cacheRoot = join(project, '.cache');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }

// Never traverse a symlink in an ancestor. rm unlinks nested symlinks, not targets.
export async function safePath(root, path) {
  root = resolve(root); path = resolve(path);
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || rel.startsWith(sep)) throw Error('Outside generated root: ' + path);
  if (await realpath(root) !== root) throw Error('Symlink root: ' + root);
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    if (await exists(current) && (await lstat(current)).isSymbolicLink()) throw Error('Symlink boundary: ' + current);
  }
  return path;
}
export async function removeGenerated(root, path) {
  await safePath(root, path);
  await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
export function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}
export function inUse(path) {
  // A killed supervisor can leave a browser/Host behind. A dead owner alone
  // never permits reclaiming it. Missing/denied process inspection fails closed.
  if (process.platform === 'win32') return true;
  try {
    if (execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8', timeout: 10000 }).includes(path)) return true;
    execFileSync('lsof', ['-n', '-P', '-t', '+D', path], { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch (e) {
    // lsof may report matching PIDs yet exit 1 when another selected entry has
    // no match. Those PIDs still prove use; do not discard partial stdout.
    if (e.stdout?.length) return true;
    return e.status !== 1 || e.stderr?.length > 0;
  }
}

// Profiles are private per run; only immutable runtime directories are shared.
export async function temporary(label, references = [], root = cacheRoot) {
  if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid temporary label');
  await mkdir(root, { recursive: true });
  const path = join(root, 'tmp', label + '-' + randomUUID());
  await safePath(root, path);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'lease.json'), JSON.stringify({ schema: 1, kind: 'temporary', pid: process.pid, created: Date.now(), references }));
  return { path, async dispose() { await removeGenerated(root, path); } };
}

export async function cacheCandidates(root = cacheRoot, now = Date.now(), used = inUse) {
  if (!await exists(root)) return [];
  await safePath(root, join(root, 'tmp'));
  const result = [], protectedPaths = new Set();
  const pinsFile = join(root, 'keep.json');
  if (await exists(pinsFile)) {
    const pins = await json(pinsFile);
    if (!Array.isArray(pins) || pins.some(p => typeof p !== 'string')) throw Error('keep.json must be an array of relative paths');
    for (const p of pins) protectedPaths.add(await safePath(root, join(root, p)));
  }
  const refs = join(root, 'runtime-refs');
  if (await exists(refs)) {
    await safePath(root, refs);
    for (const name of await readdir(refs)) {
      const ref = await json(await safePath(root, join(refs, name)));
      if (ref.schema !== 1 || typeof ref.runtime !== 'string') throw Error('Unknown runtime reference: ' + name);
      protectedPaths.add(await safePath(root, ref.runtime));
    }
  }
  const pinned = path => [...protectedPaths].some(p => path === p || path.startsWith(p + sep) || p.startsWith(path + sep));
  const tmp = join(root, 'tmp');
  if (await exists(tmp)) for (const name of await readdir(tmp)) {
    const path = await safePath(root, join(tmp, name));
    try {
      if (!(await lstat(path)).isDirectory()) continue;
      const lease = await json(join(path, 'lease.json'));
      if (lease.schema !== 1 || lease.kind !== 'temporary' || !Number.isFinite(lease.created) || !Array.isArray(lease.references)) continue;
      // Even a dead run holds its references until its private directory is reclaimed.
      for (const ref of lease.references) protectedPaths.add(await safePath(root, ref));
      if (!alive(lease.pid) && now - lease.created > 86400000 && !pinned(path) && !used(path)) result.push({ path, kind: 'temporary', created: lease.created });
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const runtimes = join(root, 'runtimes');
  if (await exists(runtimes)) {
    await safePath(root, runtimes);
    for (const name of await readdir(runtimes)) {
      const path = await safePath(root, join(runtimes, name));
      if (pinned(path)) continue;
      try {
        if (!(await lstat(path)).isDirectory()) continue;
        const state = await json(join(path, 'ready.json'));
        if (state.schema !== 1 || state.kind !== 'host-runtime' || !Number.isFinite(state.lastUsed)) continue;
        if (now - state.lastUsed > 30 * 86400000 && !used(path)) result.push({ path, kind: 'host-runtime', lastUsed: state.lastUsed });
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  return result;
}
