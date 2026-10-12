import { z } from 'zod';

/** Shared N0 contract. Host owns request truth and delivery claims; views render it. */
export const NOTIFICATION_PROTOCOL = 1 as const;
const id = z.string().min(1).max(2048);
const counter = z.number().int().nonnegative().safe();
export const notificationPreferencesSchema = z.object({
  notifications: z.boolean().default(true),
  systemNotifications: z.boolean().default(false),
  reminders: z.boolean().default(true),
  reminderDelayMs: z.number().int().min(60_000).max(86_400_000).default(600_000),
}).strict();
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const noticeSchema = z.object({
  id, sessionId: id, turn: counter, seq: counter, time: counter,
  category: z.enum(['completed', 'approval', 'question', 'error', 'stopped', 'interrupted', 'blocked', 'max-tokens']),
  stage: z.enum(['initial', 'reminder']),
  title: z.string().max(256), body: z.string().max(2048),
  requestIds: z.array(id).max(100).default([]),
}).strict();
export type TaskNotice = z.infer<typeof noticeSchema>;
/** Tuple encoding preserves complete identities even when they contain separators. */
export function noticeId(sessionId: string, turn: number, seq: number, category: TaskNotice['category'], stage: TaskNotice['stage']): string {
  return JSON.stringify([sessionId, turn, seq, category, stage]);
}
export function interactionId(sessionId: string, kind: 'approval' | 'question', nativeId: string): string {
  return JSON.stringify([sessionId, kind, nativeId]);
}
export const interactionSchema = z.object({
  id, sessionId: id, nativeId: id, kind: z.enum(['approval', 'question']),
  turn: counter, seq: counter, createdAt: counter, preview: z.string().max(2048),
  state: z.enum(['open', 'continued', 'settled']),
  dueAt: counter.nullable(), automaticReminders: z.number().int().min(0).max(1),
}).strict();
export type PendingInteraction = z.infer<typeof interactionSchema>;
export const runtimeSchema = z.object({
  phase: z.enum(['stopped', 'starting', 'running', 'stopping', 'error']),
  generation: counter, visibilityRevision: counter, visible: z.boolean(),
  suspended: z.boolean(), error: z.string().max(600).optional(),
}).strict();
export type NotificationRuntime = z.infer<typeof runtimeSchema>;
export const deliveryClaimSchema = z.object({
  token: id, clientId: id, generation: counter, visibilityRevision: counter,
  expiresAt: counter, notice: noticeSchema,
}).strict();
export type DeliveryClaim = z.infer<typeof deliveryClaimSchema>;
export const deliveryReceiptSchema = z.object({
  token: id, clientId: id, noticeId: id, generation: counter,
  state: z.enum(['requested', 'shown', 'clicked', 'failed', 'unknown']),
  time: counter, detail: z.string().max(600).optional(),
}).strict();
export type DeliveryReceipt = z.infer<typeof deliveryReceiptSchema>;
export interface NotificationSnapshot {
  protocol: typeof NOTIFICATION_PROTOCOL;
  runtime: NotificationRuntime;
  interactions: PendingInteraction[];
}
export const notificationRequests = {
  claim: z.object({ clientId: id, generation: counter }).strict(),
  receipt: deliveryReceiptSchema,
  snooze: z.object({ interactionId: id, generation: counter }).strict(),
} as const;
/** Paths are carried by authenticated DSH Connection, with server-issued claim tokens. */
export const notificationEndpoints = ['notification-state', 'notification-claim', 'notification-receipt', 'notification-snooze'] as const;

export interface WebNotificationStatus {
  supported: boolean;
  permission: NotificationPermission | 'unavailable';
  osAuthorization: 'unknown';
}
