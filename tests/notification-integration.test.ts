import { it, expect, vi } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { SessionStore, SessionId } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { UserQuestionService } from '@deepseek-ai/dsh-user-questions';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { ApprovalRequestId } from '@deepseek-ai/dsh-user-approval';
import { Config, mountPet } from '../src/index.ts';
import type { NativeLifecycle, PetBridge } from '../src/bridge.ts';

function setup() {
  const ctx = new Context(); new SessionProjectionRegistry(ctx); new SessionStore(ctx); new UserQuestionService(ctx);
  const session = ctx.sessions.create(SessionId('source-full-identity'));
  const agent = { session, ctx, status: 'idle' } as Agent;
  ctx.provide('agents', { list: () => [agent] });
  const routes = new Map<string, { fetch(request: Request): Promise<Response> }>();
  ctx.provide('connection', { fetch: { register: (route: { path: string; fetch(request: Request): Promise<Response> }) => { routes.set(route.path, route); return () => routes.delete(route.path); } } } as never);
  let lifecycle: ((state: NativeLifecycle) => void) | undefined, generation = 0, revision = 0;
  const role = vi.fn(() => true);
  const bridge: PetBridge = {
    start: async (_options, life) => { generation = life!.generation; lifecycle?.({ running: true, visible: true, generation, visibilityRevision: ++revision }); },
    control: command => lifecycle?.({ running: true, visible: command !== 'hide', generation, visibilityRevision: ++revision }),
    onLifecycle: fn => { lifecycle = fn; }, removeLifecycle: () => { lifecycle = undefined; },
    onAction: vi.fn(), removeAction: vi.fn(), update: vi.fn(), notify: vi.fn(), notificationState: vi.fn(), presentRole: role, dispose: vi.fn(async () => {}),
  };
  const invoke = async (endpoint: string, payload: unknown = {}) => {
    const response = await routes.get(`/api/coopanion/${endpoint}`)!.fetch(new Request(`http://localhost/api/coopanion/${endpoint}`, { method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'integration', method: `coopanion/${endpoint}`, payload }) }));
    return (await response.json()).result;
  };
  return { ctx, session, agent, bridge, role, routes, invoke };
}

it('mounts Harness without waiting for native startup and cancels startup on unload', async () => {
  const { ctx, bridge } = setup(); let aborted = false;
  bridge.start = vi.fn((_options, life) => new Promise<void>((_resolve, reject) => {
    life!.signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')); }, { once: true });
  }));
  const scope = ctx.plugin(child => mountPet(child, Config(), bridge));
  try {
    await scope.await();
    await vi.waitFor(() => expect(ctx.coopanion.status().phase).toBe('starting'));
    const controls = ctx.coopanion;
    await scope.dispose(); expect(aborted).toBe(true);
    expect(controls.status().phase).toBe('stopped');
  } finally { await ctx.fiber.dispose(); }
});

it('uses native visibility and exact audit identity for claims, accepts late evidence without another channel', async () => {
  const { ctx, session, bridge, role, invoke, routes } = setup();
  const scope = ctx.plugin(child => mountPet(child, Config({ systemNotifications: true }), bridge));
  try {
    await scope.await(); await vi.waitFor(() => expect(ctx.coopanion.status().phase).toBe('running'));
    await ctx.coopanion.command('hide');
    session.append('turn/start', { turn: 1 });
    const native = ApprovalRequestId('approval-native-full');
    session.append('approval/asked', { id: native, toolName: 'bash' });
    const before = await invoke('notification-state'); expect(before.value.interactions).toHaveLength(1);
    const first = await invoke('notification-claim', { clientId: 'client-full', generation: before.value.runtime.generation });
    expect(first.value.notice.sessionId).toBe(session.id); expect(role).not.toHaveBeenCalled();
    await ctx.coopanion.command('show');
    expect(role).not.toHaveBeenCalled();
    expect((await invoke('notification-claim', { clientId: 'other', generation: before.value.runtime.generation })).value).toBeNull();
    const base = { token: first.value.token, clientId: 'client-full', generation: before.value.runtime.generation, noticeId: first.value.notice.id, time: Date.now() };
    expect((await invoke('notification-receipt', { ...base, token: 'wrong', state: 'requested' })).value.accepted).toBe(false);
    expect((await invoke('notification-receipt', { ...base, state: 'requested' })).value.accepted).toBe(true);
    expect((await invoke('notification-receipt', { ...base, state: 'shown' })).value.accepted).toBe(true);
    // Viewing/clicking preserves pending approval; only the audit decision settles it.
    expect((await invoke('notification-receipt', { ...base, state: 'clicked' })).value.accepted).toBe(true);
    expect((await invoke('notification-state')).value.interactions).toHaveLength(1);
    session.append('approval/decided', { id: native, outcome: 'allowed-once' });
    expect((await invoke('notification-state')).value.interactions).toHaveLength(0);
    await scope.dispose(); expect(routes.size).toBe(0);
  } finally { await ctx.fiber.dispose(); }
});

it('delegates public blocking questions and settles only after the original answerer finishes', async () => {
  const { ctx, agent, session, bridge, invoke, role } = setup();
  const scope = ctx.plugin(child => mountPet(child, Config(), bridge));
  try {
    await scope.await(); await vi.waitFor(() => expect(ctx.coopanion.status().phase).toBe('running'));
    session.append('turn/start', { turn: 1 });
    let answer!: (value: { answers: [] }) => void;
    const delegate = vi.fn(() => new Promise<{ answers: [] }>(resolve => { answer = resolve; }));
    const request = ctx.waterfall('user-questions/request', { agent, questions: [{ id: 'full-question', question: 'Choose an option' }] }, delegate as never);
    await vi.waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    const pending = (await invoke('notification-state')).value.interactions;
    expect(pending).toHaveLength(1); expect(pending[0].source).toBe('runtime'); expect(pending[0].preview).toBe('Choose an option');
    expect(role).toHaveBeenCalledWith(expect.objectContaining({ source: 'runtime', category: 'question' }), expect.anything());
    expect((await invoke('notification-snooze', { interactionId: pending[0].id, generation: ctx.coopanion.status().generation })).ok).toBe(true);
    expect((await invoke('notification-state')).value.interactions).toHaveLength(1);
    answer({ answers: [] }); await request;
    expect((await invoke('notification-state')).value.interactions).toHaveLength(0);
  } finally { await scope.dispose(); await ctx.fiber.dispose(); }
});
