import { CompletionTracker } from './completion.ts';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { AssistantStreamFrame } from '@deepseek-ai/dsh-agent';
import type { UserQuestionProjectionView } from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-tools';
import type { TaskNotice } from './notification-contract.ts';

export type WorkActivity = 'idle' | 'preparing' | 'requesting' | 'reasoning' | 'generating' | 'tool-arguments' | 'tools' | 'recovering' | 'unknown';
export interface WorkRequest { id: string; kind: 'approval' | 'question'; state?: 'open' | 'continued'; intent?: 'plan-review'; }
export interface WorkFact {
  sessionId: string; epoch: number; revision: number;
  driver: 'idle' | 'running' | 'unknown'; running: boolean; activity: WorkActivity;
  category: TaskNotice['category'] | 'working' | 'unknown';
  requests: WorkRequest[]; tools: { pending: number; entered: number };
  goal: ReturnType<CompletionTracker['goalSnapshot']>;
  needsAttention: boolean; problem: 'capacity' | null;
  resultId: string | null; cue: { id: string; kind: string } | null;
}
const exceptional = new Set(['error', 'blocked', 'interrupted', 'max-tokens']);
/** One trusted live source attachment. Methods accept public metadata only.
 * Durable seq and transient attempt order are independent. Restore never emits
 * historical cues; a replacement source MUST use a higher owner-issued epoch.
 */
export class WorkFacts {
  private completion = new CompletionTracker();
  private seq = -1; private turn = 0; private ended = -1; private revision = 0;
  private driver: WorkFact['driver'] = 'idle'; private driverObserved = false;
  private activity: WorkActivity = 'idle'; private category: WorkFact['category'] = 'reply';
  private acknowledged = false; private restoring = false;
  private approvals = new Set<string>();
  private questionStates = new Map<string, { revision: number; state: 'open' | 'continued' | 'settled'; intent?: 'plan-review'; projected?: boolean }>();
  private questionRevision = -1;
  private calls = new Map<string, boolean>();
  private stream: { id: string; revision: number; index: number } | null = null;
  private streamRevision = -1; private failedAttempt = false;
  private cue: WorkFact['cue'] = null; private cueSerial = 0; private resultId: string | null = null;
  private problem: WorkFact['problem'] = null;
  constructor(private sessionId: string, private epoch = 1) {
    if (!Number.isSafeInteger(epoch) || epoch < 1) throw Error('Invalid source epoch');
  }
  snapshot(): WorkFact {
    return { sessionId: this.sessionId, epoch: this.epoch, revision: this.revision,
      driver: this.driver, running: this.driver === 'running',
      activity: this.driver === 'unknown' ? 'unknown' : this.calls.size ? 'tools' : this.driver === 'idle' ? 'idle' : this.activity,
      category: this.category, requests: [...[...this.approvals].map(id => ({ id, kind: 'approval' as const, state: 'open' as const })),
        ...[...this.questionStates].filter(([, q]) => q.state !== 'settled').map(([id, q]) => ({ id, kind: 'question' as const, state: q.state as 'open' | 'continued', ...(q.intent ? { intent: q.intent } : {}) }))],
      tools: { pending: this.calls.size, entered: [...this.calls.values()].filter(Boolean).length },
      goal: this.completion.goalSnapshot(), needsAttention: !!this.problem || exceptional.has(this.category) && !this.acknowledged,
      problem: this.problem, resultId: this.resultId, cue: this.cue ? { ...this.cue } : null };
  }
  private publish() { this.revision++; return this.snapshot(); }
  private pulse(kind: string, identity?: string) {
    if (!this.restoring) this.cue = { id: JSON.stringify([this.sessionId, this.epoch, identity ?? ++this.cueSerial, kind]), kind };
  }
  status(status: WorkFact['driver'], epoch = this.epoch): WorkFact | undefined {
    if (epoch !== this.epoch || !['idle','running','unknown'].includes(status)) return;
    this.driverObserved = true;
    if (this.driver === status) return;
    this.driver = status;
    if (status !== 'running') { this.stream = null; if (status === 'idle') this.calls.clear(); this.activity = status === 'idle' ? 'idle' : 'unknown'; }
    else { this.activity = 'preparing'; this.category = 'working'; this.acknowledged = false; }
    return this.publish();
  }
  restore(events: readonly SessionEvent[], status: 'idle' | 'running', questions?: UserQuestionProjectionView) {
    this.restoring = true;
    try { for (const event of events) this.consume(event); if (questions) this.questions(questions, 0); this.status(status); }
    finally { this.restoring = false; this.acknowledged = true; this.cue = null; this.resultId = null; }
    return this.publish();
  }
  streamFrame(frame: AssistantStreamFrame, epoch = this.epoch): WorkFact | undefined {
    if (epoch !== this.epoch || this.driver !== 'running') return;
    if (frame.type === 'start') {
      if (frame.turn < this.turn || frame.turn <= this.ended || frame.revision <= this.streamRevision) return;
      this.streamRevision = frame.revision; this.stream = { id: frame.attemptId, revision: frame.revision, index: -1 };
      this.activity = 'requesting';
      if (this.failedAttempt) { this.pulse('retry'); this.failedAttempt = false; }
    } else {
      const stream = this.stream;
      if (!stream || stream.id !== frame.attemptId || frame.revision <= this.streamRevision || frame.index <= stream.index) return;
      stream.index = frame.index; this.streamRevision = frame.revision;
      if (frame.type === 'end') { this.stream = null; this.activity = frame.outcome.kind === 'abandoned' ? 'recovering' : 'preparing'; }
      else if (frame.chunk.type === 'reasoning-delta') this.activity = 'reasoning';
      else if (frame.chunk.type === 'text-delta') this.activity = 'generating';
      else if (frame.chunk.type === 'tool-call-delta') this.activity = 'tool-arguments';
      else return;
    }
    return this.publish();
  }
  requestFailed(epoch = this.epoch): WorkFact | undefined {
    if (epoch !== this.epoch || this.driver !== 'running') return;
    this.failedAttempt = true; this.activity = 'recovering'; this.pulse('request-failed'); return this.publish();
  }
  consume(event: SessionEvent, epoch = this.epoch): WorkFact | undefined {
    if (epoch !== this.epoch || !Number.isSafeInteger(event.seq) || event.seq <= this.seq) return;
    this.seq = event.seq;
    const decision = this.completion.consume(event);
    // Settlements use exact native identity even when their source turn is older.
    if (event.type === 'approval/decided') {
      if (!this.approvals.delete(String(event.data.id))) return;
      this.pulse('approval-' + event.data.outcome, String(event.seq)); return this.publish();
    }
    if ('turn' in event.data && typeof event.data.turn === 'number' && event.data.turn < this.turn) return;
    if (event.type === 'turn/start') {
      if (event.data.turn <= this.ended || event.data.turn === this.turn && this.category === 'working') return;
      this.turn = event.data.turn; this.driver = 'running'; this.category = 'working'; this.activity = 'preparing';
      this.acknowledged = false; this.stream = null; this.calls.clear(); this.pulse('work-start', String(event.seq));
    } else if (event.type === 'turn/end') {
      if (event.data.turn <= this.ended) return;
      this.turn = this.ended = event.data.turn; this.stream = null; this.calls.clear(); this.approvals.clear();
      if (!this.driverObserved) this.driver = 'idle';
      this.activity = 'preparing'; const kind = event.data.reason.kind;
      if (kind === 'forked') { this.category = 'reply'; this.acknowledged = true; return this.publish(); }
      this.category = kind === 'completed' ? decision?.category ?? 'reply' : kind === 'aborted' ? 'stopped' : exceptional.has(kind) ? kind as WorkFact['category'] : 'unknown';
      this.acknowledged = this.restoring || kind === 'interrupted';
      this.resultId = JSON.stringify([this.sessionId, event.data.turn, event.seq, this.category]);
      if (kind !== 'interrupted') this.pulse(this.category, String(event.seq));
    } else if (event.type === 'goal/change') {
      if (decision) {
        this.category = decision.clear ? 'reply' : decision.category; this.acknowledged = this.restoring;
        if (!decision.silent) { this.resultId = JSON.stringify([this.sessionId,event.seq,this.category]); this.pulse(this.category, String(event.seq)); }
      }
    } else if (event.type === 'step/start') { this.activity = 'requesting'; }
    else if (event.type === 'step/end') { this.activity = 'preparing'; }
    else if (event.type === 'tool/call' || event.type === 'tool/ptc-dispatch-start') {
      if (this.driver !== 'running') return;
      const id = event.type === 'tool/call' ? event.data.callId : event.data.subCallId;
      if (!this.calls.has(id) && this.calls.size >= 128) this.problem = 'capacity';
      else this.calls.set(id, event.type === 'tool/ptc-dispatch-start');
    } else if (event.type === 'tool/result' || event.type === 'tool/ptc-dispatch') {
      const id = event.type === 'tool/result' ? event.data.message.toolCallId : event.data.subCallId;
      if (!this.calls.delete(id)) return;
      const error = event.type === 'tool/result' ? event.data.message.isError : event.data.isError;
      if (error) this.pulse('tool-error', String(event.seq)); this.activity = 'preparing';
    } else if (event.type === 'approval/asked') {
      if (this.driver !== 'running') return;
      if (!this.approvals.has(String(event.data.id)) && this.approvals.size >= 64) this.problem = 'capacity';
      else { this.approvals.add(String(event.data.id)); this.pulse('approval', String(event.seq)); }
    } else return;
    return this.publish();
  }
  /** Full public projection; caller issues a monotonic revision per attachment. */
  questions(view: UserQuestionProjectionView, revision: number, epoch = this.epoch): WorkFact | undefined {
    if (epoch !== this.epoch || !Number.isSafeInteger(revision) || revision <= this.questionRevision) return;
    this.questionRevision = revision;
    const active = new Set(view.active.map(q => String(q.callId)));
    for (const [id, q] of this.questionStates) if (q.projected && !active.has(id)) this.question(id, revision, 'settled', q.intent, true);
    for (const q of view.active) this.question(String(q.callId), revision, q.state, q.questions.some(item => item.intent?.kind === 'plan-review') ? 'plan-review' : undefined, true);
    for (const q of view.settled) this.question(String(q.callId), revision, 'settled',undefined,true);
    return this.publish();
  }
  /** Runtime blocking question or an individual projection update. */
  question(id: string, revision: number, state: 'open' | 'continued' | 'settled' | boolean, intent?: 'plan-review', projected=false): WorkFact | undefined {
    if (!id || !Number.isSafeInteger(revision) || revision < 0 || revision <= (this.questionStates.get(id)?.revision ?? -1)) return;
    const value = typeof state === 'boolean' ? state ? 'open' : 'settled' : state;
    if (!this.questionStates.has(id) && this.questionStates.size >= 64) { this.problem = 'capacity'; return this.publish(); }
    const previous = this.questionStates.get(id);
    this.questionStates.set(id, { revision, state: value, projected, ...(intent ? { intent } : {}) });
    if (value !== 'settled' && !previous) this.pulse('question');
    if (value === 'settled' && previous?.state !== 'settled') this.pulse('answered');
    return this.publish();
  }
  acknowledge(): WorkFact { this.acknowledged = true; return this.publish(); }
  accepted(): undefined { return; }
}
