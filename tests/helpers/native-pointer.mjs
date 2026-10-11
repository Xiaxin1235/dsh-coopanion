import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const warpCursor = `
import ctypes, sys
x11 = ctypes.CDLL('libX11.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XWarpPointer.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_int, ctypes.c_int]
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError('Cannot open the native test display')
x11.XWarpPointer(display, 0, 0, 0, 0, 0, 0, int(sys.argv[1]), int(sys.argv[2]))
x11.XSync(display, 0)
x11.XCloseDisplay(display)
`;

/** Exercise real click-through hit testing, including the OS cursor on X11 and Windows. */
export async function petClick(page, options = {}, twice = false) {
  await page.evaluate(() => {
    if (window.__nativeInputTrace) { window.__nativeInputTrace.length = 0; return; }
    window.__nativeInputTrace = [];
    const record = entry => { window.__nativeInputTrace.push({ t: Math.round(performance.now()), ...entry }); if (window.__nativeInputTrace.length > 100) window.__nativeInputTrace.shift(); };
    window.dshPetBridge.subscribe(message => { if (['cursor', 'hit-state'].includes(message.type)) record(message); });
    for (const type of ['pointermove', 'pointerdown', 'pointerup', 'contextmenu']) document.addEventListener(type, event => {
      const pet = document.getElementById('pet'), box = pet.getBoundingClientRect();
      record({ type, target: `${event.target.tagName}#${event.target.id}`, x: event.clientX, y: event.clientY, nativeHit: pet.dataset.nativeHit, mode: pet.dataset.mode, hidden: pet.hidden, focus: document.hasFocus(), box: { x: box.x, y: box.y, w: box.width, h: box.height } });
    }, true);
  });
  const pet = page.locator('#pet');
  await pet.waitFor({ state: 'visible' });
  // CDP can attach to an inactive target after relaunch. Activate it before
  // ordinary pointer input; the desktop itself continues to show without stealing focus.
  await page.bringToFront();
  if (process.platform === 'linux' && process.env.DISPLAY) {
    // CDP moves a virtual pointer. Enabling native input also generates X11
    // movement at the physical cursor; keep both at the same point as a user.
    const point = await pet.evaluate(el => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(screenX + b.x + b.width / 2), y: Math.round(screenY + b.y + b.height / 2) };
    });
    await run('python3', ['-c', warpCursor, String(point.x), String(point.y)]);
  }
  if (process.platform === 'win32') {
    const point = await pet.evaluate(el => {
      const b = el.getBoundingClientRect();
      return { x: Math.round((screenX + b.x + b.width / 2) * devicePixelRatio), y: Math.round((screenY + b.y + b.height / 2) * devicePixelRatio) };
    });
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class PetCursor { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); }'; if (-not [PetCursor]::SetCursorPos(${point.x}, ${point.y})) { throw 'Cannot move the native test cursor' }`,
    ]);
  }
  await pet.hover();
  await page.waitForSelector('#pet[data-native-hit=true]');
  await pet[twice ? 'dblclick' : 'click'](options);
  if (options.button === 'right') {
    try { await page.locator('#menu').waitFor({ state: 'visible', timeout: 3000 }); }
    catch (error) { console.log('Native pointer failure:', JSON.stringify(await page.evaluate(() => window.__nativeInputTrace))); throw error; }
  }
}
