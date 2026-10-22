// D0 tooling only. No product runtime, window titles, screenshots or window mutation.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { join, win32 } = require('node:path');
const runFile = promisify(execFile);

function sessionBackend(platform, env) {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform !== 'linux') return 'unsupported-platform';
  if (env.WAYLAND_DISPLAY || env.XDG_SESSION_TYPE?.toLowerCase() === 'wayland') return 'wayland';
  return env.DISPLAY ? 'x11' : 'headless';
}

async function collectWindows({ pid, platform = process.platform, env = process.env, run = runFile } = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new TypeError('A positive test-process pid is required');
  const backend = sessionBackend(platform, env), began = performance.now();
  const result = (status, reason, extra = {}) => ({ schema: 1, backend, status, reason,
    scope: 'test-process', targetPid: pid, order: 'front-to-back', windows: [],
    durationMs: Math.round(performance.now() - began), ...extra });
  if (['wayland', 'headless', 'unsupported-platform'].includes(backend)) return result('unsupported', backend);
  let command, args;
  if (backend === 'macos') {
    command = '/usr/bin/osascript'; args = ['-l', 'JavaScript', join(__dirname, 'windows-macos.jxa'), String(pid)];
  } else if (backend === 'windows') {
    if (!env.SystemRoot || !win32.isAbsolute(env.SystemRoot)) return result('unavailable', 'missing-system-root');
    command = win32.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const source = join(__dirname, 'windows-win.cs').replace(/'/g, "''");
    args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
      `$ErrorActionPreference='Stop'; Add-Type -Path '${source}'; [DesktopWindowProbe]::Read(${pid}) | ConvertTo-Json -Compress -Depth 5`];
  } else {
    command = '/usr/bin/python3'; args = ['-I', join(__dirname, 'windows-x11.py'), String(pid)];
  }
  let raw;
  try {
    const { stdout } = await run(command, args, { env, encoding: 'utf8', timeout: 5000,
      killSignal: 'SIGKILL', maxBuffer: 65536, windowsHide: true });
    raw = JSON.parse(stdout);
  } catch (error) {
    return result('failed', error.code === 'ENOENT' ? 'missing-dependency' : error.killed ? 'timeout' : 'helper-or-json-error');
  }
  if (!raw || !['available', 'partial', 'unavailable', 'unsupported'].includes(raw.status)) return result('failed', 'protocol-error');
  if (['unsupported', 'unavailable'].includes(raw.status)) return result(raw.status, 'native-capability-unavailable');
  const units = backend === 'macos' ? 'global-dip' : 'physical-pixels';
  if (raw.units !== units || !Array.isArray(raw.windows) || raw.windows.length > 64) return result('failed', 'protocol-error');
  const ids = new Set(), windows = [];
  for (const w of raw.windows) {
    if (!w || w.pid !== pid || typeof w.id !== 'string' || !/^\d{1,20}$/.test(w.id) || ids.has(w.id)
      || !w.bounds || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(w.bounds[k]) && Math.abs(w.bounds[k]) <= 1e7)
      || w.bounds.width <= 0 || w.bounds.height <= 0) return result('failed', 'protocol-error');
    ids.add(w.id);
    // Copy only the allowed fields even if a helper accidentally emits additional data.
    windows.push({ id: w.id, pid, bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, w.bounds[k]])) });
  }
  return result(raw.status, raw.status === 'partial' ? 'incomplete-native-sample' : null, { units, windows });
}

function toDipBounds(bounds, backend, screen) {
  if (backend === 'macos') return { ...bounds };
  if (backend === 'windows') return screen.screenToDipRect(null, bounds);
  if (backend !== 'x11') throw new Error('Coordinate conversion requires a supported desktop session');
  // Probe fixtures stay inside one display. Do not multiply a global origin by DPR.
  const a = screen.screenToDipPoint({ x: bounds.x, y: bounds.y });
  const b = screen.screenToDipPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
}

module.exports = { collectWindows, sessionBackend, toDipBounds };
