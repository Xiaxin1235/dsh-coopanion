import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { collectWindows, sessionBackend, toDipBounds } = createRequire(import.meta.url)('../scripts/desktop-environment/collect.cjs');
const window = { id: '123', pid: 42, bounds: { x: -100, y: 30, width: 200, height: 90 } };
const native = (windows = [window], status = 'available', units = 'global-dip') => ({ stdout: JSON.stringify({ windows, status, units }) });

it('does not silently use an Xwayland subset or launch helpers in unsupported sessions', async () => {
  for (const [platform, env, backend] of [
    ['linux', { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }, 'wayland'],
    ['linux', { DISPLAY: ':0', XDG_SESSION_TYPE: 'Wayland' }, 'wayland'],
    ['linux', {}, 'headless'], ['freebsd', {}, 'unsupported-platform'],
  ]) {
    const run = vi.fn();
    expect(sessionBackend(platform, env)).toBe(backend);
    expect(await collectWindows({ pid: 42, platform, env, run })).toMatchObject({ status: 'unsupported', backend, windows: [] });
    expect(run).not.toHaveBeenCalled();
  }
});

it('uses bounded one-shot native helpers without shell interpolation or permission requests', async () => {
  for (const [platform, env, command, units] of [
    ['darwin', {}, '/usr/bin/osascript', 'global-dip'],
    ['win32', { SystemRoot: 'C:\\Windows' }, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'physical-pixels'],
    ['linux', { DISPLAY: ':99' }, '/usr/bin/python3', 'physical-pixels'],
  ]) {
    const run = vi.fn(async () => native([window], 'available', units));
    expect(await collectWindows({ pid: 42, platform, env, run })).toMatchObject({ status: 'available', windows: [window], scope: 'test-process' });
    expect(run.mock.calls[0][0]).toBe(command);
    expect(run.mock.calls[0][2]).toMatchObject({ timeout: 5000, maxBuffer: 65536, killSignal: 'SIGKILL', windowsHide: true });
    expect(run.mock.calls[0][2].shell).toBeUndefined();
  }
});

it('keeps valid empty, partial, unavailable, malformed and failed observations distinct', async () => {
  const sample = run => collectWindows({ pid: 42, platform: 'darwin', env: {}, run });
  expect(await sample(async () => native([]))).toMatchObject({ status: 'available', windows: [] });
  expect(await sample(async () => native([window], 'partial'))).toMatchObject({ status: 'partial', windows: [window] });
  expect(await sample(async () => native([], 'unavailable'))).toMatchObject({ status: 'unavailable', windows: [] });
  expect(await sample(async () => ({ stdout: '{' }))).toMatchObject({ status: 'failed', windows: [] });
  for (const [error, reason] of [[{ code: 'ENOENT' }, 'missing-dependency'], [{ killed: true }, 'timeout'], [{ code: 1 }, 'helper-or-json-error']]) {
    expect(await sample(async () => { throw error; })).toMatchObject({ status: 'failed', reason, windows: [] });
  }
});

it('rejects wrong owners, duplicate identities, invalid geometry, units and capacity overflow', async () => {
  for (const windows of [[{ ...window, pid: 1 }], [window, window], [{ ...window, id: 'title' }],
    [{ ...window, bounds: { ...window.bounds, width: -1 } }], [{ ...window, bounds: { ...window.bounds, x: null } }],
    Array.from({ length: 65 }, (_, i) => ({ ...window, id: String(i + 1) }))]) {
    expect(await collectWindows({ pid: 42, platform: 'darwin', run: async () => native(windows) })).toMatchObject({ status: 'failed', reason: 'protocol-error', windows: [] });
  }
  expect(await collectWindows({ pid: 42, platform: 'darwin', run: async () => native([window], 'available', 'pixels') })).toMatchObject({ status: 'failed' });
  const result = await collectWindows({ pid: 42, platform: 'darwin', run: async () => native([{ ...window, title: 'private', bounds: { ...window.bounds, content: 'private' } }]) });
  expect(result.windows).toEqual([window]);
  expect(JSON.stringify(result)).not.toContain('private');
});

it('requires a valid target process and an absolute Windows system root', async () => {
  const run = vi.fn();
  for (const pid of [undefined, 0, -1, 1.5, '42', Number.MAX_SAFE_INTEGER + 1]) await expect(collectWindows({ pid, run })).rejects.toThrow(TypeError);
  expect(await collectWindows({ pid: 42, platform: 'win32', env: { SystemRoot: 'relative' }, run })).toMatchObject({ status: 'unavailable' });
  expect(run).not.toHaveBeenCalled();
});

it('uses Electron coordinate conversion for negative origins instead of multiplying global positions by scale', () => {
  const screen = { screenToDipRect: vi.fn(() => ({ x: -900, y: 15, width: 100, height: 45 })),
    screenToDipPoint: vi.fn(({ x, y }) => ({ x: -1000 + (x + 1800) / 2, y: y / 2 })) };
  expect(toDipBounds(window.bounds, 'macos', screen)).toEqual(window.bounds);
  expect(toDipBounds(window.bounds, 'windows', screen)).toEqual({ x: -900, y: 15, width: 100, height: 45 });
  expect(screen.screenToDipRect).toHaveBeenCalledWith(null, window.bounds);
  expect(toDipBounds(window.bounds, 'x11', screen)).toEqual({ x: -150, y: 15, width: 100, height: 45 });
  expect(() => toDipBounds(window.bounds, 'wayland', screen)).toThrow();
});

it('bridges the opaque macOS CF array before enumerating and only reads allowlisted metadata', () => {
  const dictionary = entries => ({ objectForKey(key) {
    if (!(key in entries)) throw new Error('Unexpected metadata field: ' + key);
    return entries[key];
  } });
  const records = [dictionary({ kCGWindowOwnerPID: 99 }), dictionary({
    kCGWindowOwnerPID: '42', kCGWindowLayer: '0', kCGWindowNumber: '123',
    kCGWindowBounds: dictionary({ X: -100, Y: 30, Width: 200, Height: 90 }),
  })];
  const reference = {}, castRefToObject = vi.fn(value => {
    expect(value).toBe(reference);
    return { count: '2', objectAtIndex: i => records[i] };
  });
  const context = vm.createContext({ ObjC: { import() {}, castRefToObject, unwrap: value => value },
    $: { CGWindowListCopyWindowInfo: () => reference } });
  vm.runInContext(readFileSync(new URL('../scripts/desktop-environment/windows-macos.jxa', import.meta.url), 'utf8'), context);
  expect(JSON.parse(context.run(['42']))).toEqual({ status: 'available', units: 'global-dip', windows: [window] });
  expect(castRefToObject).toHaveBeenCalledOnce();
});
