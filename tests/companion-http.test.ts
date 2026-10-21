import { it, expect } from 'vitest';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CharacterStore } from '../src/character-store.ts';
import { CompanionStore } from '../src/companion-store.ts';
import { createPetServer } from '../src/figure-server.ts';
it('preview companionship writes require trusted origin, installed character and strict finite requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-companion-http-'));
  const companions = new CompanionStore(join(directory, 'care'));
  const server = createPetServer({ webRoot: resolve('web'), store: new CharacterStore(join(directory, 'figures'), resolve('web/upstream/whale')), companions });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = (body: unknown, trusted?: string) => fetch(origin + '/api/companionship', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(trusted ? { Origin: trusted } : {}) }, body: JSON.stringify(body) });
  try {
    const read = { type: 'read', characterId: 'whale' };
    expect((await call(read)).status).toBe(403); expect((await call(read, 'null')).status).toBe(403);
    const initial = await (await call(read, origin)).json(); expect(initial.value.writable).toBe(true);
    expect((await call({ ...read, characterId: 'not-installed' }, origin)).status).toBe(404);
    expect((await call({ type: 'pet', characterId: 'whale', requestId: 'manual', revision: 0, date: '2099-01-01' }, origin)).status).toBe(400);
    const grown = await (await call({ type: 'pet', characterId: 'whale', requestId: 'manual', revision: 0 }, origin)).json(); expect(grown.value.relation.total).toBe(1);
    const remembered = await (await call({ type: 'play', characterId: 'whale', requestId: 'completed', revision: 1, memoryGeneration: grown.value.memory.generation }, origin)).json();
    expect(remembered.value.memory.entries[0].kind).toBe('play'); expect(remembered.value.relation.total).toBe(1);
    const correction = { type: 'memory-correct', characterId: 'whale', requestId: 'correct', revision: 2, entryId: 'completed', kind: 'pet' };
    expect((await call(correction, 'null')).status).toBe(403);
    expect((await call({ ...correction, kind: 'work' }, origin)).status).toBe(400);
    const corrected = await (await call(correction, origin)).json(); expect(corrected.value.memory.entries[0].correctedKind).toBe('pet');
    const cleared = await (await call({ type: 'memory-clear', characterId: 'whale', requestId: 'clear', revision: 3 }, origin)).json();
    expect(cleared.value.memory.entries).toEqual([]); expect(cleared.value.relation.total).toBe(1);
    expect((await call({ type: 'remove', characterId: 'whale', requestId: 'remove', revision: 1 }, origin)).status).toBe(400);
  } finally { await new Promise<void>(r => server.close(() => r())); await companions.close(); await rm(directory, { recursive: true, force: true }); }
});
