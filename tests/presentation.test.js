import { it, expect } from 'vitest';
import { createSpeech, replyPreview } from '../web/speech.js';
import { shortSessionIds, sessionActivity } from '../web/session-ui.js';
import tray from '../desktop/tray-state.cjs';

it('keeps the visible Unicode prefix and punctuation pause when live speech is extended', () => {
  const node = { textContent: '' }, spoken = [];
  const speech = createSpeech({ text: '你好，', node, onCharacter: ch => spoken.push(ch) });
  speech.step(.1); expect(node.textContent).toBe('你好');
  expect(speech.update('你好，🐳继续')).toBe(true); expect(node.textContent).toBe('你好');
  speech.step(.05); expect(node.textContent).toBe('你好，');
  speech.step(.1); expect(node.textContent).toBe('你好，');
  speech.step(.3); expect(node.textContent).toBe('你好，🐳继续');
  expect(spoken).toEqual(['你', '好', '🐳', '继', '续']);
  expect(speech.update('另一段')).toBe(false);
});

it('distinguishes host IDs with the same session prefix and collision-prone first six characters', () => {
  const ids = shortSessionIds([{ id: 'session-abcdef-111' }, { id: 'session-abcdef-222' }, { id: 'session-987654321' }]);
  expect(new Set(ids.values()).size).toBe(3);
  expect([...ids.values()].every(id => !id.startsWith('session-'))).toBe(true);
});

it('projects selected session, appearance, visibility and preferences into the macOS status bar', () => {
  const snapshot = { sessionId: 'b', mood: 'talking', active: true, sessions: [{ id: 'a', label: '菜单' }, { id: 'b', label: '修复同步', mood: 'talking' }] };
  const state = tray.trayState(snapshot, { characterId: 'whale', scheme: 'harness', name: '大肥鱼', sleeping: true, sound: false }, { roam: false, notifications: false }, true);
  expect(state).toMatchObject({ sessionId: 'b', sessionLabel: '修复同步', mood: 'talking', title: '', icon: 'talking', sleeping: false, characterId: 'whale', scheme: 'harness', visible: true, roam: false, notifications: false, sound: false });
  expect(state.sessions.map(s => s.selected)).toEqual([true, false]);
  expect(state.tooltip).toContain('正在回复');
  expect(tray.trayState({ ...snapshot, mood: 'idle', active: false, sessions: [] }, { sleeping: true })).toMatchObject({ title: '', icon: 'sleeping' });
});

it('bounds preview typing time while preserving full Unicode text for the reader', () => {
  const full = '一句完整的话。\n' + '🐳很长很长，'.repeat(900) + '最后一句';
  const preview = replyPreview(full);
  expect(preview.long).toBe(true); expect(Array.from(preview.text).length).toBeLessThanOrEqual(181);
  expect(preview.text).not.toMatch(/[\uD800-\uDBFF]$/);
  const node = { textContent: '' };
  const speech = createSpeech({ text: preview.text, node, onCharacter: () => {} });
  for (let n = 0; n < 62; n++) speech.step(.05);
  expect(speech.done).toBe(true); expect(node.textContent).toBe(preview.text);
  expect(full.endsWith('最后一句')).toBe(true);
});

it('shares background attention and active work between the character and tray without changing focus', () => {
  const snapshot = { sessionId: 'a', mood: 'thinking', active: true, sessions: [{ id: 'a', mood: 'thinking', active: true }, { id: 'b', mood: 'waiting', active: true, unread: 2 }, { id: 'c', mood: 'idle', unread: 1 }] };
  expect(sessionActivity(snapshot)).toMatchObject({ mood: 'thinking', icon: 'waiting', waiting: 1, unread: 3, busy: 2, pending: 2 });
  const state = tray.trayState(snapshot);
  expect(state.activity).toEqual(sessionActivity(snapshot)); expect(state.sessionId).toBe('a');
  expect(tray.trayState({ ...snapshot, mood: 'idle', active: false, sessions: snapshot.sessions.slice(1) }, { sleeping: true })).toMatchObject({ mood: 'waiting', sleeping: false });
});

import { notificationCopy, notificationPresentation, createNoticeQueue } from '../web/notification-ui.js';
const taskNotice = (id, category = 'question', stage = 'initial', requestIds = ['question-full']) => ({ id, sessionId: 'session-full', category, stage, title: 'Title', body: 'Full question preview', requestIds });
it('maps every event and grouped reminder into character language with supported vocabulary fallback', () => {
  for (const category of ['completed', 'approval', 'question', 'error', 'stopped', 'interrupted', 'blocked', 'max-tokens']) {
    const zh = notificationPresentation(taskNotice(category, category), 'zh-CN', ['neutral']);
    const en = notificationPresentation(taskNotice(category, category), 'en-US', []);
    expect(zh.word).toBe('neutral'); expect(en.word).toBeUndefined(); expect(zh.title).not.toBe(en.title); expect(en.body).toBe('Full question preview');
  }
  expect(notificationPresentation(taskNotice('reminder', 'question', 'reminder', ['a', 'b']), 'en', ['worried'])).toMatchObject({ title: '2 requests are still waiting for you.', word: 'worried', mood: 'waiting' });
  expect(notificationCopy('zh-TW').open).toContain('源会话');
});
it('holds deduplicated character prompts during reading and drops settled requests before presentation', () => {
  const queue = createNoticeQueue({ limit: 2 });
  queue.push(taskNotice('one')); expect(queue.push(taskNotice('one'))).toBe(false);
  expect(queue.next(true, [])).toBeUndefined(); expect(queue.size).toBe(1);
  expect(queue.next(false, [{ id: 'question-full', state: 'settled' }])).toBeUndefined();
  queue.push(taskNotice('two')); queue.push(taskNotice('three')); queue.push(taskNotice('four'));
  expect(queue.size).toBe(2); expect(queue.next(false, undefined).id).toBe('three');
  queue.clear(); expect(queue.next(false)).toBeUndefined();
});
