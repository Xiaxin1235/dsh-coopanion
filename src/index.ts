import { randomUUID } from 'node:crypto';
import type { Context, Volatile } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-connection';
import type {} from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-user-approval';
import type {} from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-session-projection';
import { SessionId, type Session } from '@deepseek-ai/dsh-session';
import { NotificationBroker, type NotificationEvent } from './notification-broker.ts';
import { notificationPreferencesSchema, notificationEndpoints, notificationRequests, noticeId } from './notification-contract.ts';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import z from '@deepseek-ai/schemastery';
import { ElectronBridge, isRecord, type PetBridge, type DesktopOptions } from './bridge.ts';
import { PetModel } from './model.ts';
import { PetControls } from './controls.ts';
import { z as wire } from 'zod';

export const name = 'dsh-coopanion';
export const inject = ['agents'];
export interface Config {
  size: Volatile<number>; roam: Volatile<boolean>; notifications: Volatile<boolean>;
  systemNotifications: Volatile<boolean>; reminders: Volatile<boolean>; reminderDelayMs: Volatile<number>;
  bubbleDurationMs: Volatile<number>; autoStart: Volatile<boolean>; electronPath?: string;
}
export const Config = z.object({
  size: z.number().min(90).max(240).default(180).volatile(),
  roam: z.boolean().default(true).volatile(),
  notifications: z.boolean().default(true).volatile(),
  systemNotifications: z.boolean().default(false).volatile(),
  reminders: z.boolean().default(true).volatile(),
  reminderDelayMs: z.number().step(1).min(60000).max(86400000).default(600000).volatile(),
  bubbleDurationMs: z.number().min(2000).max(60000).default(12000).volatile(),
  autoStart: z.boolean().default(true).volatile(),
  electronPath: z.string(),
});

/** Mounts the pet on public Harness events, delegates approvals, and routes explicit user chat to a selected live agent. */
export async function apply(ctx: Context, config: Config): Promise<void> {
  ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
  await mountPet(ctx, config, new ElectronBridge());
}

/** Shared assembly used by integration tests with an IPC substitute for the native window. */
export async function mountPet(ctx: Context, options: Config, bridge: PetBridge): Promise<void> {
  const model = new PetModel();
  const preferences: Partial<Pick<DesktopOptions, 'roam' | 'notifications'>> = {};
  let savePreference: ((field: 'roam' | 'notifications', value: boolean) => Promise<void>) | undefined;
  ctx.inject(['settings'], child => { savePreference = (field, value) => child.settings.mutate('dsh-coopanion', [{ op: 'set', path: [field], value }]); });
  const currentOptions = (): DesktopOptions => ({ size: options.size.get(), roam: options.roam.get(), notifications: options.notifications.get(), bubbleDurationMs: options.bubbleDurationMs.get(), systemNotifications: options.systemNotifications.get(), reminders: options.reminders.get(), reminderDelayMs: options.reminderDelayMs.get(), electronPath: options.electronPath, locale, ...preferences });
  const controls = new PetControls(bridge, currentOptions);
  let locale = 'zh';
  let navigation: { sessionId: string; expires: number } | undefined;
  ctx.provide('coopanion', controls);
  const update = () => {
    const snapshot = model.snapshot(), live = new Set<string>(ctx.agents.list().map(agent => agent.session.id));
    bridge.update({ ...snapshot, sessions: snapshot.sessions.map(session => ({ ...session, chatAvailable: live.has(session.id) })) });
  };
  let mounted = false;
  const notificationPrefs = () => notificationPreferencesSchema.parse({ notifications: currentOptions().notifications, systemNotifications: options.systemNotifications.get(), reminders: options.reminders.get(), reminderDelayMs: options.reminderDelayMs.get() });
  const syncNotifications = () => {
    if (!mounted) return;
    const snapshot = broker.snapshot(); model.interactions(snapshot.interactions); bridge.notificationState?.(snapshot); update();
  };
  const broker = new NotificationBroker({ changed: syncNotifications, presentRole: (value, runtime) => bridge.presentRole?.(value, runtime) ?? false });
  broker.preferences(notificationPrefs());
  ctx.effect(() => () => broker.dispose());
  ctx.effect(() => controls.onState(state => broker.runtime(state)));
  let questions: ((session: Session, live?: boolean) => void) | undefined;
  ctx.inject(['sessionProjections', 'userQuestions'], child => {
    const sync = (session: Session, live = true) => {
      try {
        const view = child.sessionProjections.snapshot(session, ['userQuestions']).values.userQuestions;
        if (view) broker.questions(session, view, live);
      } catch (error) { child.logger.warn(`Question projection unavailable: ${String(error).slice(0, 300)}`); }
    };
    questions = sync;
    child.effect(() => () => { if (questions === sync) questions = undefined; });
    // A service is provided before its constructor registers projection units.
    // Fold after that registration turn, including sessions without a live agent.
    queueMicrotask(() => {
      if (!mounted || questions !== sync) return;
      for (const session of child.get('sessions')?.list() ?? ctx.agents.list().map(agent => agent.session)) sync(session, false);
    });
  });
  let testSource: (() => Promise<Session>) | undefined;
  ctx.inject(['sessions', 'sessionController'], child => {
    let source: Promise<Session> | undefined;
    const create = () => source ??= child.sessionController.create({ sessionId: SessionId(`coopanion-notification-test-${randomUUID()}`), cwd: process.cwd() }).then(value => {
      const session = child.sessions.get(value.sessionId); if (!session) throw new Error('Notification test source unavailable'); return session;
    }).catch(error => { source = undefined; throw error; });
    testSource = create; child.effect(() => () => { if (testSource === create) testSource = undefined; });
  });
  let streamUpdate: ReturnType<typeof setTimeout> | undefined;
  ctx.effect(() => () => clearTimeout(streamUpdate));
  ctx.effect(() => () => controls.dispose());
  ctx.effect(() => {
    const timer = setInterval(() => { if (model.settle()) update(); }, 250);
    timer.unref(); return () => clearInterval(timer);
  });
  ctx.on('settings/document-updated', ns => { if (ns === 'dsh-coopanion') { broker.preferences(notificationPrefs()); controls.configure(); } });
  ctx.inject(['connection'], child => {
    const dispatch = async (endpoint: string, payload: unknown, signal: AbortSignal) => {
      try {
        if (signal.aborted) throw new Error('请求已取消');
        if (endpoint === 'status') {
          wire.object({}).strict().parse(payload);
          return { ok: true, value: controls.status() };
        }
        if (endpoint === 'navigation') {
          wire.object({}).strict().parse(payload);
          const value = navigation && navigation.expires > Date.now() ? { sessionId: navigation.sessionId } : null;
          navigation = undefined;
          return { ok: true, value };
        }
        if (endpoint === 'notification-state') { const input = notificationRequests.state.parse(payload); if (input.locale && input.locale !== locale) { locale = input.locale; controls.configure(); } return { ok: true, value: broker.snapshot() }; }
        if (endpoint === 'notification-claim') { const input = notificationRequests.claim.parse(payload); return { ok: true, value: broker.claim(input.clientId, input.generation) }; }
        if (endpoint === 'notification-receipt') { return { ok: true, value: { accepted: broker.receipt(notificationRequests.receipt.parse(payload)) } }; }
        if (endpoint === 'notification-snooze') { const input = notificationRequests.snooze.parse(payload); if (!broker.snooze(input.interactionId, input.generation)) throw new Error('待处理请求已变化或提醒暂不可用'); return { ok: true, value: { accepted: true } }; }
        if (endpoint === 'notification-test') {
          const input = notificationRequests.test.parse(payload), state = broker.snapshot().runtime, prefs = notificationPrefs();
          if (!testSource || state.phase !== 'running' || state.visible || state.suspended || state.visibilityRevision === 0 || input.generation !== state.generation || !prefs.notifications || !prefs.systemNotifications) throw new Error('请启动并隐藏角色，开启系统通知后测试');
          const session = await testSource();
          if (signal.aborted) throw new Error('请求已取消');
          const latest = broker.snapshot().runtime;
          if (latest.generation !== state.generation || latest.visibilityRevision !== state.visibilityRevision || latest.phase !== 'running' || latest.visible || latest.suspended) throw new Error('桌宠状态已变化');
          const turn = (session.snapshotEvents().findLast(event => event.type === 'turn/start')?.data as { turn?: number } | undefined)?.turn ?? 0;
          session.append('turn/start', { turn: turn + 1 });
          session.append('turn/end', { turn: turn + 1, reason: { kind: 'completed' } });
          const event = session.snapshotEvents().at(-1)!;
          const claim = broker.claim(input.clientId, input.generation, noticeId(session.id, turn + 1, event.seq, 'completed', 'initial'));
          if (!claim) throw new Error('测试通知未能领取，请稍后重试');
          return { ok: true, value: claim };
        }
        if (endpoint !== 'control') throw new Error('未知的桌宠操作');
        const { command } = wire.object({ command: wire.enum(['start', 'show', 'hide', 'restart', 'stop', 'characters']) }).strict().parse(payload);
        return { ok: true, value: await controls.command(command) };
      } catch (error) { return { ok: false, error: { code: 'coopanion/rejected', message: String(error instanceof Error ? error.message : error).slice(0, 600), details: {} } }; }
    };
    // Exact Connection routes coexist with the Gateway's exclusive /api interceptor.
    // The Connection carrier applies its normal Host/Origin and authentication checks.
    for (const endpoint of ['status', 'control', 'navigation', ...notificationEndpoints] as const) {
      child.effect(() => child.connection.fetch.register({
        path: `/api/coopanion/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
        fetch: async request => {
          const parsed = wire.object({ type: wire.literal('client-request'), rpcId: wire.string().min(1).max(128), method: wire.literal(`coopanion/${endpoint}`), payload: wire.unknown() }).strict().safeParse(await request.json().catch(() => undefined));
          if (!parsed.success) return Response.json({ error: 'Invalid desktop pet request' }, { status: 400 });
          return Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result: await dispatch(endpoint, parsed.data.payload, request.signal) });
        },
      }));
    }
  });
  ctx.inject(['sessions'], child => { for (const session of child.sessions.list()) { model.restore(session); broker.restore(session); questions?.(session, false); } syncNotifications(); update(); });
  for (const agent of ctx.agents.list()) { model.restore(agent.session); broker.restore(agent.session); questions?.(agent.session, false); if (agent.status === 'running') model.running(agent.session); }
  ctx.on('session/created', session => { model.created(session); broker.restore(session); questions?.(session, false); update(); });
  ctx.on('agent/created', ({ agent }) => { model.restore(agent.session); broker.restore(agent.session); questions?.(agent.session, false); if (agent.status === 'running') model.running(agent.session); update(); return undefined; });
  ctx.on('agent/status', ({ agent, status }) => { if (status === 'running') model.running(agent.session); else model.idle(agent.session.id); update(); });
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (!model.stream(agent.session, frame) || streamUpdate) return;
    // Coalesce high-frequency provider deltas; durable events still publish immediately.
    streamUpdate = setTimeout(() => { streamUpdate = undefined; update(); }, 40);
  });
  ctx.on('agent/disposed', ({ agent }) => { model.idle(agent.session.id); model.detached(agent.session.id); update(); });
  ctx.on('session/event', (session, event) => { broker.consume(session, event); model.consume(session, event); questions?.(session); syncNotifications(); update(); });
  ctx.on('session/disposed', session => { broker.remove(session.id); model.remove(session.id); update(); });
  ctx.inject(['userQuestions'], child => {
    child.on('user-questions/request', async (request, next) => {
      const session = request.agent?.session;
      if (!session || session.header.origin === 'subagent') return next();
      model.observe(session);
      const events: readonly NotificationEvent[] = session.snapshotEvents();
      const callId = request.wait?.callId;
      const origin = callId ? events.findLast(event => (event.type === 'tool/call' && event.data.callId === callId) || (event.type === 'tool/ptc-dispatch' && event.data.subCallId === callId)) : undefined;
      const anchor = origin ?? events.at(-1);
      const turnEvent = events.findLast(event => event.type === 'turn/start');
      const finish = broker.question(session, { nativeId: origin && callId ? callId : randomUUID(), turn: turnEvent?.type === 'turn/start' ? turnEvent.data.turn : 0, seq: anchor?.seq ?? 0, preview: request.questions.map(q => q.question).join('\n'), signal: request.signal, source: origin ? 'event' : 'runtime' });
      questions?.(session); syncNotifications();
      try { return await next(); }
      finally { questions?.(session); finish(); syncNotifications(); }
    });
  });
  const onAction = (action: unknown) => {
    if (!isRecord(action)) return;
    if (action.type === 'notification-snooze') {
      const input = notificationRequests.snooze.safeParse({ interactionId: action.interactionId, generation: action.generation });
      const ok = input.success && broker.snooze(input.data.interactionId, input.data.generation);
      if (typeof action.interactionId === 'string') bridge.snoozeResult?.(action.interactionId, ok, ok ? undefined : '待处理请求已变化或提醒暂不可用');
      syncNotifications(); return;
    }
    if (action.type === 'preference' && (action.field === 'roam' || action.field === 'notifications') && typeof action.value === 'boolean') {
      const field = action.field, value = action.value;
      void (async () => {
        try {
          if (savePreference) await savePreference(field, value); else preferences[field] = value;
          broker.preferences(notificationPrefs()); controls.configure();
        } catch { bridge.notify({ title: '设置未能保存', body: '请回到 Harness 检查插件设置。', sessionId: model.snapshot().sessionId ?? '' }); }
      })(); return;
    }
    if (action.type === 'select' && typeof action.sessionId === 'string') { model.select(action.sessionId); update(); return; }
    if (action.type === 'read' && typeof action.resultId === 'string') { if (model.read(action.resultId)) update(); return; }
    if (action.type === 'open-session' && typeof action.sessionId === 'string') {
      if (!model.select(action.sessionId)) return;
      navigation = { sessionId: action.sessionId, expires: Date.now() + 30000 };
      bridge.focusHarness?.(); update(); return;
    }
    if (action.type !== 'chat' || typeof action.text !== 'string' || typeof action.sessionId !== 'string') return;
    const text = action.text.trim();
    if (!text || text.length > 2000 || !model.select(action.sessionId)) return;
    const id = model.snapshot().sessionId;
    const agent = ctx.agents.list().find(agent => agent.session.id === id);
    if (!agent || agent.session.header.origin === 'subagent') {
      bridge.notify({ title: '会话尚未就绪', body: '请先回到 Harness 打开这个会话，然后再发送消息。', sessionId: action.sessionId }); update(); return;
    }
    try {
      ctx.agents.withInitiator(agent, () => agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })));
      update();
    } catch (error) {
      bridge.notify({ title: '消息未能发送', body: '请回到 Harness 检查会话状态。', sessionId: action.sessionId });
      ctx.logger.warn(`Desktop pet chat failed: ${String(error)}`);
    }
  };
  ctx.effect(() => { bridge.onAction(onAction); return () => bridge.removeAction(onAction); });
  if (bridge instanceof ElectronBridge) {
    const onFailure = (error: Error) => ctx.logger.warn(error.message);
    ctx.effect(() => { bridge.on('failure', onFailure); return () => bridge.off('failure', onFailure); });
  }
  mounted = true; syncNotifications(); update();
  if (options.autoStart.get()) {
    void controls.command('start').then(status => { if (status.error) ctx.logger.warn(status.error); }, error => ctx.logger.warn(String(error).slice(0, 600)));
  }
}

declare module '@deepseek-ai/cordis' { interface Context { coopanion: PetControls; } }
