import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
const root = resolve(import.meta.dirname, '..');
const output = resolve(values.output ?? join(root, 'artifacts', `desktop-environment-${Date.now()}`));
// Every run owns a new output directory and temporary profile.
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
const sourceFiles = ['scripts/probe-desktop-environment.mjs', 'package.json', 'npm-shrinkwrap.json',
  'desktop/keyboard-activity.cjs', 'desktop/keyboard-activity.jxa', 'desktop/keyboard-activity-win.cs',
  'desktop/keyboard-activity-x11.py', 'desktop/lifecycle-state.cjs', 'desktop/lifecycle-state-macos.jxa',
  ...(await readdir(join(root, 'scripts/desktop-environment'), { withFileTypes: true })).filter(f => f.isFile() && !f.name.startsWith('.'))
    .map(f => `scripts/desktop-environment/${f.name}`).sort()];
const sourceHashes = {};
for (const file of sourceFiles) sourceHashes[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
const identity = { at: new Date().toISOString(), node: process.version, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes };
const profile = await mkdtemp(join(tmpdir(), 'dsh-desktop-probe-'));
const env = { ...process.env, DSH_DESKTOP_PROBE_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
for (const key of Object.keys(env)) if (key.startsWith('DSH_PET_TEST_') || key === 'DSH_KEYBOARD_TEST_X11_INPUT') delete env[key];
const noSandbox = process.env.CI === 'true' && process.env.DSH_DESKTOP_PROBE_NO_SANDBOX === '1';
let report, stderr = '', timedOut = false, profileRemoved = false;
try {
  const child = spawn(createRequire(import.meta.url)('electron'), [...(noSandbox ? ['--no-sandbox'] : []), join(root, 'scripts/desktop-environment/probe.cjs')],
    { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4000); });
  child.on('message', message => { if (message?.type === 'desktop-probe-result') report = message.report; });
  const watchdog = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 90000);
  let exit;
  try {
    exit = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });
  } finally { clearTimeout(watchdog); }
  report ??= { schema: 1, status: 'failed', reason: timedOut ? 'probe-timeout' : 'probe-exited-without-result' };
  report.exit = exit;
  if (timedOut || exit.signal || (report.status === 'passed' && exit.code !== 0)) report.status = 'failed';
} catch (error) {
  report = { schema: 1, status: 'failed', reason: error.code ?? 'launch-failed' };
} finally {
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    profileRemoved = true;
  } catch {
    report ??= { schema: 1 };
    report.status = 'failed'; report.reason = 'profile-cleanup-failed';
  }
}
Object.assign(report, { identity, normalSandbox: !noSandbox, profileRemoved });
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
if (report.status === 'failed') await writeFile(join(output, 'process.log'), stderr);
console.log(JSON.stringify({ status: report.status, session: report.session, checks: report.checks?.length ?? 0, report: join(output, 'report.json') }));
// Unsupported is a useful observation, never a successful geometry verification.
if (report.status !== 'passed') process.exitCode = 1;
