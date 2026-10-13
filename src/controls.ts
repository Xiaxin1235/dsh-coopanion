import type { DesktopOptions, PetBridge } from './bridge.ts';
import type { NotificationRuntime } from './notification-contract.ts';

export type PetCommand = 'start' | 'show' | 'hide' | 'restart' | 'stop' | 'characters';
export type PetStatus = NotificationRuntime;
export interface NativeLifecycle {
  running: boolean; visible: boolean; error?: string;
  generation?: number; visibilityRevision?: number; suspended?: boolean;
}
export interface StartLifetime { signal: AbortSignal; generation: number; }
interface LifetimeBridge extends PetBridge { start(options: DesktopOptions, lifetime?: StartLifetime): Promise<void>; }
export interface ControlLimits { startTimeoutMs?: number; cleanupTimeoutMs?: number; }

/** Commands own a cancellable native generation. Lifecycle acknowledgements alone establish visibility. */
export class PetControls {
  private state: PetStatus = { phase: 'stopped', visible: false, generation: 0, visibilityRevision: 0, suspended: false };
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private startup?: AbortController;
  private readonly listeners = new Set<(status: PetStatus) => void>();
  private readonly changed = (event: NativeLifecycle) => {
    if (this.disposed || event.generation !== this.state.generation || !Number.isSafeInteger(event.visibilityRevision) || event.visibilityRevision! < this.state.visibilityRevision) return;
    if (event.visibilityRevision === this.state.visibilityRevision && event.visible !== this.state.visible) return;
    if (this.state.phase === 'stopping' || ((this.state.phase === 'stopped' || this.state.phase === 'error') && event.running)) return;
    this.set({ ...this.state, phase: event.error ? 'error' : event.running ? this.state.phase === 'starting' ? 'starting' : 'running' : 'stopped', visible: event.running && event.visible, visibilityRevision: event.visibilityRevision!, suspended: event.suspended ?? false, ...(event.error ? { error: event.error.slice(0, 600) } : {}) });
  };
  constructor(private readonly bridge: PetBridge, private readonly options: () => DesktopOptions, private readonly limits: ControlLimits = {}) {
    bridge.onLifecycle?.(this.changed);
  }
  status(): PetStatus { return { ...this.state }; }
  /** Root assembly registers this listener as a context-owned effect. */
  onState(listener: (status: PetStatus) => void): () => void {
    this.listeners.add(listener); try { listener(this.status()); } catch { /* A view is optional. */ } return () => this.listeners.delete(listener);
  }
  configure(): void { this.bridge.configure?.(this.options()); }
  command(command: PetCommand): Promise<PetStatus> {
    // A stop during a pending launch cancels immediately, before entering the command queue.
    if (command === 'stop' || command === 'restart') this.startup?.abort();
    return this.enqueue(async () => {
      if (this.disposed) throw new Error('桌宠插件已停用');
      try {
        if (command === 'stop' || command === 'restart') {
          this.set({ ...this.state, phase: 'stopping', visible: false, suspended: false });
          await this.cleanup();
          this.set({ ...this.state, phase: 'stopped', visible: false, suspended: false });
        }
        if (command !== 'stop' && command !== 'hide' && this.state.phase !== 'running') {
          const startup = new AbortController(); this.startup = startup;
          this.set({ phase: 'starting', visible: false, generation: this.state.generation + 1, visibilityRevision: 0, suspended: false });
          await this.withDeadline((this.bridge as LifetimeBridge).start(this.options(), { signal: startup.signal, generation: this.state.generation }), this.limits.startTimeoutMs ?? 25_000, '桌宠启动超时', startup.signal);
          if (startup.signal.aborted || this.disposed) throw new Error('桌宠启动已取消');
          this.startup = undefined;
          this.set({ ...this.state, phase: 'running' });
        }
        if (this.state.phase === 'running') this.bridge.control?.(command === 'characters' ? 'characters' : command === 'hide' ? 'hide' : 'show');
        return this.status();
      } catch (error) {
        this.startup?.abort(); this.startup = undefined;
        const cleanup = await this.cleanup().then(() => '', failure => `；清理失败：${this.message(failure)}`);
        this.set({ ...this.state, phase: 'error', visible: false, suspended: false, error: (this.message(error) + cleanup).slice(0, 600) });
        return this.status();
      }
    });
  }
  async dispose(): Promise<void> {
    this.disposed = true; this.startup?.abort();
    this.set({ ...this.state, phase: 'stopping', visible: false, suspended: false });
    await this.enqueue(async () => {
      this.bridge.removeLifecycle?.(this.changed);
      const failure = await this.cleanup().then(() => undefined, error => this.message(error));
      this.set({ ...this.state, phase: failure ? 'error' : 'stopped', visible: false, ...(failure ? { error: failure } : {}) });
      this.listeners.clear();
    });
  }
  private message(error: unknown): string { return String(error instanceof Error ? error.message : error).slice(0, 600); }
  private cleanup(): Promise<void> { return this.withDeadline(Promise.resolve().then(() => this.bridge.dispose()), this.limits.cleanupTimeoutMs ?? 5_000, '桌宠清理超时'); }
  private withDeadline<T>(task: Promise<T>, delay: number, message: string, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error?: unknown, value?: T) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
        if (error) reject(error); else resolve(value as T);
      };
      const aborted = () => finish(new Error('桌宠启动已取消'));
      const timer = setTimeout(() => finish(new Error(message)), delay);
      signal?.addEventListener('abort', aborted, { once: true });
      if (signal?.aborted) aborted();
      task.then(value => finish(undefined, value), error => finish(error));
    });
  }
  private set(state: PetStatus): void {
    this.state = state;
    for (const listener of this.listeners) { try { listener(this.status()); } catch { /* View errors cannot stall native cleanup. */ } }
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(operation); this.queue = pending.catch(() => undefined); return pending;
  }
}
