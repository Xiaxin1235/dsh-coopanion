import { afterEach, expect, it, vi } from 'vitest';
import { NotificationClient } from '../src/client/notification-client.ts';
import { SystemNotifications } from '../src/client/system-notifications.ts';
import type { DeliveryClaim, DeliveryReceipt, NotificationSnapshot } from '../src/notification-contract.ts';

const state: NotificationSnapshot = { protocol: 1, runtime: { phase: 'running', visible: false, generation: 3, visibilityRevision: 2, suspended: false }, interactions: [] };
const claim: DeliveryClaim = { token: 'lease-full', clientId: 'ui-one', generation: 3, visibilityRevision: 2, expiresAt: 20000,
  notice: { id: 'notice-full', sessionId: 'session-full-not-prefix', turn: 1, seq: 9, time: 1, category: 'question', stage: 'initial', title: 'Question', body: 'Choose?', requestIds: ['request-full'] } };
function fixture() {
  vi.useFakeTimers();
  const receipt = vi.fn(async (_value: DeliveryReceipt, _signal: AbortSignal) => {}), open = vi.fn();
  const objects: Api[] = [];
  class Api {
    static permission: NotificationPermission = 'granted'; static requestPermission = vi.fn(async () => Api.permission);
    onshow: (() => void) | null = null; onclick: (() => void) | null = null; onerror: (() => void) | null = null; onclose: (() => void) | null = null; close = vi.fn();
    constructor(public title: string, public options: unknown) { objects.push(this); }
  }
  let current = structuredClone(state), next: DeliveryClaim | null = structuredClone(claim), prefs = { notifications: true, systemNotifications: true, reminders: true, reminderDelayMs: 600000 };
  const transport = { state: vi.fn(async (_signal: AbortSignal) => current), claim: vi.fn(async (_value: { clientId: string; generation: number }, _signal: AbortSignal) => { const result = next; next = null; return result; }), receipt,
    snooze: vi.fn(async (_value: { interactionId: string; generation: number }, _signal: AbortSignal) => {}) };
  const service = new NotificationClient({ transport, preferences: () => prefs, api: Api, openSession: open, clientId: 'ui-one', now: () => 100, pollMs: 100, timeoutMs: 1000,
    testClaim: vi.fn(async () => structuredClone(claim)) });
  return { service, transport, Api, objects, open, prefs, current, setState: (value: NotificationSnapshot) => { current = value; }, setClaim: (value: DeliveryClaim) => { next = value; } };
}
afterEach(() => { vi.useRealTimers(); });
const tick = async (ms = 0) => vi.advanceTimersByTimeAsync(ms);

it('runs outside Settings and reports only requested until the browser supplies show/click', async () => {
  const f = fixture(); f.service.start(); await tick();
  expect(f.objects).toHaveLength(1); expect(f.transport.receipt.mock.calls.map(call => (call[0] as any).state)).toEqual(['requested']);
  f.objects[0]!.onshow!(); f.objects[0]!.onshow!(); await tick(100);
  expect(f.service.getSnapshot()).toMatchObject({ connected: true, delivery: 'shown', web: { osAuthorization: 'unknown' } });
  f.objects[0]!.onclick!(); await tick(100); expect(f.open).toHaveBeenCalledExactlyOnceWith(claim.notice.sessionId);
  expect(f.objects[0]!.onclick).toBeNull(); expect(f.objects[0]!.close).not.toHaveBeenCalled();
  f.service.dispose();
});
it('does not claim while visible, stopped, suspended, permission-denied or opted out', async () => {
  for (const mode of ['visible', 'stopped', 'suspended', 'denied', 'opted-out']) {
    const f = fixture();
    if (mode === 'visible') f.current.runtime.visible = true;
    if (mode === 'stopped') f.current.runtime.phase = 'stopped';
    if (mode === 'suspended') f.current.runtime.suspended = true;
    if (mode === 'denied') f.Api.permission = 'denied';
    if (mode === 'opted-out') f.prefs.systemNotifications = false;
    f.service.start(); await tick(); expect(f.transport.claim).not.toHaveBeenCalled(); expect(f.objects).toHaveLength(0); f.service.dispose();
  }
});
it('rechecks visibility and generation after claiming; a visible pet prevents system delivery', async () => {
  const f = fixture(); f.transport.state.mockResolvedValueOnce(state).mockResolvedValueOnce({ ...state, runtime: { ...state.runtime, visible: true, visibilityRevision: 3 } });
  f.service.start(); await tick(); expect(f.objects).toHaveLength(0);
  expect(f.transport.receipt).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed', detail: 'delivery-state-changed' }), expect.any(AbortSignal)); f.service.dispose();
  const newer = fixture(); newer.setClaim({ ...claim, generation: 2 }); newer.service.start(); await tick(); expect(newer.objects).toHaveLength(0); newer.service.dispose();
});
it('rejects claims for another client and contains malformed state', async () => {
  const f = fixture(); f.setClaim({ ...claim, clientId: 'other' }); f.service.start(); await tick();
  expect(f.objects).toHaveLength(0); expect(f.service.getSnapshot().error).toMatch(/another client/); f.service.dispose();
  const broken = fixture(); broken.transport.state.mockResolvedValue({ ...state, protocol: 0 } as any); broken.service.start(); await tick();
  expect(broken.service.getSnapshot()).toMatchObject({ connected: false, error: 'Invalid notification state' }); broken.service.dispose();
});
it('disconnect and new generation release callbacks; recovery resumes polling and disposal aborts requests', async () => {
  const f = fixture(); f.service.start(); await tick(); const click = f.objects[0]!.onclick;
  f.transport.state.mockRejectedValueOnce(new Error('Disconnected')); await tick(100); expect(f.objects[0]!.onclick).toBeNull(); click!(); expect(f.open).not.toHaveBeenCalled();
  await tick(100); expect(f.service.getSnapshot().connected).toBe(true);
  f.setClaim({ ...claim, token: 'second' }); await tick(100); const show = f.objects[1]!.onshow;
  f.current.runtime.generation++; await tick(100); show!(); expect(f.service.getSnapshot().delivery).toBe('requested');
  f.transport.state.mockImplementation(async signal => new Promise<NotificationSnapshot>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')))));
  await tick(100); f.service.dispose(); await tick(); expect(f.transport.state.mock.calls.at(-1)?.[0].aborted).toBe(true);
});
it('bounds hung requests, retries failed receipts, and serializes test/poll receipt flushes', async () => {
  const f = fixture(); f.transport.state.mockImplementationOnce(async () => new Promise<NotificationSnapshot>(() => {})); f.service.start(); await tick(1001);
  expect(f.service.getSnapshot().connected).toBe(false); expect(f.service.getSnapshot().error).toMatch(/timed out|cancelled/);
  f.transport.receipt.mockRejectedValueOnce(new Error('offline')); await tick(100); expect(f.service.getSnapshot().delivery).toBe('requested'); await tick(100);
  expect(f.transport.receipt.mock.calls.filter(call => (call[0] as any).state === 'requested')).toHaveLength(2);
  f.service.dispose();
});
it('applies user permission requests only on explicit action and validates snooze against live exact identities', async () => {
  const f = fixture(); f.Api.permission = 'default'; f.service.start(); await tick(); expect(f.Api.requestPermission).not.toHaveBeenCalled();
  await f.service.requestPermission(); expect(f.Api.requestPermission).toHaveBeenCalledTimes(1);
  f.current.interactions = [{ id: 'request-full', nativeId: 'native-full', sessionId: claim.notice.sessionId, kind: 'question', turn: 1, seq: 9, createdAt: 1, preview: 'Choose?', state: 'continued', dueAt: 200, automaticReminders: 1 }];
  await f.service.snooze('request-full'); expect(f.transport.snooze).toHaveBeenCalledWith({ interactionId: 'request-full', generation: 3 }, expect.any(AbortSignal));
  await expect(f.service.snooze('request')).rejects.toThrow('no longer pending'); expect(f.transport.snooze).toHaveBeenCalledTimes(1); f.service.dispose();
});
it('reports unknown without a show receipt and bounds notification callbacks while preserving OS history', async () => {
  const f = fixture(), receipt = vi.fn(); const system = new SystemNotifications(f.Api, receipt, f.open, () => 100, { active: 2, tokens: 4 });
  system.deliver(claim); await tick(10000); expect(receipt).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'unknown' }));
  const late = f.objects[0]!.onclick;
  system.deliver({ ...claim, token: 'second' }); system.deliver({ ...claim, token: 'third' });
  expect(f.objects[0]!.onclick).toBeNull(); late!(); expect(f.open).not.toHaveBeenCalled();
  f.objects[1]!.onclose!(); expect(f.objects[1]!.onclick).toBeNull(); system.dispose(); expect(f.objects.every(object => object.onclick === null)).toBe(true);
  expect(f.objects.every(object => object.close.mock.calls.length === 0)).toBe(true); f.service.dispose();
});

it('contains source-session navigation failure and keeps the native click receipt truthful', () => {
  const f = fixture(), receipt = vi.fn(), system = new SystemNotifications(f.Api, receipt, () => { throw new Error('deleted source'); }, () => 100);
  system.deliver(claim);
  expect(() => f.objects[0]!.onclick!()).not.toThrow();
  expect(receipt).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'clicked', detail: 'open-session-failed' }));
  expect(f.objects[0]!.onclick).toBeNull(); system.dispose(); f.service.dispose();
});
