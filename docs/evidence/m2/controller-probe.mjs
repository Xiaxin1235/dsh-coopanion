/** Published Host contract probe: real controller, queue, persistence and loop; scripted model only. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
export const inject = ['appReady', 'appExit', 'llm', 'agents', 'sessions', 'sessionController', 'sessionPersistence'];
export function apply(ctx) {
  ctx.effect(() => ctx.appReady.onReady(() => { setTimeout(async () => {
    try {
      const { LlmAdapter } = await import(pathToFileURL(join(process.env.M2_MODULES, '@deepseek-ai/dsh-llm/lib/index.js')).href);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      class Controlled extends LlmAdapter {
        async listModels() { return [{ provider: 'm2-script', id: 'controlled', name: 'M2 controlled' }]; }
        async *stream() { await gate; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'M2 full result' } }; yield { type: 'finish', reason: { kind: 'stop' } }; }
      }
      ctx.llm.registerAdapter(['m2-script'], new Controlled());
      const sessionId = 'm2-cold-ordinary-full-identity';
      const owned = await ctx.agents.create({ sessionId, meta: { cwd: process.env.DSH_HOME }, agentOptions: { provider: 'm2-script', model: 'controlled' } });
      await ctx.sessionController.selectModel({ sessionId, provider: 'm2-script', model: 'controlled' });
      await ctx.sessions.flush(owned.agent.session); await owned.dispose();
      assert.equal(ctx.agents.get(sessionId), undefined); assert.equal(ctx.sessions.get(sessionId), undefined);
      const input = { sessionId, requestId: 'm2-client-request-cold-full-00000001', mode: 'queue', content: [{ type: 'text', text: '精确消息 🐳\nnext line' }], clientTimeZone: 'Asia/Shanghai' };
      const receipts = [await ctx.sessionController.prompt(input, new AbortController().signal)];
      const agent = ctx.agents.get(sessionId); assert.ok(agent);
      await ctx.sessions.flush(agent.session);
      const read = await ctx.sessionPersistence.open(sessionId, 'read');
      let persisted; try { persisted = (await read.read()).events; } finally { await read.close(); }
      const messages = (events, id) => [...new Map(events.flatMap(e => e.type === 'agent/inbox/spliced' ? e.data.inserted : e.type === 'user/message' ? [e.data] : []).filter(m => m.source.rpcId === id).map(m => [m.id, m])).values()];
      const occurrences = events => messages(events, input.requestId);
      assert.equal(occurrences(persisted).length, 1); assert.deepEqual(occurrences(persisted)[0].content, input.content);
      assert.equal(occurrences(persisted)[0].source.clientTimeZone, input.clientTimeZone);
      receipts.push(await ctx.sessionController.prompt(input, new AbortController().signal));
      const sequentialRetryCount = occurrences(agent.session.snapshotEvents()).length;
      const concurrent = { ...input, requestId: 'm2-client-request-concurrent-full-00000002' };
      receipts.push(...await Promise.all([ctx.sessionController.prompt(concurrent, new AbortController().signal), ctx.sessionController.prompt(concurrent, new AbortController().signal)]));
      const concurrentCount = messages(agent.session.snapshotEvents(), concurrent.requestId).length;
      const failures = {};
      const failure = async (name, request, signal = new AbortController().signal) => { try { await ctx.sessionController.prompt(request, signal); throw new Error('unexpected acceptance'); } catch (e) { assert.notEqual(e.message, 'unexpected acceptance'); failures[name] = { code: e.code, name: e.name, message: e.message }; } };
      await failure('missing', { ...input, sessionId: 'm2-missing-full' });
      await failure('invalidTimeZone', { ...input, clientTimeZone: 'bad-zone' });
      const cancel = new AbortController(); cancel.abort(); await failure('cancelledBeforeAdmission', { ...input, requestId: 'm2-cancelled-full' }, cancel.signal);
      const locked = await ctx.sessionPersistence.create({ id: 'm2-locked-full', version: 4, createdAt: Date.now(), isSeeded: false, cwd: process.env.DSH_HOME });
      await locked.flush(); await failure('writerHeld', { ...input, sessionId: locked.id }); await locked.close();
      release();
      const deadline = Date.now() + 10000;
      while (agent.status !== 'idle' || agent.inbox.nextTurn.length) { assert.ok(Date.now() < deadline); await new Promise(r => setTimeout(r, 10)); }
      await ctx.sessions.flush(agent.session);
      process.send?.({ type: 'm2-result', result: { status: 'pass', input, receipts, persisted, sequentialRetryCount, concurrentCount, failures, events: agent.session.snapshotEvents(), cases: { coldRecovery: true, durableExactIdentity: true, sequentialRetryOnce: sequentialRetryCount === 1 } } });
    } catch (error) { process.send?.({ type: 'm2-result', error: String(error.stack ?? error) }); }
  }, 0); }));
  ctx.effect(() => { const fn = m => { if (m?.type === 'shutdown-host') ctx.appExit(0); }; process.on('message', fn); return () => process.off('message', fn); });
}
