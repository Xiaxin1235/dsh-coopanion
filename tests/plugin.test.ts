import { it, expect, vi } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { SessionId, SessionSeq, type Session } from '@deepseek-ai/dsh-session';
import { Config, mountPet } from '../src/index.ts';
import type { NativeLifecycle, PetBridge } from '../src/bridge.ts';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { ApprovalRequestId } from '@deepseek-ai/dsh-user-approval';
import { LlmAttemptId } from '@deepseek-ai/dsh-llm';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';

function nativeBridge(): PetBridge {
  const listeners = new Set<(state: NativeLifecycle) => void>(); let generation = 0, revision = 0;
  const bridge: PetBridge = {
    start: vi.fn(async (_options, lifetime) => { generation = lifetime?.generation ?? generation + 1; revision = 1; for (const fn of listeners) fn({ running: true, visible: true, generation, visibilityRevision: revision, suspended: false }); }),
    update: vi.fn(), notify: vi.fn(), dispose: vi.fn(async () => {}), onAction: vi.fn(), removeAction: vi.fn(),
    onLifecycle: fn => { listeners.add(fn); }, removeLifecycle: fn => { listeners.delete(fn); },
    control: vi.fn(command => { for (const fn of listeners) fn({ running: true, visible: command !== 'hide', generation, visibilityRevision: ++revision, suspended: false }); }),
    notificationState: vi.fn(), snoozeResult: vi.fn(),
    presentRole: vi.fn((notice, runtime) => { if (!runtime.visible || runtime.generation !== generation) return false; bridge.notify(notice); return true; }),
  };
  return bridge;
}

it('boots in the durable Harness language and reacts to locale settings independently of notifications', async () => {
  const ctx = new Context(); let preference: string | undefined = 'en';
  ctx.provide('agents', { list: () => [] });
  const describe = vi.fn(() => [{ ns: 'locale', value: { preference } }]);
  ctx.provide('settings', { describe, mutate: vi.fn() });
  const bridge = { ...nativeBridge(), configure: vi.fn() };
  const fiber = ctx.plugin(async ctx => mountPet(ctx, Config({ notifications: false }), bridge));
  try {
    await fiber.await(); await vi.waitFor(() => expect(bridge.start).toHaveBeenCalledOnce());
    expect(bridge.start).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en', notifications: false }), expect.anything());
    expect(describe).toHaveBeenCalledWith({ redactSecrets: true });
    preference = 'zh'; ctx.emit('settings/document-updated', 'locale' as SettingsNamespace, 1);
    expect(bridge.configure).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'zh' }));
    preference = undefined; ctx.emit('settings/document-updated', 'locale' as SettingsNamespace, 2);
    expect(bridge.configure).toHaveBeenLastCalledWith(expect.objectContaining({ locale: undefined }));
  } finally { await fiber.dispose(); await ctx.fiber.dispose(); }
});

it('uses the real Cordis event bus, delegates approval, logs user input through the agent, and releases resources', async () => {
  const ctx = new Context();
  const session = { id: SessionId('live'), header: { origin: undefined, version: 4, id: SessionId('live'), createdAt: 0, isSeeded: false, cwd: '/project/live' } } as Session;
  const followup = vi.fn();
  const agent: Agent = {
    id: session.id, session, followup, ctx, options: {}, status: 'idle',
    inbox: { nextTurn: [], nextStep: [], clear() {}, append() {}, prepend() {}, replace: () => false, remove: () => false, splice: () => [] },
    cancel() {}, send() {}, steer() {}, inject() {}, whenIdle: async () => {},
    runMaintenance: task => task(new AbortController().signal),
  };
  ctx.provide('agents', { list: () => [agent], withInitiator: (_agent: Agent, fn: () => void) => fn() });
  let action: ((action: unknown) => void) | undefined;
  const bridge: PetBridge = { ...nativeBridge(), onAction: fn => { action = fn; }, removeAction: () => { action = undefined; } };
  const fiber = ctx.plugin(async ctx => mountPet(ctx, Config(), bridge));
  await fiber.await();
  await vi.waitFor(() => expect(ctx.coopanion.status().phase).toBe('running'));
  expect(bridge.start).toHaveBeenCalledOnce();
  const fresh = { id: SessionId('fresh'), header: { origin: undefined, version: 4, id: SessionId('fresh'), createdAt: 1, isSeeded: false, cwd: '/project/fresh' } } as Session;
  ctx.emit('session/created', fresh);
  expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'live', mood: 'idle' }));
  ctx.emit('session/event', session, { seq: SessionSeq(0), type: 'turn/start', data: { turn: 1 }, time: 0 });
  expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'live', mood: 'thinking' }));
  ctx.emit('session/event', fresh, { seq: SessionSeq(0), type: 'turn/start', data: { turn: 1 }, time: 0 });
  expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'live', mood: 'thinking' }));
  const attemptId = LlmAttemptId('live-attempt');
  ctx.emit('agent/assistant-stream', { agent, frame: { type: 'start', attemptId, revision: 1, turn: 1, step: 1 } });
  ctx.emit('agent/assistant-stream', { agent, frame: { type: 'chunk', attemptId, revision: 1, index: 0, time: 1, chunk: { type: 'text-delta', index: 0, text: '实时回复' } } });
  await vi.waitFor(() => expect(bridge.update).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'live', results: [], sessions: expect.arrayContaining([expect.objectContaining({ id: 'live', mood: 'talking', reply: '', streaming: true })]) })));
  ctx.emit('session/event', session, { seq: SessionSeq(1), type: 'approval/asked', data: { id: ApprovalRequestId('native-approval'), toolName: 'bash' }, time: 1 });
  const delegated = vi.fn(async () => ({ status: 'denied' }));
  const outcome = await ctx.waterfall('approval/request', { agent, toolName: 'bash' }, delegated as never);
  expect(outcome).toEqual({ status: 'denied' }); expect(delegated).toHaveBeenCalledOnce();
  expect(bridge.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'live · 等你确认', category: 'approval', requestIds: ['[\"live\",\"approval\",\"native-approval\"]'] }));
  ctx.emit('session/event', session, { seq: SessionSeq(2), type: 'approval/decided', data: { id: ApprovalRequestId('native-approval'), outcome: 'rejected' }, time: 2 });
  action?.({ type: 'chat', sessionId: 'live', text: '  你好  ' });
  expect(followup).toHaveBeenCalledWith(expect.objectContaining({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '你好' }] }));
  expect(followup.mock.calls[0][0].id).toBeTruthy();
  action?.({ type: 'chat', sessionId: 'missing', text: 'send somewhere else' });
  action?.({ type: 'chat', sessionId: 'live', text: 'x'.repeat(2001) });
  expect(followup).toHaveBeenCalledTimes(1);
  await fiber.dispose(); expect(action).toBeUndefined(); expect(bridge.dispose).toHaveBeenCalledOnce();
  await ctx.fiber.dispose();
});

it('rejects invalid configuration before starting a desktop process', () => {
  expect(() => Config({ size: 500 })).toThrow();
  expect(() => Config({ bubbleDurationMs: 0 })).toThrow();
});

it('keeps the plugin mounted when launch fails, and honors disabled auto-start', async () => {
  const ctx = new Context(); ctx.provide('agents', { list: () => [] });
  const bridge: PetBridge = { start: vi.fn(async () => { throw new Error('test: no display'); }), update: vi.fn(), notify: vi.fn(), onAction: vi.fn(), removeAction: vi.fn(), dispose: vi.fn(async () => {}) };
  const fiber = ctx.plugin(async scope => mountPet(scope, Config({ autoStart: false }), bridge));
  await fiber.await(); expect(bridge.start).not.toHaveBeenCalled();
  expect(ctx.coopanion.status().phase).toBe('stopped');
  expect((await ctx.coopanion.command('start')).phase).toBe('error');
  expect(ctx.coopanion.status().error).toBe('test: no display');
  await fiber.dispose(); await ctx.fiber.dispose();
});

it('acknowledges desktop preference changes through the shared host configuration', async () => {
  const ctx = new Context(); ctx.provide('agents', { list: () => [] });
  let action: ((value: unknown) => void) | undefined;
  const bridge: PetBridge = { start: vi.fn(async () => {}), update: vi.fn(), notify: vi.fn(), configure: vi.fn(), onAction: fn => { action = fn; }, removeAction: vi.fn(), dispose: vi.fn(async () => {}) };
  const fiber = ctx.plugin(scope => mountPet(scope, Config({ autoStart: false }), bridge)); await fiber.await();
  action?.({ type: 'preference', field: 'roam', value: false });
  await vi.waitFor(() => expect(bridge.configure).toHaveBeenLastCalledWith(expect.objectContaining({ roam: false, notifications: true })));
  action?.({ type: 'preference', field: 'notifications', value: false });
  await vi.waitFor(() => expect(bridge.configure).toHaveBeenLastCalledWith(expect.objectContaining({ roam: false, notifications: false })));
  action?.({ type: 'preference', field: 'electronPath', value: true });
  expect(bridge.configure).toHaveBeenCalledTimes(2);
  await fiber.dispose(); await ctx.fiber.dispose();
});

it('registers and disposes exact authenticated Connection routes without taking over the shared Gateway', async () => {
  const ctx = new Context(); ctx.provide('agents', { list: () => [] });
  const routes = new Map<string, { fetch: (request: Request) => Promise<Response> }>();
  const session = { id: SessionId('existing'), header: { id: SessionId('existing'), cwd: '/existing' } } as Session;
  ctx.provide('sessions', { list: () => [session] } as never);
  ctx.provide('connection', { fetch: { register: (route: { path: string; fetch: (request: Request) => Promise<Response> }) => { routes.set(route.path, route); return () => { routes.delete(route.path); }; } } } as never);
  let action: ((value: unknown) => void) | undefined;
  const bridge: PetBridge = { ...nativeBridge(), onAction: listener => { action = listener; }, focusHarness: vi.fn() };
  const fiber = ctx.plugin(async scope => mountPet(scope, Config({ autoStart: false }), bridge)); await fiber.await();
  expect([...routes.keys()]).toEqual(['status', 'control', 'navigation', 'locale', 'notification-state', 'notification-claim', 'notification-receipt', 'notification-snooze', 'notification-test'].map(endpoint => `/api/coopanion/${endpoint}`));
  const invoke = async (payload: unknown) => {
    const response = await routes.get('/api/coopanion/control')!.fetch(new Request('http://localhost/api/coopanion/control', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: 'coopanion/control', payload }) }));
    return response.json();
  };
  expect((await invoke({ command: 'start', electronPath: '/untrusted' })).result.ok).toBe(false);
  expect(bridge.start).not.toHaveBeenCalled();
  const language = async (payload: unknown) => (await routes.get('/api/coopanion/locale')!.fetch(new Request('http://localhost/api/coopanion/locale', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'locale-test', method: 'coopanion/locale', payload }) }))).json();
  expect((await language({ locale: 'en', extra: true })).result.ok).toBe(false);
  expect((await language({ locale: 'en-US' })).result.ok).toBe(false);
  expect((await language({ locale: 'zh' })).result).toEqual({ ok: true, value: { locale: 'zh' } });
  expect((await language({ locale: 'en' })).result).toEqual({ ok: true, value: { locale: 'en' } });
  await routes.get('/api/coopanion/notification-state')!.fetch(new Request('http://localhost/api/coopanion/notification-state', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'legacy', method: 'coopanion/notification-state', payload: { locale: 'zh' } }) }));
  expect(await invoke({ command: 'start' })).toEqual({ type: 'server-response', rpcId: 'test', result: { ok: true, value: { phase: 'running', visible: true, generation: 1, visibilityRevision: 2, suspended: false } } });
  expect(bridge.start).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }), expect.anything());
  const malformed = await routes.get('/api/coopanion/status')!.fetch(new Request('http://localhost/api/coopanion/status', { method: 'POST', body: '{}' }));
  expect(malformed.status).toBe(400);
  expect(bridge.update).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'existing' }));
  action?.({ type: 'chat', sessionId: 'existing', text: '不能静默丢弃' });
  expect(bridge.notify).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'existing', title: '会话尚未就绪' }));
  const navigation = async () => (await routes.get('/api/coopanion/navigation')!.fetch(new Request('http://localhost/api/coopanion/navigation', { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'nav', method: 'coopanion/navigation', payload: {} }) }))).json();
  action?.({ type: 'open-session', sessionId: 'unknown' }); expect((await navigation()).result.value).toBeNull();
  expect(bridge.focusHarness).not.toHaveBeenCalled();
  action?.({ type: 'open-session', sessionId: 'existing' });
  expect((await navigation()).result.value).toEqual({ sessionId: 'existing' });
  expect((await navigation()).result.value).toBeNull(); // Claimed only once.
  expect(bridge.focusHarness).toHaveBeenCalledOnce();
  await fiber.dispose(); expect(routes.size).toBe(0); await ctx.fiber.dispose();
});
