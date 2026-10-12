const { app, BrowserWindow, ipcMain, powerMonitor, screen, Menu, Tray, nativeImage, shell } = require('electron');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { CharacterStore } = require('../dist/character-store.cjs');
const { createPetServer } = require('../dist/figure-server.cjs');
const { trayState } = require('./tray-state.cjs');
app.setName('DeepSeek 大肥鱼');
if (process.env.DSH_PET_TEST_DATA_DIR) {
  app.setPath('userData', process.env.DSH_PET_TEST_DATA_DIR);
  app.setPath('crashDumps', join(process.env.DSH_PET_TEST_DATA_DIR, 'crashes'));
}
if (process.platform === 'win32') app.setAppUserModelId('dev.takboo.dsh-coopanion');

// Used only by the virtual-display test; normal installations retain Chromium's sandbox.
if (process.env.DSH_PET_TEST_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
if (process.env.DSH_PET_TEST_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  app.commandLine.appendSwitch('remote-debugging-port', process.env.DSH_PET_TEST_DEBUG_PORT);
}
let win, tray, options, lastFrame, poll, assetServer, characters;
let presentation = {}, lastTrayKey, lastIconKey, iconBase, iconAppearance;
let interactive = null;
const generation = Number(process.env.DSH_PET_GENERATION ?? 1);
let visibilityRevision = 0, suspended = false, screenLocked = false, systemAsleep = false;
function visibility() { if (win && !win.isDestroyed()) { process.send?.({ type: 'visibility', generation, visibilityRevision: ++visibilityRevision, visible: win.isVisible(), suspended }); syncTray(); } }
function forward(message) { if (win && !win.isDestroyed()) win.webContents.send('pet:update', message); }
function hit(active) {
  if (!win || win.isDestroyed()) return;
  if (active !== interactive) {
    interactive = active;
    win.setIgnoreMouseEvents(!active, { forward: true });
  }
  forward({ type: 'hit-state', active, focused: win.isFocused(), visible: win.isVisible() });
}
function show() { win?.showInactive(); syncTray(); }
function act(action) { process.send?.({ type: 'action', action }); }
function syncTray() {
  if (!tray || tray.isDestroyed()) return;
  const state = trayState(lastFrame?.snapshot, presentation, options, win?.isVisible());
  const key = JSON.stringify(state);
  if (key === lastTrayKey) return;
  lastTrayKey = key;
  tray.setToolTip(state.tooltip);
  if (process.platform === 'darwin') tray.setTitle(state.title);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `${state.name} · ${state.stateLabel}`, enabled: false },
    { label: state.sessionLabel, enabled: false },
    { label: '回到当前会话', enabled: !!state.sessionId, click: () => act({ type: 'open-session', sessionId: state.sessionId }) },
    { label: '切换陪伴会话', enabled: !!state.sessions.length, submenu: state.sessions.slice(0, 20).map(session => ({ type: 'radio', label: `${session.label} · ${session.id.replace(/^session[-_:]/, '').slice(-8)}${session.unread ? ` · ${session.unread} 份未读` : ''}${['waiting', 'error'].includes(session.mood) ? ' · 需要你' : ''}`, checked: session.selected, click: () => act({ type: 'select', sessionId: session.id }) })) },
    { label: `待查看 · ${state.activity.unread} 份回复 · ${state.activity.waiting + state.activity.errors} 段需要你`, click: () => { show(); forward({ type: 'ui-control', command: 'sessions' }); } },
    { type: 'separator' },
    { label: '说句话', click: () => { show(); forward({ type: 'ui-control', command: 'chat' }); } },
    { label: '角色与配色', click: () => { show(); forward({ type: 'characters' }); } },
    { label: '自在走动', type: 'checkbox', checked: state.roam, click: item => act({ type: 'preference', field: 'roam', value: item.checked }) },
    { label: '休息一下（新任务会唤醒）', type: 'checkbox', checked: state.sleeping, enabled: !state.active, click: () => forward({ type: 'ui-control', command: 'sleep' }) },
    { label: '任务提醒', type: 'checkbox', checked: state.notifications, click: item => act({ type: 'preference', field: 'notifications', value: item.checked }) },
    { label: '动作与说话音效', type: 'checkbox', checked: state.sound, click: () => forward({ type: 'ui-control', command: 'sound' }) },
    { type: 'separator' },
    { label: state.visible ? '暂时藏起来' : '显示伙伴', click: () => state.visible ? win.hide() : show() },
    { label: '关闭桌宠', click: () => app.quit() },
  ]));
  process.send?.({ type: 'tray-state', state });
  const iconKey = `${state.characterId}:${state.scheme}:${state.iconReady}:${state.icon}`;
  if (iconKey !== lastIconKey) { lastIconKey = iconKey; void syncIcon(state, iconKey); }
}
async function syncIcon(state, key) {
  try {
    const appearance = `${state.characterId}:${state.scheme}:${state.iconReady}`;
    let icon = iconAppearance === appearance ? iconBase : undefined;
    if (!icon) {
      const view = await characters.load(state.characterId);
      const thumb = view.presets.find(preset => preset.id === state.scheme)?.thumb ?? view.thumb;
      icon = nativeImage.createFromPath(join(__dirname, 'icon.png')).toDataURL();
      if (thumb && /\.(png|webp|jpe?g|svg)$/i.test(thumb)) {
        const response = await fetch(new URL(view.base + thumb, win.webContents.getURL()));
        const bytes = Buffer.from(await response.arrayBuffer());
        if (response.ok && bytes.length < 2 * 1024 * 1024) {
          if (/\.svg$/i.test(thumb)) icon = `data:image/svg+xml;base64,${bytes.toString('base64')}`;
          else { const image = nativeImage.createFromBuffer(bytes); if (!image.isEmpty()) icon = image.toDataURL(); }
        }
      }
      iconBase = icon; iconAppearance = appearance;
    }
    const template = process.platform === 'darwin';
    const url = await win.webContents.executeJavaScript(`import('./tray-icon.js').then(m => m.trayIcon(${JSON.stringify(icon)}, ${JSON.stringify({ icon: state.icon })}, ${template}))`);
    const rendered = nativeImage.createFromDataURL(url).resize({ height: template ? 20 : 24 }); rendered.setTemplateImage(template);
    if (tray && !tray.isDestroyed() && lastIconKey === key) {
      tray.setImage(rendered);
      process.send?.({ type: 'tray-icon', icon: state.icon, template: rendered.isTemplateImage(), title: state.title });
    }
  } catch { /* Keep the packaged icon when a pack thumbnail cannot be rendered. */ }
}
function bounds() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  return display.workArea;
}

process.on('message', message => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'quit') { app.quit(); return; }
  if (message.type === 'init') { options = message.options; lastFrame = message; forward(message); syncTray(); }
  if (message.type === 'configure') { options = message.options; if (lastFrame) lastFrame.options = options; forward(message); syncTray(); }
  if (message.type === 'control') {
    if (message.command === 'hide') win?.hide();
    if (message.command === 'show' || message.command === 'characters') show();
    if (message.command === 'characters') forward({ type: 'characters' });
    // Fixed public Desktop protocol; no renderer-supplied URL or private shell IPC.
    if (message.command === 'focus-harness' && process.env.DSH_PET_TEST_NO_SANDBOX !== '1') void shell.openExternal('dsh://open').catch(() => {});
  }
  if (message.type === 'snapshot') { lastFrame = { type: 'init', options, snapshot: { ...message.snapshot, results: message.snapshot.results ?? lastFrame?.snapshot?.results ?? [] } }; forward(message); syncTray(); }
  if (message.type === 'notification-state' || message.type === 'notification-snooze-result') forward(message);
  if (message.type === 'notice') {
    if (message.generation !== undefined && (message.generation !== generation || message.visibilityRevision !== visibilityRevision || !win?.isVisible() || suspended)) return;
    forward(message);
  }
});
process.on('disconnect', () => app.quit());
process.on('SIGTERM', () => app.quit());

app.whenReady().then(async () => {
  const webRoot = join(__dirname, '../web');
  characters = new CharacterStore(join(app.getPath('userData'), 'figures-v2'), join(webRoot, 'upstream/whale'));
  const prefix = `/${randomBytes(24).toString('hex')}/`;
  assetServer = createPetServer({ webRoot, store: characters, prefix });
  assetServer.listen(0, '127.0.0.1'); await once(assetServer, 'listening');
  let characterOperation = Promise.resolve();
  const characterCall = (channel, operation) => ipcMain.handle(channel, (event, value) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) return { ok: false, error: '无效的角色请求' };
    const result = characterOperation.then(async () => {
      try { return { ok: true, value: await operation(value) }; }
      catch (error) { return { ok: false, error: String(error.message ?? error).slice(0, 400) }; }
    });
    characterOperation = result.then(() => undefined);
    return result;
  });
  const characterId = value => { if (typeof value !== 'string') throw new Error('无效的角色 id'); return value; };
  characterCall('pet:characters:list', () => characters.list());
  characterCall('pet:characters:load', value => characters.load(characterId(value)));
  characterCall('pet:characters:select', value => {
    if (!value || typeof value.scheme !== 'string') throw new Error('无效的角色配色');
    return characters.select(characterId(value.id), value.scheme);
  });
  characterCall('pet:characters:remove', value => characters.remove(characterId(value)));
  characterCall('pet:characters:import', value => {
    if (!(value instanceof ArrayBuffer)) throw new Error('请选择 API 2 ZIP 角色包');
    return characters.import(new Uint8Array(value));
  });
  win = new BrowserWindow({ ...screen.getPrimaryDisplay().workArea, transparent: true, frame: false, resizable: false, skipTaskbar: true, hasShadow: false, show: false, alwaysOnTop: true, backgroundColor: '#00000000', webPreferences: { preload: join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.setAlwaysOnTop(true, 'floating');
  win.on('show', visibility); win.on('hide', visibility);
  const suspendState = () => { suspended = screenLocked || systemAsleep; visibility(); };
  powerMonitor.on('suspend', () => { systemAsleep = true; suspendState(); });
  powerMonitor.on('resume', () => { systemAsleep = false; suspendState(); });
  powerMonitor.on('lock-screen', () => { screenLocked = true; suspendState(); });
  powerMonitor.on('unlock-screen', () => { screenLocked = false; suspendState(); });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.platform === 'darwin') app.dock?.hide();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.on('did-finish-load', () => { if (lastFrame) forward(lastFrame); });
  ipcMain.on('pet:hit', (event, active) => { if (event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && typeof active === 'boolean') hit(active); });
  ipcMain.on('pet:action', (event, action) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !action || typeof action !== 'object') return;
    if (action.type === 'hide') { win.hide(); return; }
    if (action.type === 'move-display') { win.setBounds(bounds()); forward({ type: 'display-changed' }); return; }
    if (action.type === 'presentation') {
      if (typeof action.characterId !== 'string' || !/^[a-z0-9-]{1,32}$/.test(action.characterId) || typeof action.scheme !== 'string' || action.scheme.length > 200 || typeof action.name !== 'string' || action.name.length > 200 || typeof action.sleeping !== 'boolean' || typeof action.sound !== 'boolean') return;
      presentation = { characterId: action.characterId, scheme: action.scheme, name: action.name, sleeping: action.sleeping, sound: action.sound, ready: action.ready === true }; syncTray(); return;
    }
    if (action.type === 'notification-snooze') { if (typeof action.interactionId === 'string' && action.interactionId.length <= 2048 && Number.isSafeInteger(action.generation)) act(action); return; }
    if (action.type !== 'chat' && action.type !== 'select' && action.type !== 'open-session' && action.type !== 'preference' && action.type !== 'read') return;
    process.send?.({ type: 'action', action });
  });
  hit(false);
  await win.loadURL(`http://127.0.0.1:${assetServer.address().port}${prefix}`);
  show();
  // Restore input when a click-through window misses movement, without repeatedly
  // overriding the renderer's newer pointer event with a stationary OS cursor.
  let lastCursor;
  const pollCursor = () => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    const next = { x: p.x - b.x, y: p.y - b.y };
    if (next.x === lastCursor?.x && next.y === lastCursor?.y) return;
    lastCursor = next; forward({ type: 'cursor', ...next });
  };
  pollCursor(); poll = setInterval(pollCursor, 100);
  const icon = nativeImage.createFromPath(join(__dirname, 'icon.png')).resize({ height: 24 });
  tray = new Tray(icon); syncTray();
  tray.on('click', show);
  screen.on('display-removed', () => { win.setBounds(screen.getPrimaryDisplay().workArea); forward({ type: 'display-changed' }); });
  screen.on('display-metrics-changed', () => { const b = win.getBounds(); win.setBounds(screen.getDisplayMatching(b).workArea); forward({ type: 'display-changed' }); });
  process.send?.({ type: 'ready' });
}).catch(error => { console.error(error); app.exit(1); });

app.on('before-quit', () => { clearInterval(poll); assetServer?.close(); tray?.destroy(); });
app.on('window-all-closed', () => app.quit());
