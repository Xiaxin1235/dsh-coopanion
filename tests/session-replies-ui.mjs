import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { previewServer } from '../scripts/preview.mjs';

let directory, server, browser;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'dsh-session-replies-'));
  server = previewServer({ dataDir: directory }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});
const focus = { id: 'focus', label: '正在聊', mood: 'idle', unread: 0 };
const source = { id: 'source', label: '后台会话', mood: 'idle', unread: 2 };
const other = { ...source, id: 'other', label: '另一段会话', unread: 1 };
const reply = (id, sessionId, time, text) => ({ id, sessionId, time, text, read: false });
const frame = results => ({ mood: 'idle', active: false, sessionId: focus.id, sessions: [focus, source, other], results });
async function fixture(t, results) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.addInitScript(() => {
    window.replyActions = [];
    window.dshPetBridge = { subscribe(fn) { window.replyReceive = fn; }, action(action) { window.replyActions.push(action); }, hit() {} };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector('#pet[data-character=whale][data-mode]');
  const receive = snapshot => page.evaluate(snapshot => window.replyReceive({ type: 'snapshot', snapshot }), snapshot);
  await receive(frame(results));
  return { page, receive };
}

test('unread replies coalesce by session and reading does not expose old turns again', async t => {
  const old = reply('source:1:3', source.id, 1, '旧回合的回复');
  const latest = reply('source:2:6', source.id, 2, '最新回合的回复');
  const separate = reply('other:1:3', other.id, 3, '另一段会话的回复');
  const { page, receive } = await fixture(t, [old, latest, separate]);
  await page.locator('#attention').click();
  assert.equal(await page.locator('#inbox-replies .inbox-reply').count(), 2, 'one card per session');
  assert.equal(await page.locator('#inbox-count').innerText(), '0 件待处理 · 2 份未读回复');
  assert.equal(await page.locator('#attention-count').innerText(), '2');
  assert.equal(await page.locator(`[data-result-id="${old.id}"]`).count(), 0);
  await page.locator(`[data-result-id="${latest.id}"][data-action=read]`).click();
  assert.equal(await page.locator('#reader-text').innerText(), latest.text);
  assert.equal(await page.locator('#reader-count').innerText(), '2 / 2');
  const reads = await page.evaluate(() => window.replyActions.filter(action => action.type === 'read').map(action => action.resultId));
  assert.deepEqual(new Set(reads), new Set([old.id, latest.id]), 'reading the card acknowledges its captured turns');
  const incoming = reply('source:3:9', source.id, 4, '阅读期间的新回合');
  await receive(frame([old, latest, separate, incoming]));
  assert.equal(await page.locator('#reader-text').innerText(), latest.text, 'new turns keep the reader stable');
  await page.locator('#reader-inbox').click();
  assert.equal(await page.locator('#inbox-replies .inbox-reply').count(), 2);
  assert.equal(await page.locator(`[data-result-id="${incoming.id}"][data-action=read]`).count(), 1, 'newer turns stay unread');
  await receive(frame([{ ...old, read: true }, { ...latest, read: true }, { ...incoming, read: true }, separate]));
  assert.equal(await page.locator('#inbox-replies .inbox-reply').count(), 1, 'acknowledged older turns never resurface');
});

test('full replies render Markdown headings, emphasis, tables and fenced code', async t => {
  const text = '## Docker vs VM\n\n**已经直连**，看看 `opencode.ai`。\n\n| 诉求 | 方案 |\n| --- | --- |\n| 隔离 | VM |\n\n```sh\necho "🐳"\n```\n\n- 第一项\n- 第二项\n\n[官方文档](https://example.com/docs)';
  const { page } = await fixture(t, [reply('source:1:3', source.id, 1, text)]);
  await page.locator('#attention').click();
  assert.equal(await page.locator('#reader-text h2').count(), 1, 'Markdown heading is rendered');
  assert.equal(await page.locator('#reader-text strong').innerText(), '已经直连');
  assert.equal(await page.locator('#reader-text table tbody td').count(), 2);
  assert.equal(await page.locator('#reader-text pre code').textContent(), 'echo "🐳"\n');
  assert.equal(await page.locator('#reader-text li').count(), 2);
  assert.equal(await page.locator('#reader-text a').getAttribute('href'), 'https://example.com/docs');
  await mkdir('artifacts', { recursive: true });
  await page.locator('#reader').screenshot({ path: 'artifacts/reply-markdown.png' });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForFunction(() => { const r = document.getElementById('reader').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
  assert.equal(await page.locator('#reader').evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Markdown fits a narrow reader');
  await page.screenshot({ path: 'artifacts/reply-markdown-narrow.png' });
});

test('multiple turns of a single session still open directly with one click', async t => {
  const old = reply('source:1:3', source.id, 1, '旧回合');
  const latest = reply('source:2:6', source.id, 2, '最新回合');
  const { page } = await fixture(t, [old, latest]);
  await page.locator('#attention').click();
  assert.equal(await page.locator('#reader').isVisible(), true);
  assert.equal(await page.locator('#reader-text').innerText(), latest.text);
  assert.equal(await page.locator('#reader-count').innerText(), '1 / 1');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#attention').isVisible(), false, 'all captured turns are acknowledged locally');
});

test('reply markup cannot inject HTML, active URLs or external images', async t => {
  const text = '**正常格式**\n\n<img src=x onerror="window.injected=true">\n\n<script>window.injected=true</script>\n\n[危险链接](javascript:alert(1))\n\n![远程图片](https://example.com/tracking.png)\n\n<iframe src="https://example.com"></iframe>';
  const { page } = await fixture(t, [reply('source:1:3', source.id, 1, text)]);
  await page.locator('#attention').click();
  assert.equal(await page.locator('#reader-text strong').innerText(), '正常格式');
  assert.equal(await page.locator('#reader-text img, #reader-text script, #reader-text iframe').count(), 0);
  assert.equal(await page.locator('#reader-text a[href]').count(), 0);
  assert.ok((await page.locator('#reader-text').innerText()).includes('<img src=x onerror="window.injected=true">'), 'raw HTML remains readable content');
  assert.equal(await page.evaluate(() => window.injected), undefined);
});
