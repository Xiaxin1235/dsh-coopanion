/** Runtime-only response policy. It never writes memory, scores care, or moves the body. */
export const RESPONSE_RHYTHM = Object.freeze({ pauseMs: 4000, mergeMs: 10000, ttlMs: 20000, sources: 16, history: 32 });
const same = (a, b) => a.characterId === b.characterId && a.epoch === b.epoch && a.generation === b.generation;
export class ResponseRhythm {
  constructor() { this.pending = null; this.seen = []; this.lastAt = -Infinity; }
  cancel() { this.pending = null; }
  clock(now) {
    if (!Number.isFinite(now) || now < 0 || now < this.lastAt) { this.cancel(); return false; }
    this.lastAt = now;
    this.seen = this.seen.filter(source => now < source.until);
    if (this.pending && now >= this.pending.expiresAt) this.cancel();
    return true;
  }
  observe(source) {
    if (!this.clock(source.now)) return false;
    if (!source.reacted || !source.id || !source.characterId || !source.generation || !Number.isSafeInteger(source.epoch)) return false;
    if (this.pending && !same(this.pending, source)) this.cancel();
    if (this.seen.some(previous => previous.id === source.id && same(previous, source))) return false;
    // Refuse overflow rather than evicting deduplication identities while live.
    if (this.seen.length >= RESPONSE_RHYTHM.history) return false;
    this.seen.push({ id: source.id, characterId: source.characterId, epoch: source.epoch, generation: source.generation, until: source.now + RESPONSE_RHYTHM.ttlMs });
    if (this.pending && source.now > this.pending.firstAt + RESPONSE_RHYTHM.mergeMs) return false;
    if (!this.pending) this.pending = { characterId: source.characterId, epoch: source.epoch, generation: source.generation,
      firstAt: source.now, dueAt: source.now + RESPONSE_RHYTHM.pauseMs, expiresAt: source.now + RESPONSE_RHYTHM.ttlMs, sources: [] };
    if (this.pending.sources.length >= RESPONSE_RHYTHM.sources) return false;
    this.pending.sources.push({ id: source.id, at: source.now, reacted: true, saved: 'pending' });
    this.pending.dueAt = Math.min(source.now + RESPONSE_RHYTHM.pauseMs, this.pending.firstAt + RESPONSE_RHYTHM.mergeMs);
    return true;
  }
  receipt(source) {
    if (!this.clock(source.now) || !this.pending || !same(this.pending, source)) return;
    const event = this.pending.sources.find(event => event.id === source.id);
    if (event?.saved === 'pending') event.saved = source.saved ? 'saved' : 'failed';
  }
  step(input) {
    if (!this.clock(input.now)) return null;
    const candidate = this.pending;
    if (!candidate) return null;
    if (input.mode === 'off' || input.cancel || !same(candidate, input)) { this.cancel(); return null; }
    // A saved fact must still belong to the current owner's confirmed summary.
    if (candidate.sources.some(source => source.saved === 'saved' && !input.entries?.some(entry => entry.id === source.id && entry.kind === 'pet' && !entry.correctedKind))) { this.cancel(); return null; }
    if (!input.permitted || input.now < candidate.dueAt || candidate.sources.some(source => source.saved === 'pending')) return null;
    this.cancel();
    return { saved: candidate.sources.some(source => source.saved === 'saved'), count: candidate.sources.length };
  }
}
