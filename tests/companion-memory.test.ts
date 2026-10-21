import { it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompanionStore } from '../src/companion-store.ts';
async function fixture(run: (f: { store: CompanionStore; directory: string; set: (time: number) => void; read: (id?: string) => ReturnType<CompanionStore['request']>; act: (type: string, extra?: object, id?: string) => ReturnType<CompanionStore['request']> }) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-memory-')); let now = Date.UTC(2026, 9, 21, 4), seq = 0;
  const store = new CompanionStore(directory, () => now);
  const read = (characterId = 'whale') => store.request({ type: 'read', characterId });
  const act = async (type: string, extra = {}, characterId = 'whale') => {
    const current = await read(characterId);
    return store.request({ type, characterId, requestId: `event-${++seq}`, revision: current.revision, ...(['pet', 'play'].includes(type) ? { memoryGeneration: current.memory.generation } : {}), ...extra });
  };
  try { await run({ store, directory, read, act, set: time => { now = time; } }); }
  finally { await store.close(); await rm(directory, { recursive: true, force: true }); }
}
it('records confirmed experiences once, independently of growth cooldown and profile budget', async () => fixture(async f => {
  const first = await f.act('pet', { requestId: 'stroke' });
  expect(first.memory.entries).toMatchObject([{ id: 'stroke', kind: 'pet' }]);
  expect((await f.act('pet', { requestId: 'stroke' })).memory.entries).toHaveLength(1);
  const second = await f.act('play');
  expect(second.applied).toBe(false); expect(second.memory.entries).toHaveLength(2);
  expect(second.relation.total).toBe(1); expect(second.invitation).toEqual(first.invitation);
  expect((await f.read('paper-star')).memory.entries).toEqual([]);
  const legacy = await f.store.request({ type: 'pet', characterId: 'whale', requestId: 'legacy', revision: second.revision });
  expect(legacy.memory.entries).toHaveLength(2);
}));
it('corrects with source identity retained, deletes without reversing growth, and revokes late events beyond the recent ledger', async () => fixture(async f => {
  const first = await f.act('pet', { requestId: 'original' });
  const corrected = await f.act('memory-correct', { entryId: 'original', kind: 'play' });
  expect(corrected.memory.entries[0]).toEqual({ ...first.memory.entries[0], correctedKind: 'play' });
  expect(corrected.relation).toEqual(first.relation);
  const cleared = await f.act('memory-delete', { entryId: 'original' });
  expect(cleared.memory.entries).toEqual([]); expect(cleared.relation).toEqual(first.relation);
  for (let i = 0; i < 130; i++) await f.act('resume');
  await f.act('pet', { requestId: 'original', memoryGeneration: first.memory.generation });
  await f.act('play', { requestId: 'late-completion', memoryGeneration: corrected.memory.generation });
  expect((await f.read()).memory.entries).toEqual([]);
  await f.act('pet', { requestId: 'new-real-input' }); expect((await f.read()).memory.entries).toHaveLength(1);
  await f.act('memory-clear'); expect((await f.read()).memory.entries).toEqual([]);
}));
it('persists revocation across restart and character removal; does not reconstruct summaries from growth', async () => fixture(async f => {
  const first = await f.act('play'); await f.act('remove'); await f.store.close();
  const reopened = new CompanionStore(f.directory);
  try {
    const current = await reopened.request({ type: 'read', characterId: 'whale' });
    expect(current.relation.total).toBe(0); expect(current.memory.entries).toEqual([]);
    const late = await reopened.request({ type: 'pet', characterId: 'whale', revision: current.revision, requestId: 'late', memoryGeneration: first.memory.generation });
    expect(late.memory.entries).toEqual([]);
  } finally { await reopened.close(); }
}));
it('bounds each character, the whole profile, retention and serialized bytes', async () => fixture(async f => {
  for (let i = 0; i < 20; i++) await f.act('pet');
  expect((await f.read()).memory.entries).toHaveLength(16);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 16; j++) await f.act('pet', {}, `character-${i}`);
  const raw = await readFile(join(f.directory, 'state.json'), 'utf8'), save = JSON.parse(raw);
  expect(Object.values(save.memories).flatMap((memory: any) => memory.entries)).toHaveLength(128);
  expect(Buffer.byteLength(raw)).toBeLessThan(256 * 1024);
  f.set(Date.UTC(2026, 10, 22, 4)); expect((await f.read('character-8')).memory.entries).toEqual([]);
  await f.act('resume');
  expect(Object.values(JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8')).memories).flatMap((memory: any) => memory.entries)).toEqual([]);
}));
it('migrates schema 1 only on successful mutation, preserves relationships, quiet and original bytes on read', async () => fixture(async f => {
  const raw = JSON.stringify({ schema: 1, revision: 4, date: '2026-10-21', lastAt: 0, invitations: 1, quiet: true, laterUntil: 0, characters: { whale: { total: 7, days: ['2026-10-19', '2026-10-20', '2026-10-21'], date: '2026-10-21', count: 1, lastAt: 0, unlocked: true } }, recent: ['old'] });
  await writeFile(join(f.directory, 'state.json'), raw);
  const before = await f.read(); expect(before.memory.entries).toEqual([]); expect(before.relation.total).toBe(7);
  expect(await readFile(join(f.directory, 'state.json'), 'utf8')).toBe(raw);
  const after = await f.act('pet'); expect(after.relation.total).toBe(8); expect(after.invitation.quiet).toBe(true);
  expect(after.memory.entries).toHaveLength(1);
  expect(JSON.parse(await readFile(join(f.directory, 'state.json'), 'utf8')).schema).toBe(2);
}));
it('failed writes, conflicts and a second reader cannot display uncommitted memories', async () => fixture(async f => {
  const before = await f.read(); await mkdir(join(f.directory, 'state.json'));
  await expect(f.act('pet')).rejects.toThrow(); expect((await f.read()).memory.entries).toEqual([]);
  await rm(join(f.directory, 'state.json'), { recursive: true }); await f.act('pet');
  await expect(f.store.request({ type: 'memory-clear', characterId: 'whale', requestId: 'stale', revision: before.revision })).rejects.toThrow('revision-conflict');
  const other = new CompanionStore(f.directory);
  try {
    const current = await other.request({ type: 'read', characterId: 'whale' }); expect(current.writable).toBe(false); expect(current.memory.entries).toHaveLength(1);
    await expect(other.request({ type: 'memory-clear', characterId: 'whale', requestId: 'locked', revision: current.revision })).rejects.toThrow('readonly');
    await f.act('memory-clear'); expect((await other.request({ type: 'read', characterId: 'whale' })).memory.entries).toEqual([]);
  } finally { await other.close(); }
}));
it.each(['{"schema":999}', '{"schema":2,"memories":"invalid"}'])('keeps future or damaged archives byte-for-byte', async raw => fixture(async f => {
  await writeFile(join(f.directory, 'state.json'), raw);
  expect((await f.read()).writable).toBe(false); await expect(f.act('memory-clear')).rejects.toThrow('invalid-save');
  expect(await readFile(join(f.directory, 'state.json'), 'utf8')).toBe(raw);
}));
