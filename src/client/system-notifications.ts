import type { DeliveryClaim, DeliveryReceipt, WebNotificationStatus } from '../notification-contract.ts';

export interface BrowserNotification {
  onshow: (() => void) | null;
  onclick: (() => void) | null;
  onerror: (() => void) | null;
  close(): void;
}
export interface BrowserNotificationApi {
  new(title: string, options: { body: string; tag: string; silent: boolean }): BrowserNotification;
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
}
/** Standard renderer path: the containing browser or signed DSH application owns identity. */
export class SystemNotifications {
  private readonly active = new Map<string, BrowserNotification>();
  private readonly requested = new Set<string>();
  private disposed = false;
  constructor(
    private readonly api: BrowserNotificationApi | undefined,
    private readonly receipt: (value: DeliveryReceipt) => void,
    private readonly openSession: (sessionId: string) => void,
    private readonly now: () => number = Date.now,
  ) {}
  status(): WebNotificationStatus {
    return { supported: !!this.api, permission: this.api?.permission ?? 'unavailable', osAuthorization: 'unknown' };
  }
  /** Call only from the user's enable action. Browser permission is distinct from OS authorization. */
  async requestPermission(): Promise<WebNotificationStatus> {
    if (!this.disposed && this.api?.permission === 'default') await this.api.requestPermission();
    return this.status();
  }
  deliver(claim: DeliveryClaim): void {
    if (this.disposed || this.requested.has(claim.token)) return;
    this.requested.add(claim.token);
    const report = (state: DeliveryReceipt['state'], detail?: string) => this.receipt({
      token: claim.token, clientId: claim.clientId, noticeId: claim.notice.id,
      generation: claim.generation, state, time: this.now(), ...(detail ? { detail } : {}),
    });
    if (this.now() >= claim.expiresAt) { report('failed', 'claim-expired'); return; }
    if (!this.api || this.api.permission !== 'granted') { report('failed', 'web-permission-unavailable'); return; }
    try {
      const notification = new this.api(claim.notice.title, { body: claim.notice.body, tag: claim.notice.id, silent: true });
      this.active.set(claim.token, notification);
      notification.onshow = () => { if (!this.disposed) report('shown'); };
      notification.onerror = () => { if (!this.disposed) report('failed', 'notification-error'); };
      notification.onclick = () => {
        if (this.disposed) return;
        report('clicked'); this.openSession(claim.notice.sessionId);
      };
      report('requested');
    } catch { report('failed', 'notification-construction-failed'); }
  }
  /** Release callbacks while letting the operating system manage delivered notification history. */
  dispose(): void {
    this.disposed = true;
    for (const notification of this.active.values()) notification.onshow = notification.onclick = notification.onerror = null;
    this.active.clear(); this.requested.clear();
  }
}
