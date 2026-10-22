const { app, BrowserWindow, screen, powerMonitor } = require('electron');
const assert = require('node:assert/strict');
const { collectWindows, sessionBackend, toDipBounds } = require('./collect.cjs');
const { createKeyboardActivity } = require('../../desktop/keyboard-activity.cjs');
const { initialLockState } = require('../../desktop/lifecycle-state.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setPath('userData', process.env.DSH_DESKTOP_PROBE_PROFILE);
app.on('window-all-closed', () => {});
process.on('disconnect', () => app.exit(1));
const report = { schema: 1, platform: process.platform, arch: process.arch, electron: process.versions.electron,
  session: sessionBackend(process.platform, process.env), scope: 'test-owned-frameless-windows-on-primary-display',
  productRuntimeConnected: false, checks: [], samples: [],
  unverified: ['other-applications', 'decorated-windows', 'transparent-overlays', 'click-through', 'fullscreen',
    'workspace-switch', 'physical-input', 'lock-and-resume', 'multi-display-mixed-dpi', 'resource-budget', 'product-interaction'] };
const windows = [];
const keyboard = createKeyboardActivity();
function closeFixtures() { for (const w of windows) if (!w.isDestroyed()) w.destroy(); }
function near(a, b) { return ['x', 'y', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) <= 2); }
async function sample(label) {
  const s = await collectWindows({ pid: process.pid });
  report.samples.push({ label, ...s, fixtures: windows.map((w, index) => w.isDestroyed()
    ? { index, destroyed: true } : { index, visible: w.isVisible(), bounds: w.getBounds() }) });
  return s;
}
async function expectSample(label, predicate) {
  // Bounded synchronization with the OS; incomplete samples never count as success.
  for (let attempt = 0; attempt < 3; attempt++) {
    await pause(150);
    const s = await sample(label);
    if (s.status === 'available' && predicate(s.windows.map(w => ({ ...w, dip: toDipBounds(w.bounds, s.backend, screen) })))) {
      report.checks.push(label); return s;
    }
    if (['failed', 'unsupported', 'unavailable'].includes(s.status)) throw new Error(`${label}: ${s.status}/${s.reason}`);
  }
  throw new Error(`${label}: native geometry/order did not converge`);
}

async function run() {
  await app.whenReady();
  report.displays = screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor }));
  report.lifecycle = { initial: initialLockState({ monitor: powerMonitor }), controlled: false };
  keyboard.configure(true);
  if (['wayland', 'headless', 'unsupported-platform'].includes(report.session)) {
    report.samples.push({ label: 'session-capability', ...await collectWindows({ pid: process.pid }) });
    report.status = 'unsupported';
    report.unverified.push('desktop-placement', 'global-cursor', 'native-window-geometry');
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  assert.ok(area.width >= 640 && area.height >= 480, 'Probe needs a 640x480 work area');
  report.cursor = screen.getCursorScreenPoint(); // Observation, not an input accuracy test.
  const a = new BrowserWindow({ x: area.x + 40, y: area.y + 50, width: 240, height: 160, frame: false,
    show: false, backgroundColor: '#dcecf5', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  windows.push(a);
  const b = new BrowserWindow({ x: area.x + 320, y: area.y + 70, width: 220, height: 150, frame: false,
    show: false, backgroundColor: '#f3e4cf', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  windows.push(b);
  for (const [index, w] of windows.entries()) {
    await w.loadURL(`data:text/html,${encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><body style="font:20px system-ui;padding:20px">DSH desktop probe ' + (index + 1) + '</body>')}`);
    w.show();
  }
  const requestedA = { x: area.x + 40, y: area.y + 50, width: 240, height: 160 };
  const requestedB = { x: area.x + 320, y: area.y + 70, width: 220, height: 150 };
  let aId, bId;
  await expectSample('enumerate-and-place', list => {
    if (!near(a.getBounds(), requestedA) || !near(b.getBounds(), requestedB) || list.length !== 2) return false;
    const aw = list.find(w => near(w.dip, requestedA)), bw = list.find(w => near(w.dip, requestedB));
    if (!aw || !bw || aw.id === bw.id) return false;
    aId = aw.id; bId = bw.id; return true;
  });
  a.setBounds({ ...requestedA, x: requestedA.x + 65, y: requestedA.y + 45 });
  await expectSample('move-stable-identity', list => near(list.find(w => w.id === aId)?.dip ?? {}, a.getBounds())
    && a.getBounds().x === requestedA.x + 65 && a.getBounds().y === requestedA.y + 45);
  a.setBounds({ ...a.getBounds(), width: 280, height: 190 });
  await expectSample('resize-stable-identity', list => near(list.find(w => w.id === aId)?.dip ?? {}, a.getBounds())
    && a.getBounds().width === 280 && a.getBounds().height === 190);
  b.setBounds({ x: a.getBounds().x + 45, y: a.getBounds().y + 30, width: 220, height: 150 });
  b.moveTop();
  await expectSample('overlap-b-in-front', list => list[0]?.id === bId && list.some(w => w.id === aId)
    && near(list[0].dip, b.getBounds()));
  a.moveTop();
  await expectSample('overlap-a-in-front', list => list[0]?.id === aId && list.some(w => w.id === bId));
  b.hide();
  await expectSample('hidden-window-excluded', list => list.length === 1 && list[0].id === aId);
  b.show();
  await expectSample('show-preserves-identity', list => list.length === 2 && list.some(w => w.id === bId));
  b.destroy();
  await expectSample('closed-window-excluded', list => list.length === 1 && list[0].id === aId);
  a.destroy();
  await expectSample('successful-empty-snapshot', list => list.length === 0);
  report.status = 'passed';
}

run().catch(error => { report.status = 'failed'; report.error = String(error.message).slice(0, 500); }).finally(async () => {
  closeFixtures();
  // Input and lifecycle observations are separate from the window assertions.
  for (let i = 0; i < 20 && keyboard.inspect().status === 'starting'; i++) await pause(100);
  report.keyboard = { ...keyboard.inspect(), physicalInputValidated: false };
  keyboard.configure(false);
  report.cleanup = { windowsDestroyed: windows.every(w => w.isDestroyed()), keyboardStatus: keyboard.inspect().status };
  if (process.send) process.send({ type: 'desktop-probe-result', report }, () => app.exit(report.status === 'passed' ? 0 : 2));
  else app.exit(2);
});
