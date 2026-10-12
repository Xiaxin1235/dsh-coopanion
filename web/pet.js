import { loadBody, knownScheme } from './upstream/body-host.js';
import { createSfx } from './upstream/sound.js';
import { createSpeech, replyPreview } from './speech.js';
import { createNoticeQueue, pendingInteractions, notificationPresentation, notificationCopy } from './notification-ui.js';
import { shortSessionIds, sessionTime, sessionActivity } from './session-ui.js';
const PACK_LIMIT = 128 * 1024 * 1024;
import { browserCharacters } from './character-library.js';
const BUILTIN_ID = 'whale';
const $ = id => document.getElementById(id);
const native = window.dshPetBridge;
const pet = $('pet'), bubble = $('bubble'), conversations = $('conversations'), chat = $('chat'), menu = $('menu'), characters = $('characters'), reader = $('reader');
const interaction = $('interaction'), requests = $('requests');
const panels = [conversations, chat, menu, characters, reader, requests];
const noticeQueue = createNoticeQueue();
let notificationState, currentNotice, interactionExpires = 0;
const snoozing = new Map();
const notificationLocale = () => options.locale ?? document.documentElement.lang ?? navigator.language;
const pendingRequests = () => pendingInteractions(notificationState);
const userInputOccupied = () => pressing || dragging || panels.some(p => !p.hidden) || !bubble.hidden;
const userOccupied = () => userInputOccupied() || body?.layout?.busy;
const panelAnchors = new WeakMap();
const labels = { idle: '在这里陪你', thinking: '正在思考', talking: '正在回复', working: '正在忙', waiting: '等你确认', happy: '完成啦', error: '需要关注', sleeping: '休息中' };
const library = native?.characters ?? browserCharacters;
const sfx = createSfx({ storageKey: 'dsh-pet.sound.v2', volume: .35 });
const nameIn = names => names?.zh ?? names?.en ?? Object.values(names ?? {})[0] ?? '';
let body, previewBody, previewCharacter, activeView, activeScheme, activeName = 'DeepSeek 大肥鱼', libraryState, libraryBusy = false;
let appliedMood, appliedControls, speech, speechExpires = Infinity, pressing = false, dragStart, dragging = false, previewScheme = "", reducedNeedsStep = true;
let options = { size: 180, roam: true, notifications: true, bubbleDurationMs: 12000 };
let snapshot = { mood: 'idle', text: '你好。点点我，或双击和我说话。', sessionId: null, sessions: [] };
let x = innerWidth * .68, y = innerHeight - 155, hovered = false, asleep = false, toastTimer, noticeSession;
let cursorPoint, lastHit;
let renderedSessionId = null, reactionUntil = 0, reactionMood, bubbleSession, trayKey, touchTimer, touchBlockedUntil = 0;
let bubbleResult, readerResult, pendingOnly = false, talkAt = 0;
const shownResults = new Set(), acknowledgedResults = new Set();
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
motionPreference.addEventListener('change', event => { reduced = event.matches; });

function send(action) {
  if (native) { native.action(action); return; }
  if (action.type === 'read') {
    const result = snapshot.results?.find(r => r.id === action.resultId);
    if (result && !result.read) { result.read = true; const session = snapshot.sessions.find(s => s.id === result.sessionId); if (session) session.unread = Math.max(0, (session.unread ?? 0) - 1); }
    render();
  }
  if (action.type === 'select') {
    const session = snapshot.sessions.find(session => session.id === action.sessionId);
    if (session) snapshot = { ...snapshot, ...session, sessionId: session.id };
    render();
  }
}

function bounds() { return { W: innerWidth, H: innerHeight, floorY: innerHeight - 24, S: options.size / 256 }; }
function previewBounds() { const el = $('character-preview'); return { W: el.clientWidth, H: el.clientHeight, floorY: el.clientHeight - 14, S: Math.min(el.clientWidth, el.clientHeight - 22) / 256 }; }
function position() {
  const layout = body?.layout;
  const box = layout?.box;
  if (box) {
    pet.hidden = false;
    x = box.x; y = box.y;
    // Keep the invisible input region on pixel boundaries while the artwork
    // breathes at subpixel precision. Round outwards to contain the whole body.
    const left = Math.floor(x), top = Math.floor(y);
    Object.assign(pet.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(1, Math.ceil(x + box.w) - left)}px`, height: `${Math.max(1, Math.ceil(y + box.h) - top)}px` });
    pet.dataset.mode = layout.mode; pet.dataset.pressing = String(layout.pressing);
    pet.style.cursor = layout.cursor || 'grab';
  }
  const anchor = layout?.bubble ?? { x: x + options.size / 2, y };
  for (const panel of [bubble, interaction, ...panels]) {
    if (panel.hidden) { panelAnchors.delete(panel); continue; }
    if (!panelAnchors.has(panel)) panelAnchors.set(panel, { ...anchor });
    const panelAnchor = panelAnchors.get(panel);
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const px = Math.max(8, Math.min(innerWidth - pw - 8, panelAnchor.x - pw / 2));
    const py = Math.max(8, Math.min(innerHeight - ph - 12, panelAnchor.y - ph - 18));
    panel.style.left = `${px}px`; panel.style.top = `${py}px`;
    panel.style.setProperty('--tail', `${Math.max(22, Math.min(pw - 22, panelAnchor.x - px))}px`);
  }
  const activity = sessionActivity(snapshot);
  const attention = $('attention');
  attention.hidden = !(activity.unread + Math.max(activity.waiting, pendingRequests().length) + activity.errors) || panels.some(p => !p.hidden);
  const holding = !attention.hidden && (attention.matches(':hover') || document.activeElement === attention);
  if (!holding) panelAnchors.delete(attention);
  else if (!panelAnchors.has(attention)) { const b = attention.getBoundingClientRect(); panelAnchors.set(attention, { x: b.x, y: b.y }); }
  const point = panelAnchors.get(attention) ?? { x: Math.max(8, Math.min(innerWidth - 55, anchor.x + options.size * .25)), y: Math.max(8, Math.min(innerHeight - 38, anchor.y + 15)) };
  Object.assign(attention.style, { left: `${Math.round(point.x)}px`, top: `${Math.round(point.y)}px` });
}
function speak(result) {
  const source = snapshot.sessions.find(session => session.id === result.sessionId);
  const preview = replyPreview(result.text);
  $('bubble-status').textContent = source?.label ?? '';
  bubble.setAttribute('aria-label', `${source?.label ?? activeName}的最终回复`);
  bubbleSession = result.sessionId; bubbleResult = result;
  $('bubble-session').hidden = !bubbleSession;
  $('bubble-expand').hidden = !preview.long;
  bubble.hidden = false;
  panelAnchors.delete(bubble);
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  speech = createSpeech({ text: preview.text, node: $('bubble-text'), immediate: reduced, onCharacter: ch => { sfx.babble(ch); body?.talk(); } });
  shownResults.add(result.id);
  speechExpires = Infinity;
  bubble.dataset.typing = String(!speech.done);
  $('bubble-reveal').hidden = speech.done;
  position();
}
function showNextReply() {
  if (!bubble.hidden || !interaction.hidden || panels.some(p => !p.hidden) || pressing || dragging) return;
  const result = snapshot.results?.find(r => r.sessionId === snapshot.sessionId && !r.read && !shownResults.has(r.id));
  if (result) speak(result);
}
function acknowledge(result) {
  if (!result || result.read || acknowledgedResults.has(result.id)) return;
  acknowledgedResults.add(result.id); send({ type: 'read', resultId: result.id });
}
function openReader(result) {
  if (!result) return;
  interaction.hidden = true;
  clearTimeout(touchTimer); touchBlockedUntil = performance.now() + 1000;
  panels.forEach(p => { p.hidden = true; }); bubble.hidden = true; reader.hidden = false;
  readerResult = result;
  const source = snapshot.sessions.find(s => s.id === result.sessionId);
  $('reader-title').textContent = source?.label ?? '会话回复';
  $('reader-detail').textContent = `${source?.project ?? ''} · ${sessionTime({ updatedAt: result.time })}`;
  $('reader-text').textContent = result.text; $('reader-text').scrollTop = 0;
  updateReaderNavigation(); acknowledge(result); updateMood(); position(); $('reader-text').focus();
}
function updateReaderNavigation() {
  const history = (snapshot.results ?? []).filter(r => r.sessionId === readerResult?.sessionId);
  const index = history.findIndex(r => r.id === readerResult?.id);
  $('reader-count').textContent = `${Math.max(1, index + 1)} / ${Math.max(1, history.length)}`;
  $('reader-prev').disabled = index <= 0; $('reader-next').disabled = index < 0 || index >= history.length - 1;
}
function react(mood) { reactionMood = mood; reactionUntil = performance.now() + 700; }
function act(actor, pack, word) {
  if (pack?.vocab.some(w => w.id === word) && (!actor.words || actor.words.includes(word))) actor.do(word);
}
function updateMood(now = performance.now()) {
  const activity = sessionActivity(snapshot), active = activity.active;
  if (active || activity.waiting || activity.errors) asleep = false;
  const mood = now < reactionUntil && !userInputOccupied() ? reactionMood : active || activity.waiting || activity.errors ? activity.mood : pendingRequests().length ? 'waiting' : asleep ? 'sleeping' : activity.mood;
  pet.dataset.mood = mood;
  if (!body) return;
  if (mood !== appliedMood && !body.layout?.busy) {
    reducedNeedsStep = true;
    if (mood !== 'sleeping' && (appliedMood === 'sleeping' || ['sleep', 'sit'].includes(body.layout?.mode))) act(body, activeView, 'stand');
    const word = { idle: 'neutral', thinking: 'thinking', talking: 'neutral', working: 'determined', waiting: 'worried', happy: 'happy', error: 'sad', sleeping: 'sleep' }[mood];
    if (word) act(body, activeView, word);
    appliedMood = mood;
  }
  const dialogOpen = panels.some(p => !p.hidden);
  const readingAttention = !$('attention').hidden && ($('attention').matches(':hover') || document.activeElement === $('attention'));
  const controls = { roam: options.roam && !reduced && !hovered && !readingAttention && !dialogOpen && bubble.hidden && interaction.hidden && mood === 'idle' ? 'calm' : 'off', dialogOpen: dialogOpen || !interaction.hidden, thinking: mood === 'thinking', thoughtShown: false, expression: { thinking: 'thinking', talking: 'determined', working: 'determined', waiting: 'worried', error: 'sad' }[mood] ?? null, listening: !chat.hidden && !active };
  const key = JSON.stringify(controls);
  if (key !== appliedControls) { if (controls.roam === 'off') body.stopWalk(0); body.set(controls); appliedControls = key; }
  $('toggle-roam').setAttribute('aria-checked', String(options.roam));
  $('toggle-sleep').setAttribute('aria-checked', String(asleep));
  $('toggle-sleep').disabled = active; $('toggle-sleep').title = active ? '正在忙，完成后再休息' : '有新的任务会自动醒来';
  $('toggle-notices').setAttribute('aria-checked', String(options.notifications));
  $('toggle-sound').setAttribute('aria-checked', String(sfx.isOn()));
  $('menu-state').textContent = `${labels[mood] ?? labels.idle}${snapshot.sessionId ? ' · 有会话相伴' : ''}`;
  const presentation = { type: 'presentation', characterId: activeView.id, scheme: activeScheme, name: activeName, mood, sleeping: asleep, sound: sfx.isOn(), ready: !!body.layout };
  const nextTrayKey = JSON.stringify(presentation);
  if (nextTrayKey !== trayKey) { trayKey = nextTrayKey; native?.action(presentation); }
}

function render() {
  const previous = renderedSessionId;
  const selected = snapshot.sessions.find(session => session.id === snapshot.sessionId);
  const shortIds = shortSessionIds(snapshot.sessions);
  const list = $('conversation-list');
  const query = $('conversation-search').value.trim().toLocaleLowerCase();
  const needsYou = s => ['waiting', 'error'].includes(s.mood) || pendingRequests().some(item => item.sessionId === s.id);
  const matches = snapshot.sessions.filter(session => (!pendingOnly || session.unread || needsYou(session)) && [session.label, session.project, session.cwd, session.prompt, session.id].join(' ').toLocaleLowerCase().includes(query));
  matches.sort((a, b) => Number(needsYou(b)) - Number(needsYou(a)) || Number(!!b.unread) - Number(!!a.unread) || Number(b.id === snapshot.sessionId) - Number(a.id === snapshot.sessionId) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const listKey = JSON.stringify([query, pendingOnly, matches.map(session => [session.id, session.label, session.prompt, session.cwd, session.updatedAt, session.mood, session.unread, session.chatAvailable, session.id === snapshot.sessionId])]);
  if (list.dataset.key !== listKey) {
    const activeId = document.activeElement?.dataset?.sessionId;
    const entries = matches.map(session => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'conversation-card';
      card.dataset.sessionId = session.id; card.dataset.mood = session.mood; card.setAttribute('role', 'option'); card.setAttribute('aria-selected', String(session.id === snapshot.sessionId));
      card.dataset.unread = String(!!session.unread);
      card.tabIndex = session.id === snapshot.sessionId ? 0 : -1;
      card.title = `${session.label}\n${session.prompt ?? ''}\n${session.cwd ?? session.project ?? ''}\n${session.id}`;
      const copy = document.createElement('span'), meta = document.createElement('small'), status = document.createElement('em'), time = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small'), prompt = document.createElement('small'), mark = document.createElement('b');
      meta.className = 'session-meta'; status.textContent = `${session.id === snapshot.sessionId ? '关注 · ' : ''}${labels[session.mood] ?? labels.idle}${session.unread ? ` · ${session.unread} 份未读` : ''}${session.chatAvailable === false ? ' · 未打开' : ''}`;
      time.textContent = sessionTime(session); meta.append(status, time);
      name.textContent = session.label; detail.className = 'session-detail'; detail.textContent = `${session.cwd || session.project || '会话'} · #${shortIds.get(session.id)}`;
      prompt.className = 'session-prompt'; prompt.textContent = session.prompt && session.prompt !== session.label ? `最近：${session.prompt}` : ''; prompt.hidden = !prompt.textContent;
      mark.textContent = '✓'; mark.setAttribute('aria-hidden', 'true');
      copy.append(meta, name, prompt, detail); card.append(copy, mark); return card;
    });
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'conversation-empty'; empty.textContent = query ? '没找到这段对话。试试提问里的词或项目名？' : pendingOnly ? '都看过啦，安心做手边的事。' : '还没有可用的对话。先在 Harness 中打开一段对话，我就能听见它。'; entries.push(empty);
    }
    list.replaceChildren(...entries); list.dataset.key = listKey;
    if (activeId) list.querySelector(`[data-session-id="${CSS.escape(activeId)}"]`)?.focus();
  }
  const activity = sessionActivity(snapshot);
  $('conversation-count').textContent = `${activity.busy} 段进行中 · ${activity.unread} 份未读回复`;
  $('sessions-all').setAttribute('aria-pressed', String(!pendingOnly)); $('sessions-pending').setAttribute('aria-pressed', String(pendingOnly));
  const waiting = Math.max(activity.waiting, pendingRequests().length);
  const attentionCount = activity.unread + waiting + activity.errors;
  $('attention').hidden = !attentionCount || panels.some(p => !p.hidden);
  $('attention-count').textContent = String(attentionCount);
  $('attention').dataset.urgent = String(!!(waiting || activity.errors));
  $('attention').title = $('attention').ariaLabel = `${waiting + activity.errors} · ${notificationCopy(notificationLocale()).pending} · ${activity.unread}`;
  $('chat-current').disabled = !snapshot.sessions.length; $('chat-session-name').textContent = selected?.label ?? '还没有对话';
  $('chat-current').setAttribute('aria-label', selected ? `当前对话：${selected.label}。点击切换` : '还没有可用的对话');
  $('chat-session-state').textContent = labels[selected?.mood] ?? '正在陪你聊';
  $('chat-session-detail').textContent = selected ? `${selected.cwd || selected.project || ''} · #${shortIds.get(selected.id)}` : '';
  const latestReply = snapshot.results?.find(r => r.id === selected?.replyId)?.text || selected?.reply || '';
  $('chat-reply').textContent = latestReply ? replyPreview(latestReply).text : ''; $('chat-reply').hidden = !latestReply;
  $('chat-read').hidden = !latestReply;
  const enabled = !!snapshot.sessionId && selected?.chatAvailable !== false;
  $('message').disabled = !enabled; $('send').disabled = !enabled;
  $('conversation-open').disabled = !snapshot.sessionId; $('chat-session').disabled = !snapshot.sessionId;
  $('chat-help').textContent = enabled ? `消息交给「${selected.label}」，完成后只展示最终回复。` : snapshot.sessionId ? '这段对话尚未在 Harness 中打开，请先回去打开它。' : '先在 Harness 中打开一段对话，就可以从这里和我说话。';
  if (previous !== snapshot.sessionId) {
    $('message').value = ''; bubble.hidden = true;
    clearTimeout(touchTimer); reactionUntil = 0;
  }
  renderedSessionId = snapshot.sessionId;
  if (!reader.hidden) updateReaderNavigation();
  presentNextNotice(); showNextReply(); renderRequests(); updateMood(); position();
}

function presentNextNotice() {
  if (!options.notifications || !interaction.hidden || userOccupied()) return;
  if (notificationState && (notificationState.runtime.phase !== 'running' || !notificationState.runtime.visible || notificationState.runtime.suspended)) return;
  const notice = noticeQueue.next(false, notificationState?.interactions);
  if (!notice) return;
  const available = activeView?.vocab.map(word => word.id).filter(word => !body?.words || body.words.includes(word)) ?? [];
  const current = notificationState && notice.requestIds.length ? { ...notice, requestIds: notice.requestIds.filter(id => pendingRequests().some(item => item.id === id)) } : notice;
  const presentation = notificationPresentation(current, notificationLocale(), available);
  currentNotice = current;
  $('interaction-title').textContent = presentation.title;
  $('interaction-preview').textContent = presentation.body;
  const copy = notificationCopy(notificationLocale());
  $('interaction-open').textContent = copy.open; $('interaction-close').ariaLabel = copy.close;
  $('interaction-pending').textContent = copy.pending; $('interaction-pending').hidden = !notice.requestIds.length;
  interaction.hidden = false; panelAnchors.delete(interaction);
  interactionExpires = performance.now() + options.bubbleDurationMs;
  reactionMood = presentation.mood; reactionUntil = performance.now() + 2500; asleep = false;
  updateMood();
  if (!reduced && presentation.word) { act(body, activeView, presentation.word); reducedNeedsStep = true; }
  position();
}
function renderRequests() {
  if (requests.hidden) return;
  const copy = notificationCopy(notificationLocale()), items = pendingRequests();
  $('requests-title').textContent = copy.pending; $('requests-close').ariaLabel = copy.close; $('requests-replies').textContent = copy.replies;
  const list = $('request-list'), key = JSON.stringify([notificationLocale(), items, [...snoozing.keys()], options.reminders]);
  if (list.dataset.key === key) return;
  const focused = document.activeElement?.dataset?.requestId, action = document.activeElement?.dataset?.action;
  const cards = items.map(item => {
    const card = document.createElement('article'); card.className = 'request-card';
    const label = document.createElement('strong'), preview = document.createElement('p'), meta = document.createElement('small'), actions = document.createElement('div');
    label.textContent = item.kind === 'question' ? copy.questionLabel : copy.approvalLabel;
    preview.textContent = item.preview;
    const session = snapshot.sessions.find(session => session.id === item.sessionId);
    meta.textContent = `${session?.label ?? item.sessionId}${item.state === 'continued' ? ' · ' + copy.continued : ''}${item.dueAt ? ' · ' + copy.delay + ': ' + new Intl.DateTimeFormat(notificationLocale(), { hour: '2-digit', minute: '2-digit' }).format(item.dueAt) : ''}`;
    const open = document.createElement('button'); open.textContent = copy.open; open.dataset.requestId = item.id; open.dataset.action = 'open'; open.onclick = () => openSession(item.sessionId);
    const later = document.createElement('button'); later.textContent = snoozing.has(item.id) ? copy.snoozing : copy.snooze; later.dataset.requestId = item.id; later.dataset.action = 'snooze'; later.disabled = snoozing.has(item.id) || !options.notifications || options.reminders === false;
    later.onclick = () => { snoozing.set(item.id, { dueAt: item.dueAt, expiresAt: performance.now() + 10000 }); $('request-feedback').textContent = ''; send({ type: 'notification-snooze', interactionId: item.id, generation: notificationState.runtime.generation }); renderRequests(); };
    actions.append(open, later); card.append(label, preview, meta, actions); return card;
  });
  if (!cards.length) { const empty = document.createElement('p'); empty.textContent = copy.empty; cards.push(empty); }
  list.replaceChildren(...cards); list.dataset.key = key;
  if (focused) list.querySelector(`[data-request-id="${CSS.escape(focused)}"][data-action="${action}"]`)?.focus();
}
function openRequests() {
  clearTimeout(touchTimer); interaction.hidden = true; bubble.hidden = true; $('request-feedback').textContent = '';
  panels.forEach(panel => { panel.hidden = panel !== requests; });
  renderRequests(); updateMood(); position(); $('requests-close').focus();
}
$('requests-close').onclick = closePanels;
$('requests-replies').onclick = () => openConversations(true);
$('interaction-close').onclick = () => { interaction.hidden = true; currentNotice = undefined; presentNextNotice(); showNextReply(); };
$('interaction-open').onclick = () => openSession(currentNotice?.sessionId);
$('interaction-pending').onclick = openRequests;

function receive(message) {
  if (!message || typeof message !== 'object') return;
  switch (message.type) {
    case 'init':
      options = { ...options, ...message.options };
      document.documentElement.style.setProperty('--size', `${options.size}px`);
      if (message.snapshot) snapshot = message.snapshot;
      pet.dataset.hostReady = 'true';
      body?.set({ bounds: bounds() }); render(); break;
    case 'configure':
      options = { ...options, ...message.options };
      document.documentElement.style.setProperty('--size', `${options.size}px`);
      body?.set({ bounds: bounds() });
      render(); break;
    case 'ui-control':
      if (message.command === 'chat') openChat();
      else if (message.command === 'sessions') openConversations(true);
      else if (message.command === 'sleep') $('toggle-sleep').click();
      else if (message.command === 'sound') $('toggle-sound').click();
      break;
    case 'characters': $('open-characters').click(); break;
    case 'snapshot': snapshot = { ...message.snapshot, results: message.snapshot.results ?? snapshot.results ?? [] }; render(); break;
    case 'notification-state': {
      const value = message.snapshot;
      if (!value || value.protocol !== 1 || !Array.isArray(value.interactions)) break;
      if (notificationState && value.runtime.generation !== notificationState.runtime.generation) { noticeQueue.clear(); interaction.hidden = true; currentNotice = undefined; snoozing.clear(); }
      notificationState = value;
      for (const [id, pending] of snoozing) { const item = value.interactions.find(item => item.id === id); if (!item || item.state === 'settled' || item.dueAt !== pending.dueAt) snoozing.delete(id); }
      if (currentNotice?.requestIds.length && !currentNotice.requestIds.some(id => pendingRequests().some(item => item.id === id))) { interaction.hidden = true; currentNotice = undefined; }
      if (value.runtime.phase !== 'running' || !value.runtime.visible || value.runtime.suspended) { noticeQueue.clear(); interaction.hidden = true; }
      render(); break;
    }
    case 'notification-snooze-result': {
      snoozing.delete(message.interactionId);
      if (!message.ok) $('request-feedback').textContent = notificationCopy(notificationLocale()).unavailable;
      renderRequests(); break;
    }
    case 'notice': {
      if (!options.notifications) break;
      if (message.notice.category && message.notice.id) {
        if (notificationState && (notificationState.runtime.phase !== 'running' || !notificationState.runtime.visible || notificationState.runtime.suspended)) break;
        noticeQueue.push(message.notice); presentNextNotice(); break;
      }
      // Task notices are expressed by the body and inbox, not another status card.
      if (message.notice.kind === 'task') { body?.cue('perk'); break; }
      noticeSession = message.notice.sessionId;
      $('toast-title').textContent = message.notice.title;
      $('toast-body').textContent = message.notice.body;
      $('toast').hidden = false; clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { $('toast').hidden = true; }, options.bubbleDurationMs); break;
    }
    case 'hit-state': pet.dataset.nativeHit = String(message.active); break;
    case 'cursor': hit(message.x, message.y); break;
    case 'display-changed': body?.set({ bounds: bounds() }); body?.place(innerWidth * .6, 1); position(); break;
  }
}

function hit(px, py) {
  cursorPoint = { x: px, y: py };
  const active = pressing || body?.hit({ x: px, y: py }) || [...document.querySelectorAll('.interactive')].some(el => {
    if (el === pet || el.closest('[hidden]')) return false;
    const b = el.getBoundingClientRect();
    return px >= b.left - 2 && px <= b.right + 2 && py >= b.top - 2 && py <= b.bottom + 2;
  });
  if (!!active !== lastHit) { lastHit = !!active; native?.hit(lastHit); }
}

function openChat() { interaction.hidden = true; clearTimeout(touchTimer); touchBlockedUntil = performance.now() + 1000; panels.forEach(p => { p.hidden = true; }); bubble.hidden = true; chat.hidden = false; updateMood(); position(); if (!$('message').disabled) $('message').focus(); }
function openConversations(pending = false) {
  if (!snapshot.sessions.length) return;
  interaction.hidden = true;
  pendingOnly = pending === true;
  $('conversation-search').value = '';
  panels.forEach(p => { p.hidden = true; }); bubble.hidden = true; conversations.hidden = false; render();
  ($('conversation-list').querySelector('[aria-selected=true]') ?? $('conversation-list').querySelector('button'))?.focus();
}
function closePanels() { interaction.hidden = true; panels.forEach(p => { p.hidden = true; }); render(); }
pet.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  touchBlockedUntil = 0; clearTimeout(touchTimer);
  sfx.unlock(); pressing = true; dragging = false; dragStart = { x: event.clientX, y: event.clientY };
  pet.setPointerCapture(event.pointerId);
  body?.pointer('down', { x: event.clientX, y: event.clientY, t: event.timeStamp });
});
function release(event) {
  if (!pressing) return;
  body?.pointer(event.type === 'pointercancel' ? 'cancel' : 'up', { x: event.clientX, y: event.clientY, t: event.timeStamp });
  pressing = false; dragging = false;
  if (event.type === 'pointerup' && native && (event.screenX < screen.availLeft || event.screenX > screen.availLeft + screen.availWidth)) send({ type: 'move-display' });
}
pet.addEventListener('pointerup', release); pet.addEventListener('pointercancel', release);
// The upstream body owns poke, stroke, wake, grab, drop and throw. Respond to its
// authenticated touch events instead of layering an unrelated random click on top.
function onBody(kind, detail) {
  if (kind !== 'touch') return;
  if (detail.kind === 'grab') {
    clearTimeout(touchTimer);
    // Body events arrive with a later animation frame. A completed drag must
    // not close a panel opened by a subsequent double-click.
    if (pressing) { closePanels(); bubble.hidden = true; }
    return;
  }
  if (detail.kind === 'poke' && detail.woke) { asleep = false; appliedMood = undefined; }
  if (detail.kind === 'poke' || detail.kind === 'pet') {
    if (performance.now() < touchBlockedUntil) return;
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
      if (panels.some(p => !p.hidden)) return;
      if (!sessionActivity(snapshot).active) react('happy');
    }, 280);
  }
}
pet.addEventListener('dblclick', openChat);
pet.addEventListener('keydown', event => { if (event.target === pet && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openChat(); } });
pet.addEventListener('contextmenu', event => { event.preventDefault(); clearTimeout(touchTimer); const open = menu.hidden; panels.forEach(p => { p.hidden = true; }); bubble.hidden = true; menu.hidden = !open; interaction.hidden = true; updateMood(); position(); if (!menu.hidden) $('open-characters').focus(); });
pet.addEventListener('pointerenter', () => { hovered = true; }); pet.addEventListener('pointerleave', () => { hovered = false; });
$('chat-current').onclick = openConversations;
$('menu-chat').onclick = openChat;
$('menu-close').onclick = closePanels;
$('conversation-search').oninput = render;
$('sessions-all').onclick = () => { pendingOnly = false; render(); };
$('sessions-pending').onclick = () => { pendingOnly = true; render(); };
$('attention').onclick = () => pendingRequests().length ? openRequests() : openConversations(true);
$('conversation-list').onkeydown = event => {
  const cards = [...$('conversation-list').querySelectorAll('button')], current = cards.indexOf(document.activeElement);
  if (!cards.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + cards.length) % cards.length;
  cards[next].focus();
};
$('conversations-close').onclick = closePanels;
$('chat-close').onclick = closePanels;
$('dismiss').onclick = () => { bubble.hidden = true; acknowledge(bubbleResult); showNextReply(); };
$('bubble-reveal').onclick = () => { speech?.finish(); };
$('bubble-expand').onclick = () => openReader(bubbleResult);
$('chat-read').onclick = () => openReader((snapshot.results ?? []).find(r => r.sessionId === snapshot.sessionId && !r.read) ?? (snapshot.results ?? []).find(r => r.id === snapshot.sessions.find(s => s.id === snapshot.sessionId)?.replyId));
$('reader-close').onclick = closePanels;
for (const [id, offset] of [['reader-prev', -1], ['reader-next', 1]]) $(id).onclick = () => {
  const history = (snapshot.results ?? []).filter(r => r.sessionId === readerResult?.sessionId);
  openReader(history[history.findIndex(r => r.id === readerResult?.id) + offset]);
};
$('reader-session').onclick = () => openSession(readerResult?.sessionId);
$('conversation-list').onclick = event => {
  const card = event.target.closest('[data-session-id]');
  const session = card && snapshot.sessions.find(item => item.id === card.dataset.sessionId);
  if (!session) return;
  conversations.hidden = true;
  if (session.id !== snapshot.sessionId) send({ type: 'select', sessionId: session.id });
  const result = snapshot.results?.find(r => r.sessionId === session.id && !r.read);
  if (result) openReader(result); else render();
};
function openSession(id) { if (id) { send({ type: 'open-session', sessionId: id }); closePanels(); bubble.hidden = true; } }
$('conversation-open').onclick = () => openSession(snapshot.sessionId);
$('chat-session').onclick = () => openSession(snapshot.sessionId);
$('bubble-session').onclick = () => { acknowledge(bubbleResult); openSession(bubbleSession); };
$('chat-form').onsubmit = event => {
  event.preventDefault(); const text = $('message').value.trim();
  if (!text || !snapshot.sessionId) return;
  clearTimeout(touchTimer);
  send({ type: 'chat', text, sessionId: snapshot.sessionId }); $('message').value = ''; chat.hidden = true;
  if (!native) {
    const sessionId = snapshot.sessionId;
    demoState(sessionId, 'thinking');
    setTimeout(() => demoComplete(sessionId, `收到「${text}」！这是演示回复。真实插件会使用 Harness 的模型。`), 350);
  }
};
function preference(field) {
  if (native) send({ type: 'preference', field, value: !options[field] });
  else { options[field] = !options[field]; render(); }
}
$('toggle-roam').onclick = () => preference('roam');
$('toggle-sleep').onclick = () => { if ($('toggle-sleep').disabled) return; asleep = !asleep; if (!asleep) react('happy'); menu.hidden = true; bubble.hidden = true; updateMood(); };
$('toggle-notices').onclick = () => preference('notifications');
$('hide').onclick = () => { if (native) send({ type: 'hide' }); else closePanels(); };
$('toast').onclick = () => { $('toast').hidden = true; openSession(noticeSession); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePanels(); });
$('message').onkeydown = event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); $('chat-form').requestSubmit(); } };
document.querySelectorAll('[data-gesture]').forEach(button => { button.onclick = () => {
  closePanels(); act(body, activeView, button.dataset.gesture === 'wave' ? 'wave' : 'love');
  if (!snapshot.active) react('happy');
}; });
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
document.addEventListener('pointermove', event => {
  const point = { x: event.clientX, y: event.clientY, t: event.timeStamp };
  if (pressing && !dragging && Math.hypot(point.x - dragStart.x, point.y - dragStart.y) > 6) {
    dragging = true; clearTimeout(touchTimer); closePanels(); bubble.hidden = true;
  }
  body?.pointer('move', point); hit(point.x, point.y);
});
document.addEventListener('pointerleave', () => {
  body?.pointer('leave', {});
  if (!pressing) { cursorPoint = undefined; lastHit = false; native?.hit(false); }
});
addEventListener('resize', () => { body?.set({ bounds: bounds() }); previewBody?.set({ bounds: previewBounds() }); position(); });
$('toggle-sound').onclick = () => { sfx.set(!sfx.isOn()); updateMood(); };


let last = performance.now();
function animate(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  for (const [id, pending] of snoozing) if (now >= pending.expiresAt) { snoozing.delete(id); $('request-feedback').textContent = notificationCopy(notificationLocale()).unavailable; renderRequests(); }
  if (!options.notifications) { noticeQueue.clear(); interaction.hidden = true; }
  if (!interaction.hidden) {
    if (interaction.matches(':hover') || interaction.contains(document.activeElement)) interactionExpires = now + options.bubbleDurationMs;
    if (now >= interactionExpires) { interaction.hidden = true; currentNotice = undefined; }
  }
  presentNextNotice();
  updateMood(now);
  if (!reduced && pet.dataset.mood === 'talking' && now >= talkAt) { body?.talk(); talkAt = now + 180; }
  body?.tick(reduced && !reducedNeedsStep && !pressing && !['air', 'drag', 'wake'].includes(body.layout?.mode) ? 0 : dt); reducedNeedsStep = false;
  if (!characters.hidden || libraryBusy) previewBody?.tick(reduced ? 0 : dt);
  if (speech && !bubble.hidden) {
    if (reduced) speech.finish(); else speech.step(dt);
    bubble.dataset.typing = String(!speech.done); $('bubble-reveal').hidden = speech.done;
    if (speech.done && speechExpires === Infinity) speechExpires = now + options.bubbleDurationMs;
    if (bubble.matches(':hover') || bubble.contains(document.activeElement)) speechExpires = now + options.bubbleDurationMs;
    if (now >= speechExpires) { bubble.hidden = true; showNextReply(); }
  }
  position();
  // The character can walk beneath a stationary cursor, or away from it.
  if (cursorPoint) hit(cursorPoint.x, cursorPoint.y);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

const demoTimers = new Map();
function demoState(id, mood, text = '') {
  clearTimeout(demoTimers.get(id));
  const session = snapshot.sessions.find(s => s.id === id);
  if (!session) return;
  Object.assign(session, { mood, active: ['thinking', 'talking', 'working', 'waiting'].includes(mood), text, updatedAt: Date.now(), revision: (session.revision ?? 0) + 1 });
  if (id === snapshot.sessionId) snapshot = { ...snapshot, ...session, sessionId: id };
  render();
}
function demoComplete(id, text) {
  const session = snapshot.sessions.find(s => s.id === id);
  const result = { id: `${id}:${Date.now()}:${snapshot.results.length}`, sessionId: id, text, time: Date.now(), read: false };
  snapshot.results.push(result);
  Object.assign(session, { reply: text, replyId: result.id, unread: (session.unread ?? 0) + 1 });
  demoState(id, 'happy', text);
  demoTimers.set(id, setTimeout(() => demoState(id, 'idle'), 2500));
}

if (native) native.subscribe(receive);
else {
  document.body.classList.add('preview'); $('demo').hidden = false;
  options.size = 190; document.documentElement.style.setProperty('--size', '190px');
  snapshot.results = [];
  snapshot.sessionId = 'demo'; snapshot.sessions = [
    { id: 'demo', label: '演示会话', project: 'dsh-coopanion', cwd: '/workspace/dsh-coopanion', prompt: '让角色在思考与回复时做出对应的动作', createdAt: Date.now() - 3600000, updatedAt: Date.now(), mood: 'idle', text: snapshot.text, revision: 0 },
    { id: 'demo-notes', label: '另一个想法', project: 'dsh-coopanion', cwd: '/workspace/dsh-coopanion', prompt: '重做角色菜单与会话选择，让它更像伙伴', createdAt: Date.now() - 7200000, updatedAt: Date.now() - 1800000, mood: 'idle', text: '', revision: 0 },
  ];
  const texts = { thinking: '让我想一想，怎样把这个功能做好…', talking: '我想到了。让思考、说话与工作各有自己的动作，就能一眼看出这段对话在做什么。', working: '正在看文件 · src/index.ts', waiting: '下一步需要你确认。真实插件会引导你回到 Harness。', happy: '任务完成啦！要不要休息一下？🐳', error: '任务遇到了问题，请回到 Harness 查看详情。' };
  document.querySelectorAll('[data-demo]').forEach(button => { button.onclick = () => {
    const mood = button.dataset.demo;
    if (mood === 'happy') demoComplete(snapshot.sessionId, texts.happy);
    else if (mood === 'long') demoComplete(snapshot.sessionId, '动画、气泡和会话的展示已经分开了。\n\n' + '思考和工具调用由动作表达，最终回复可以展开阅读。长内容会完整保留，不会在一千二百字处截断。\n\n'.repeat(35) + '最后一句：这份回复完整地保留下来了。');
    else if (mood === 'background') demoComplete(snapshot.sessions.find(s => s.id !== snapshot.sessionId).id, '后台会话已经完成，这是它的最终回复。');
    else demoState(snapshot.sessionId, mood, texts[mood]);
  }; });
  y = innerHeight - pet.offsetHeight - 42; render();
}

async function setCharacter(view, scheme = '') {
  const next = await loadBody({ layer: $('body-layer'), pack: view, start: { x: body?.layout?.x ?? innerWidth * .68, facing: body?.layout?.facing ?? 1, scheme }, theme: 'light', bounds: bounds(),
    onSound: (name, kind, ...args) => sfx.play(name, kind, ...args),
    onEvent: (kind, detail) => { if (body === next) onBody(kind, detail); },
    onError: error => { $('character-status').textContent = `角色运行失败：${error.message}`; if (body === next && view.id !== BUILTIN_ID) void restoreBuiltin(); },
  });
  body?.dispose(); body = next; activeView = view; activeScheme = knownScheme(view, scheme); activeName = nameIn(view.name);
  // A new body has not reported its geometry yet. Retire the previous body's
  // input region until position() receives the new body's first frame.
  pet.hidden = true; delete pet.dataset.mode; delete pet.dataset.pressing;
  appliedMood = appliedControls = undefined;
  sfx.usePack(view.base, view.sounds);
  pet.dataset.character = view.id; pet.dataset.scheme = activeScheme;
  applyAppearance();
  pet.setAttribute('aria-label', `${activeName}，点击互动，双击聊天，右键菜单，拖动移动`);
  render();
}
function applyAppearance() {
  const preset = activeView.presets.find(p => p.id === activeScheme);
  const accent = preset?.accent ?? activeView.axes[0]?.options.find(o => o.id === activeScheme)?.accent ?? '#4d6bfe';
  document.documentElement.style.setProperty('--skin-eye', accent);
  document.documentElement.style.setProperty('--accent', preset?.console?.light.a ?? accent);
  document.documentElement.style.setProperty('--accent2', preset?.console?.light.a2 ?? accent);
  $('chat-character').textContent = activeName; $('menu-name').textContent = activeName;
  const thumb = preset?.thumb ?? activeView.thumb;
  $('menu-portrait').hidden = !thumb; $('menu-emblem').hidden = !!thumb;
  if (thumb) { $('menu-portrait').src = new URL(activeView.base + thumb, location.href).href; $('menu-portrait').onerror = () => { $('menu-portrait').hidden = true; $('menu-emblem').hidden = false; }; }
  trayKey = undefined; updateMood();
}
async function restoreBuiltin() {
  try { const view = await library.load(BUILTIN_ID); await setCharacter(view); await library.select(BUILTIN_ID, activeScheme); }
  catch (error) { $('character-status').textContent = `无法加载内置角色：${error.message}`; }
}
function setBusy(value) {
  libraryBusy = value;
  for (const id of ['character-select', 'character-import', 'character-use', 'character-scheme', 'character-action', 'character-test']) $(id).disabled = value;
  for (const el of $('character-axes').querySelectorAll('select')) el.disabled = value;
  $('character-use').disabled = value || !previewCharacter;
  $('character-remove').disabled = value || $('character-select').value === BUILTIN_ID;
}
function fillSchemes(pack, scheme) {
  previewScheme = knownScheme(pack, scheme);
  const choices = pack.presets.map(p => new Option(nameIn(p.name) || p.id, p.id));
  choices.push(new Option(pack.axes.length ? '自定义搭配' : '默认', '__custom'));
  $('character-scheme').replaceChildren(...choices);
  $('character-scheme').value = pack.presets.some(p => p.id === previewScheme) ? previewScheme : '__custom';
  const preset = pack.presets.find(p => p.id === previewScheme), parts = previewScheme.split('-');
  $('character-axes').replaceChildren(...pack.axes.map((axis, i) => {
    const label = document.createElement('label'); label.textContent = nameIn(axis.name);
    const select = document.createElement('select'); select.dataset.axis = axis.id; select.setAttribute('aria-label', nameIn(axis.name));
    select.replaceChildren(...axis.options.map(o => new Option(nameIn(o.name), o.id)));
    select.value = preset?.pick[axis.id] ?? parts[i]; label.append(select); return label;
  }));
  $('character-axes').hidden = pack.axes.length === 0 || (pack.axes.length === 1 && pack.axes[0].options.every(o => pack.presets.some(p => p.pick[pack.axes[0].id] === o.id)));
}
async function preview(id) {
  previewCharacter = undefined; previewBody?.dispose(); previewBody = undefined;
  const view = await library.load(id);
  fillSchemes(view, libraryState.schemes[id]);
  $('character-action').replaceChildren(...view.vocab.map(w => new Option(w.names.zh?.[0] ?? w.id, w.id)));
  $('character-action').value = view.vocab.some(w => w.id === 'wave') ? 'wave' : view.vocab[0]?.id ?? '';
  const next = await loadBody({ layer: $('character-preview'), pack: view, start: { x: previewBounds().W / 2, facing: 1, scheme: previewScheme }, theme: 'light', bounds: previewBounds(),
    onError: error => { previewCharacter = undefined; $('character-status').textContent = `预览失败：${error.message}`; setBusy(false); },
  });
  previewBody = next; previewBody.set({ roam: 'off' }); previewCharacter = view;
  $('character-about').textContent = nameIn(view.about);
  $('character-credit').textContent = `作者：${view.author ?? '未注明'} · ${view.credits?.map(c => c.name).join('、') ?? ''} · 许可：${view.builtin ? '代码 AGPL-3.0-or-later；素材见权利声明' : view.license ?? '由角色作者注明'}`;
  $('character-use').textContent = pet.dataset.character === id ? '正在使用' : '使用角色';
}
async function refreshCharacters(selected) {
  libraryState = await library.list();
  $('character-select').replaceChildren(...libraryState.characters.map(pack => new Option(nameIn(pack.name), pack.id)));
  $('character-select').value = selected ?? libraryState.selected;
  if (!$('character-select').value) $('character-select').value = BUILTIN_ID;
  await preview($('character-select').value);
  if (libraryState.problems.length) $('character-status').textContent = libraryState.problems.join('；');
}
async function characterOperation(operation) {
  if (libraryBusy) return;
  setBusy(true);
  try { await operation(); }
  catch (error) { $('character-status').textContent = `操作未完成：${String(error.message ?? error).slice(0, 400)}`; }
  finally { setBusy(false); position(); }
}
$('open-characters').onclick = () => {
  closePanels(); bubble.hidden = true; characters.hidden = false; position();
  void characterOperation(() => refreshCharacters(pet.dataset.character));
};
$('characters-close').onclick = () => { previewBody?.dispose(); previewBody = undefined; closePanels(); };
$('character-select').onchange = () => void characterOperation(() => preview($('character-select').value));
$('character-scheme').onchange = () => void characterOperation(async () => {
  const scheme = $('character-scheme').value;
  const custom = [...$('character-axes').querySelectorAll('select')].map(el => el.value).join('-');
  fillSchemes(previewCharacter, scheme === '__custom' ? custom : scheme);
  await previewBody?.setScheme(previewScheme, { fade: reduced ? 0 : .25 });
  $('character-use').textContent = '使用这个配色';
});
$('character-axes').onchange = () => void characterOperation(async () => {
  const scheme = [...$('character-axes').querySelectorAll('select')].map(el => el.value).join('-');
  fillSchemes(previewCharacter, scheme);
  await previewBody?.setScheme(previewScheme, { fade: reduced ? 0 : .25 });
  $('character-use').textContent = '使用这个搭配';
});
$('character-test').onclick = () => { if (previewBody && previewCharacter) act(previewBody, previewCharacter, $('character-action').value); };
$('character-import').onclick = () => $('character-file').click();
$('character-file').onchange = () => void characterOperation(async () => {
  const file = $('character-file').files[0]; if (!file) return;
  try {
    if (file.size > PACK_LIMIT) throw new Error('角色包不能超过 128 MiB');
    const after = await library.import(await file.arrayBuffer());
    await refreshCharacters(after.importedId);
    $('character-status').textContent = '已导入。预览满意后点击使用角色。';
  } finally { $('character-file').value = ''; }
});
$('character-use').onclick = () => void characterOperation(async () => {
  if (!previewCharacter) return;
  const scheme = previewScheme;
  if (activeView?.id === previewCharacter.id && activeView.revision === previewCharacter.revision) {
    await body.setScheme(scheme, { fade: reduced ? 0 : .25 }); activeScheme = scheme; pet.dataset.scheme = scheme;
    applyAppearance();
  } else await setCharacter(previewCharacter, scheme);
  await library.select(previewCharacter.id, scheme);
  $('character-use').textContent = '正在使用'; $('character-status').textContent = '已切换，重启后会保留这个角色和配色。';
});
$('character-remove').onclick = () => void characterOperation(async () => {
  const id = $('character-select').value;
  if (pet.dataset.character === id) await restoreBuiltin();
  previewBody?.dispose(); previewBody = undefined;
  await library.remove(id); await refreshCharacters(); $('character-status').textContent = '已删除本地角色包。';
});
void (async () => {
  setBusy(true);
  try {
    libraryState = await library.list();
    try { await setCharacter(await library.load(libraryState.selected), libraryState.schemes[libraryState.selected]); }
    catch (error) { await restoreBuiltin(); $('character-status').textContent = `已恢复内置大肥鱼：${String(error.message ?? error).slice(0, 300)}`; }
  } catch (error) { $('character-status').textContent = `角色加载失败：${error.message}`; }
  finally { setBusy(false); }
})();
