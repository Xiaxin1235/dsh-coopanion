/** Trusted page adapter. Serialize revisions and discard replies from an old character/view. */
export class CompanionClient {
  constructor(call, changed = () => {}) { this.call = call; this.changed = changed; this.epoch = 0; this.queue = Promise.resolve(); this.summary = null; this.characterId = null; this.error = null; this.pending = 0; }
  load(characterId) {
    this.epoch++; this.characterId = characterId; this.summary = null; this.error = null; this.changed();
    return this.request('read');
  }
  request(type, requestId = crypto.randomUUID(), details = {}) {
    const epoch = this.epoch, characterId = this.characterId, memoryGeneration = Object.hasOwn(details, 'memoryGeneration') ? details.memoryGeneration : this.summary?.memory?.generation;
    this.pending++;
    const run = this.queue.then(async () => {
      if (epoch !== this.epoch || !characterId) return null;
      try {
        const result = await this.call({ type, characterId, ...(type === 'read' ? {} : { requestId, revision: this.summary?.revision ?? 0 }), ...(['pet', 'play'].includes(type) && memoryGeneration ? { memoryGeneration } : {}), ...(type === 'memory-delete' || type === 'memory-correct' ? { entryId: details.entryId } : {}), ...(type === 'memory-correct' ? { kind: details.kind } : {}) });
        if (epoch !== this.epoch) return null;
        this.summary = result; this.error = result.error ?? (result.writable ? null : 'companion/readonly'); this.changed(); return result;
      } catch (error) {
        if (epoch !== this.epoch) return null;
        this.error = String(error.message ?? error).slice(0, 160); this.changed();
        // Refresh revision after a conflict, but never automatically replay a care action.
        try { const result = await this.call({ type: 'read', characterId }); if (epoch === this.epoch) { this.summary = result; this.changed(); } } catch { /* Remain visibly unavailable. */ }
        return null;
      }
    });
    run.then(() => { this.pending--; }, () => { this.pending--; });
    this.queue = run.catch(() => {}); return run;
  }
}
export async function browserCompanionship(value) {
  const response = await fetch('./api/companionship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const result = await response.json(); if (!result.ok) throw new Error(result.error); return result.value;
}
