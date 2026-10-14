import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import type { PetSnapshot, PetNotice } from './model.ts';
import type { NotificationRuntime, NotificationSnapshot, TaskNotice } from './notification-contract.ts';

export interface StartLifetime { signal: AbortSignal; generation: number; }
export interface NativeLifecycle { running: boolean; visible: boolean; error?: string; generation?: number; visibilityRevision?: number; suspended?: boolean; }

export interface DesktopOptions { size: number; roam: boolean; notifications: boolean; bubbleDurationMs: number; electronPath?: string; locale?: string; systemNotifications?: boolean; reminders?: boolean; reminderDelayMs?: number; }
export interface PetBridge {
  start(options: DesktopOptions, lifetime?: StartLifetime): Promise<void>;
  update(snapshot: PetSnapshot): void;
  notify(notice: PetNotice | TaskNotice): void;
  notificationState?(snapshot: NotificationSnapshot): void;
  snoozeResult?(interactionId: string, ok: boolean, error?: string): void;
  presentRole?(notice: TaskNotice, runtime: NotificationRuntime): boolean;
  onAction(listener: (action: unknown) => void): void;
  removeAction(listener: (action: unknown) => void): void;
  dispose(): Promise<void>;
  configure?(options: DesktopOptions): void;
  control?(command: 'show' | 'hide' | 'characters'): void;
  focusHarness?(): void;
  onLifecycle?(listener: (state: NativeLifecycle) => void): void;
  removeLifecycle?(listener: (state: NativeLifecycle) => void): void;
}

/** Owns a separate Electron window; no changes or private IPC in the Harness desktop shell are needed. */
export class ElectronBridge extends EventEmitter implements PetBridge {
  private child?: ChildProcess;
  private latest?: PetSnapshot;
  private resultKey?: string;
  private closing = false;

  private generation = 0;
  private visibilityRevision = 0;
  private nativeVisible = false;
  private suspended = false;
  private lastNotificationState?: NotificationSnapshot;

  async start(options: DesktopOptions, lifetime?: StartLifetime): Promise<void> {
    if (this.child) throw new Error('Desktop pet is already running');
    if (lifetime?.signal.aborted) throw new Error('桌宠启动已取消');
    this.closing = false;
    this.generation = lifetime?.generation ?? this.generation + 1;
    this.visibilityRevision = 0; this.nativeVisible = false; this.suspended = false;
    if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) throw new Error('桌宠需要桌面显示环境。');
    const executable: string = options.electronPath ?? createRequire(import.meta.url)('electron');
    const env: NodeJS.ProcessEnv = { ...process.env, DSH_PET_GENERATION: String(this.generation) };
    delete (env as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE;
    const args = [fileURLToPath(new URL('../desktop/main.cjs', import.meta.url))];
    if (env.DSH_PET_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox');
    const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const generation = this.generation; this.child = child;
    let diagnostic = '';
    child.stderr?.on('data', data => { diagnostic = (diagnostic + data.toString()).slice(-4000); });
    child.on('message', message => {
      if (this.child !== child || !isRecord(message)) return;
      if (message.type === 'action') this.emit('action', message.action);
      if (message.type === 'tray-state') this.emit('tray-state', message.state);
      if (message.type === 'tray-icon') this.emit('tray-icon', message);
      if (message.type === 'visibility' && message.generation === generation && typeof message.visible === 'boolean' && Number.isSafeInteger(message.visibilityRevision) && (message.visibilityRevision as number) > this.visibilityRevision) {
        this.visibilityRevision = message.visibilityRevision as number;
        this.nativeVisible = message.visible; this.suspended = message.suspended === true;
        this.emit('lifecycle', { running: true, visible: this.nativeVisible, generation, visibilityRevision: this.visibilityRevision, suspended: this.suspended });
      }
    });
    child.once('exit', (code, signal) => {
      if (this.child !== child) return;
      this.child = undefined; this.nativeVisible = false;
      const error = !this.closing && (code !== 0 || signal) ? `桌宠进程已退出 (${signal ?? code})` : undefined;
      this.emit('lifecycle', { running: false, visible: false, generation, visibilityRevision: ++this.visibilityRevision, suspended: false, ...(error ? { error } : {}) });
      if (error) this.emit('failure', new Error(error));
    });
    await new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = (error?: Error) => {
        if (done) return; done = true;
        clearTimeout(timer); child.off('message', ready); child.off('error', failed); child.off('exit', exited); lifetime?.signal.removeEventListener('abort', aborted);
        if (error) { child.kill(); reject(error); } else resolve();
      };
      const ready = (message: unknown) => {
        if (isRecord(message) && message.type === 'ready' && this.child === child && !lifetime?.signal.aborted) {
          this.send({ type: 'init', options, snapshot: this.latest && desktopSnapshot(this.latest, true) });
          if (this.lastNotificationState) this.notificationState(this.lastNotificationState);
          finish();
        }
      };
      const failed = (error: Error) => finish(error);
      const exited = (code: number | null, signal: string | null) => finish(new Error(`桌宠启动失败 (${signal ?? code}): ${diagnostic}`));
      const aborted = () => finish(new Error('桌宠启动已取消'));
      const timer = setTimeout(() => finish(new Error(`桌宠未能在 20 秒内启动: ${diagnostic}`)), 20000);
      child.on('message', ready); child.once('error', failed); child.once('exit', exited);
      lifetime?.signal.addEventListener('abort', aborted, { once: true });
      if (lifetime?.signal.aborted) aborted();
    });
    child.on('error', error => { if (this.child === child && !this.closing) this.emit('failure', error); });
  }

  update(snapshot: PetSnapshot): void {
    this.latest = snapshot;
    const key = snapshot.results.map(result => `${result.id}:${result.read}`).join('|');
    this.send({ type: 'snapshot', snapshot: desktopSnapshot(snapshot, key !== this.resultKey) });
    this.resultKey = key;
  }
  notify(notice: PetNotice | TaskNotice): void { this.send({ type: 'notice', notice }); }
  notificationState(snapshot: NotificationSnapshot): void { this.lastNotificationState = structuredClone(snapshot); this.send({ type: 'notification-state', snapshot }); }
  snoozeResult(interactionId: string, ok: boolean, error?: string): void { this.send({ type: 'notification-snooze-result', interactionId, ok, ...(error ? { error: error.slice(0, 600) } : {}) }); }
  presentRole(notice: TaskNotice, runtime: NotificationRuntime): boolean {
    if (!this.child?.connected || this.closing || !this.nativeVisible || this.suspended || runtime.generation !== this.generation || runtime.visibilityRevision !== this.visibilityRevision || !runtime.visible) return false;
    this.send({ type: 'notice', notice, generation: runtime.generation, visibilityRevision: runtime.visibilityRevision }); return true;
  }
  onAction(listener: (action: unknown) => void): void { this.on('action', listener); }
  removeAction(listener: (action: unknown) => void): void { this.off('action', listener); }
  // JSON IPC omits undefined. An explicit null lets a cleared Harness
  // preference restore the renderer's automatic language instead of retaining
  // its previous locale during a merged configuration update.
  configure(options: DesktopOptions): void { this.send({ type: 'configure', options: { ...options, locale: options.locale ?? null } }); }
  control(command: 'show' | 'hide' | 'characters'): void { this.send({ type: 'control', command }); }
  focusHarness(): void { this.send({ type: 'control', command: 'focus-harness' }); }
  onLifecycle(listener: (state: NativeLifecycle) => void): void { this.on('lifecycle', listener); }
  removeLifecycle(listener: (state: NativeLifecycle) => void): void { this.off('lifecycle', listener); }
  private send(message: object): void {
    if (this.child?.connected) this.child.send(message, error => { if (error && !this.closing) this.emit('failure', error); });
  }

  async dispose(): Promise<void> {
    this.closing = true;
    const child = this.child;
    if (!child) return;
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) { if (this.child === child) this.child = undefined; return; }
    await new Promise<void>((resolve, reject) => {
      let deadline: ReturnType<typeof setTimeout>;
      const timer = setTimeout(() => { child.kill('SIGKILL'); deadline = setTimeout(() => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else reject(new Error('桌宠进程未确认退出')); }, 1000); }, 3000);
      child.once('exit', () => { clearTimeout(timer); clearTimeout(deadline); resolve(); });
      if (child.connected) child.send({ type: 'quit' }, error => { if (error) child.kill(); }); else child.kill();
    });
    if (this.child === child) this.child = undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

/** Stream animation updates carry metadata; full result text crosses IPC only when it changes. */
function desktopSnapshot(snapshot: PetSnapshot, includeResults: boolean) {
  const { results, ...state } = snapshot;
  return { ...state, text: state.mood === 'happy' ? '' : state.text,
    sessions: state.sessions.map(session => ({ ...session, text: session.mood === 'happy' ? '' : session.text, reply: '' })),
    ...(includeResults ? { results } : {}),
  };
}
