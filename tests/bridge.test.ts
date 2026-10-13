import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ElectronBridge } from '../src/bridge.ts';

it.skipIf(process.platform === 'win32')('releases a process that exits by signal before the ready handshake', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pet-failure-'));
  const previous = process.env.WAYLAND_DISPLAY;
  process.env.WAYLAND_DISPLAY = 'test-only';
  const bridge = new ElectronBridge();
  try {
    const binary = join(folder, 'exits-before-ready');
    await writeFile(binary, '#!/bin/sh\nkill -TERM $$\n', { mode: 0o700 });
    await expect(bridge.start({ size: 150, roam: false, notifications: false, bubbleDurationMs: 12000, electronPath: binary })).rejects.toThrow('SIGTERM');
    await expect(bridge.dispose()).resolves.toBeUndefined();
  } finally {
    if (previous === undefined) delete process.env.WAYLAND_DISPLAY; else process.env.WAYLAND_DISPLAY = previous;
    await bridge.dispose(); await rm(folder, { recursive: true, force: true });
  }
});

it.skipIf(process.platform === 'win32')('aborts a live startup and confirms its process exits without waiting for the handshake timeout', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pet-cancel-'));
  const previous = process.env.WAYLAND_DISPLAY; process.env.WAYLAND_DISPLAY = 'test-only';
  const bridge = new ElectronBridge(), controller = new AbortController();
  try {
    const binary = join(folder, 'waits-for-ready');
    await writeFile(binary, '#!/bin/sh\nexec sleep 30\n', { mode: 0o700 });
    const startup = bridge.start({ size: 150, roam: false, notifications: false, bubbleDurationMs: 12000, electronPath: binary }, { signal: controller.signal, generation: 9 });
    const assertion = expect(startup).rejects.toThrow('启动已取消'); controller.abort();
    await assertion; await expect(bridge.dispose()).resolves.toBeUndefined();
  } finally {
    if (previous === undefined) delete process.env.WAYLAND_DISPLAY; else process.env.WAYLAND_DISPLAY = previous;
    await bridge.dispose(); await rm(folder, { recursive: true, force: true });
  }
});
