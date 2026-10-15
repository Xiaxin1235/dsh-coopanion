import { loadBody, knownScheme } from './upstream/body-host.js';
import { createSfx } from './upstream/sound.js';
import { createSpeech, replyPreview } from './speech.js';
import { createNoticeQueue, pendingInteractions, notificationPresentation, notificationCopy } from './notification-ui.js';
import { ChatComposer, shortSessionIds, sessionTime, sessionActivity, inboxContents, unreadReplies } from './session-ui.js';
import { renderReplyMarkdown } from './markdown-runtime.js';
import { petLanguage, petCopy, localizedText, appNoticeCopy, automaticPetLanguage, sessionStateLabel } from './locale.js';
import { textScale } from './text-scale.js';
import { viewportPoint, panelPosition } from './display-geometry.js';
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
let toastNotice;
const snoozing = new Map();
const notificationLocale = () => options.locale ? petLanguage(options.locale) : automaticPetLanguage(navigator.languages ?? [navigator.language]);
const uiCopy = () => petCopy(notificationLocale());
const pendingRequests = () => pendingInteractions(notificationState);
const userInputOccupied = () => pressing || dragging || panels.some(p => !p.hidden) || !bubble.hidden;
const userOccupied = () => userInputOccupied() || body?.layout?.busy;
const panelAnchors = new WeakMap();
const library = native?.characters ?? browserCharacters;
const sfx = createSfx({ storageKey: 'dsh-pet.sound.v2', volume: .35 });
const nameIn = names => localizedText(names, notificationLocale());
const wordName = (word, view = previewCharacter) => word.names?.[notificationLocale()]?.[0] ?? (view?.builtin ? uiCopy().words[word.id] : undefined) ?? nameIn(word.names)?.[0] ?? word.id;
let body, previewBody, previewCharacter, activeView, activeScheme, activeName = 'DeepSeek 大肥鱼', libraryState, libraryBusy = false;
let appliedMood, appliedControls, speech, speechExpires = Infinity, pressing = false, dragStart, dragging = false, previewScheme = "", reducedNeedsStep = true;
let options = { textScale: 1, size: 180, roam: true, notifications: true, bubbleDurationMs: 12000 };
let snapshot = { mood: 'idle', text: '你好。点点我，或双击和我说话。', sessionId: null, sessions: [] };
let x = innerWidth * .68, y = innerHeight - 155, hovered = false, asleep = false, toastTimer, noticeSession;
let cursorPoint, lastHit;
let renderedSessionId = null, reactionUntil = 0, reactionMood, bubbleSession, trayKey, touchTimer, touchBlockedUntil = 0;
let bubbleResult, readerResult, pendingOnly = false, talkAt = 0;
let readerQueue, inboxState = { requests: [], issues: [], replies: [], total: 0 };
let resizeLayout, displayGeometry, pendingDisplayPlacement, resizeOrigin;
let stageWidth = innerWidth;
const composer = new ChatComposer();
const chatTimers = new Map();
let draftSessionId;
const shownResults = new Set(), acknowledgedResults = new Set();
let renderedLocale;
let characterFeedback = { key: 'characterHint', args: [] };
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

function setCopyNode(id, key) { const node = $(id); node.dataset.i18n = key; node.textContent = uiCopy()[key]; }
function characterStatus(key, ...args) {
  characterFeedback = { key, args }; delete $('character-status').dataset.i18n;
  const value = uiCopy()[key]; $('character-status').textContent = typeof value === 'function' ? value(...args) : value;
}
function refreshPreviewCopy() {
  const view = previewCharacter; if (!view) return;
  for (const option of $('character-action').options) { const word = view.vocab.find(word => word.id === option.value); if (word) option.textContent = wordName(word); }
  const selected = $('character-scheme').value; fillSchemes(view, previewScheme); $('character-scheme').value = selected;
  $('character-about').textContent = nameIn(view.about);
  $('character-credit').textContent = uiCopy().authorCredit(view.author ?? uiCopy().unknownAuthor, view.credits?.map(c => c.name).join('、') ?? '', view.builtin ? uiCopy().builtinLicense : view.license ?? uiCopy().authorLicense);
}
function applyLocale() {
  const locale = notificationLocale(); if (renderedLocale === locale) return;
  renderedLocale = locale;
  const text = uiCopy(), notice = notificationCopy(locale);
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'; document.title = text.title;
  const lookup = key => key.startsWith('notice:') ? notice[key.slice(7)] : key.startsWith('demo:') ? text.demoButtons[key.slice(5)] : text[key];
  for (const [attribute, target] of [['data-i18n', null], ['data-i18n-aria-label', 'aria-label'], ['data-i18n-placeholder', 'placeholder'], ['data-i18n-title', 'title']]) {
    for (const node of document.querySelectorAll(`[${attribute}]`)) {
      const value = lookup(node.getAttribute(attribute));
      if (typeof value !== 'string') throw new Error(`Missing locale text: ${node.getAttribute(attribute)}`);
      if (target) node.setAttribute(target, value); else node.textContent = value;
    }
  }
  activeName = activeView ? nameIn(activeView.name) : text.defaultName;
  $('chat-character').textContent = activeName; $('menu-name').textContent = activeName;
  pet.setAttribute('aria-label', text.petLabel(activeName));
  if (bubbleResult) bubble.setAttribute('aria-label', text.finalReply(snapshot.sessions.find(session => session.id === bubbleResult.sessionId)?.label ?? activeName));
  if (libraryState) for (const option of $('character-select').options) { const view = libraryState.characters.find(view => view.id === option.value); if (view) option.textContent = nameIn(view.name); }
  refreshPreviewCopy(); characterStatus(characterFeedback.key, ...characterFeedback.args);
  if (currentNotice && !interaction.hidden) {
    const value = notificationPresentation(currentNotice, locale, body?.words ?? []);
    $('interaction-title').textContent = value.title; $('interaction-preview').textContent = value.body;
  }
  if (toastNotice && !$('toast').hidden) { const value = appNoticeCopy(toastNotice, locale); $('toast-title').textContent = value.title; $('toast-body').textContent = value.body; }
  trayKey = undefined;
}

function bounds() { return { W: innerWidth, H: innerHeight, floorY: innerHeight - 24, S: options.size / 256 }; }
function previewBounds() { const el = $('character-preview'); return { W: el.clientWidth, H: el.clientHeight, floorY: el.clientHeight - 14, S: Math.min(el.clientWidth, el.clientHeight - 22) / 256 }; }
function position() {
  const layout = body?.layout;
  const box = layout?.box;
  // Bounds are applied inside the figure frame. Reanchor once its new geometry arrives.
  if (resizeLayout && layout !== resizeLayout && box?.w > 0 && box?.h > 0) {
    for (const panel of [bubble, interaction, ...panels, $('attention')]) panelAnchors.delete(panel);
    resizeLayout = undefined;
  }
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
    const { x: px, y: py } = panelPosition(panelAnchor, { width: pw, height: ph }, { width: innerWidth, height: innerHeight });
    panel.style.left = `${px}px`; panel.style.top = `${py}px`;
    panel.style.setProperty('--tail', `${Math.max(22, Math.min(pw - 22, panelAnchor.x - px))}px`);
  }
  const attention = $('attention');
  attention.hidden = !inboxState.total || panels.some(p => !p.hidden);
  const holding = !attention.hidden && (attention.matches(':hover') || document.activeElement === attention);
  if (!holding) panelAnchors.delete(attention);
  else if (!panelAnchors.has(attention)) { const b = attention.getBoundingClientRect(); panelAnchors.set(attention, { x: b.x, y: b.y }); }
  const point = panelAnchors.get(attention) ?? { x: Math.max(8, Math.min(innerWidth - 55, anchor.x + options.size * .25)), y: Math.max(8, Math.min(innerHeight - 38, anchor.y + 15)) };
  Object.assign(attention.style, { left: `${Math.round(Math.max(8, Math.min(innerWidth - attention.offsetWidth - 8, point.x)))}px`, top: `${Math.round(Math.max(8, Math.min(innerHeight - attention.offsetHeight - 8, point.y)))}px` });
}
function speak(result) {
  const source = snapshot.sessions.find(session => session.id === result.sessionId);
  const preview = replyPreview(result.text);
  $('bubble-status').textContent = source?.label ?? '';
  bubble.setAttribute('aria-label', uiCopy().finalReply(source?.label ?? activeName));
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
  const result = unreadReplies(snapshot, acknowledgedResults).find(r => r.sessionId === snapshot.sessionId && !shownResults.has(r.id));
  if (result) speak(result);
}
function completionHasReply(notice) {
  return ['completed', 'reply', 'goal-progress'].includes(notice?.category) && notice.sessionId === snapshot.sessionId &&
    snapshot.results?.some(result => result.id === `${notice.sessionId}:${notice.turn}:${notice.seq}`);
}
function acknowledge(result) {
  if (!result || result.read) return;
  // Use the identities captured when this reply was shown. A new turn arriving
  // during reading remains unread, even if it belongs to the same session.
  for (const id of result.unreadIds ?? [result.id]) {
    if (acknowledgedResults.has(id)) continue;
    acknowledgedResults.add(id); send({ type: 'read', resultId: id });
  }
}
function openReader(result, queue) {
  if (!result) return;
  interaction.hidden = true;
  clearTimeout(touchTimer); touchBlockedUntil = performance.now() + 1000;
  panels.forEach(p => { p.hidden = true; }); bubble.hidden = true; reader.hidden = false;
  readerResult = result; readerQueue = queue;
  const source = snapshot.sessions.find(s => s.id === result.sessionId);
  $('reader-title').textContent = source?.label ?? uiCopy().sessionReply;
  $('reader-detail').textContent = `${source?.project ?? ''} · ${sessionTime({ updatedAt: result.time }, notificationLocale())}`;
  renderReplyMarkdown($('reader-text'), result.text); $('reader-text').scrollTop = 0;
  updateReaderNavigation(); acknowledge(result); updateMood(); position(); $('reader-text').focus();
}
function updateReaderNavigation() {
  const copy = notificationCopy(notificationLocale());
  $('reader-caption').textContent = copy.replyCaption; $('reader-inbox').textContent = copy.inbox; $('reader-inbox').hidden = !readerQueue;
  $('reader-session').textContent = copy.continue; $('reader-prev').ariaLabel = copy.previous; $('reader-next').ariaLabel = copy.next;
  const history = readerQueue ?? (snapshot.results ?? []).filter(r => r.sessionId === readerResult?.sessionId);
  const index = history.findIndex(r => r.id === readerResult?.id);
  $('reader-count').textContent = `${Math.max(1, index + 1)} / ${Math.max(1, history.length)}`;
  $('reader-prev').disabled = index <= 0; $('reader-next').disabled = index < 0 || index >= history.length - 1;
  if (readerResult) {
    const source = snapshot.sessions.find(session => session.id === readerResult.sessionId);
    $('reader-detail').textContent = `${source?.project ?? ''} · ${sessionTime({ updatedAt: readerResult.time }, notificationLocale())}`;
  }
}
function react(mood) { reactionMood = mood; reactionUntil = performance.now() + 700; }
function act(actor, pack, word) {
  if (pack?.vocab.some(w => w.id === word) && (!actor.words || actor.words.includes(word))) actor.do(word);
}
function updateMood(now = performance.now()) {
  const labels = uiCopy().labels;
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
  $('toggle-sleep').disabled = active; $('toggle-sleep').title = active ? uiCopy().sleepBusy : uiCopy().sleepWake;
  $('toggle-notices').setAttribute('aria-checked', String(options.notifications));
  $('toggle-sound').setAttribute('aria-checked', String(sfx.isOn()));
  $('menu-state').textContent = `${sessionStateLabel(snapshot.sessions?.find(s => s.id === snapshot.sessionId), notificationLocale(), mood)}${snapshot.sessionId ? ' · ' + uiCopy().connected : ''}`;
  const presentation = { type: 'presentation', locale: notificationLocale(), characterId: activeView.id, scheme: activeScheme, name: activeName, mood, sleeping: asleep, sound: sfx.isOn(), ready: !!body.layout };
  const nextTrayKey = JSON.stringify(presentation);
  if (nextTrayKey !== trayKey) { trayKey = nextTrayKey; native?.action(presentation); }
}

function render() {
  applyLocale(); const labels = uiCopy().labels;
  const previous = renderedSessionId;
  const selected = snapshot.sessions.find(session => session.id === snapshot.sessionId);
  const shortIds = shortSessionIds(snapshot.sessions);
  const unreadSources = new Set(unreadReplies(snapshot, acknowledgedResults).map(result => result.sessionId));
  const hasUnread = session => snapshot.results ? unreadSources.has(session.id) : !!session.unread;
  const list = $('conversation-list');
  const query = $('conversation-search').value.trim().toLocaleLowerCase();
  const needsYou = s => ['waiting', 'error'].includes(s.mood) || pendingRequests().some(item => item.sessionId === s.id);
  const matches = snapshot.sessions.filter(session => (!pendingOnly || hasUnread(session) || needsYou(session)) && [session.label, session.project, session.cwd, session.prompt, session.id].join(' ').toLocaleLowerCase().includes(query));
  matches.sort((a, b) => Number(needsYou(b)) - Number(needsYou(a)) || Number(hasUnread(b)) - Number(hasUnread(a)) || Number(b.id === snapshot.sessionId) - Number(a.id === snapshot.sessionId) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const listKey = JSON.stringify([notificationLocale(), query, pendingOnly, matches.map(session => [session.id, session.label, session.prompt, session.cwd, session.updatedAt, session.mood, hasUnread(session), session.chatAvailable, session.id === snapshot.sessionId])]);
  if (list.dataset.key !== listKey) {
    const activeId = document.activeElement?.dataset?.sessionId;
    const entries = matches.map(session => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'conversation-card';
      card.dataset.sessionId = session.id; card.dataset.mood = session.mood; card.setAttribute('role', 'option'); card.setAttribute('aria-selected', String(session.id === snapshot.sessionId));
      card.dataset.unread = String(hasUnread(session));
      card.tabIndex = session.id === snapshot.sessionId ? 0 : -1;
      card.title = `${session.label}\n${session.prompt ?? ''}\n${session.cwd ?? session.project ?? ''}\n${session.id}`;
      const copy = document.createElement('span'), meta = document.createElement('small'), status = document.createElement('em'), time = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small'), prompt = document.createElement('small'), mark = document.createElement('b');
      meta.className = 'session-meta'; status.textContent = `${session.id === snapshot.sessionId ? uiCopy().focused + ' · ' : ''}${sessionStateLabel(session, notificationLocale())}${hasUnread(session) ? ' · ' + uiCopy().unread : ''}${session.chatAvailable === false ? ' · ' + uiCopy().notOpen : ''}`;
      time.textContent = sessionTime(session, notificationLocale()); meta.append(status, time);
      name.textContent = session.label; detail.className = 'session-detail'; detail.textContent = `${session.cwd || session.project || uiCopy().session} · #${shortIds.get(session.id)}`;
      prompt.className = 'session-prompt'; prompt.textContent = session.prompt && session.prompt !== session.label ? uiCopy().recent(session.prompt) : ''; prompt.hidden = !prompt.textContent;
      mark.textContent = '✓'; mark.setAttribute('aria-hidden', 'true');
      copy.append(meta, name, prompt, detail); card.append(copy, mark); return card;
    });
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'conversation-empty'; empty.textContent = query ? uiCopy().emptySearch : pendingOnly ? uiCopy().emptyPending : uiCopy().emptySessions; entries.push(empty);
    }
    list.replaceChildren(...entries); list.dataset.key = listKey;
    if (activeId) list.querySelector(`[data-session-id="${CSS.escape(activeId)}"]`)?.focus();
  }
  const activity = sessionActivity(snapshot);
  $('conversation-count').textContent = uiCopy().activity(activity.busy, snapshot.results ? unreadSources.size : activity.unread);
  $('sessions-all').setAttribute('aria-pressed', String(!pendingOnly)); $('sessions-pending').setAttribute('aria-pressed', String(pendingOnly));
  inboxState = inboxContents(snapshot, pendingRequests(), acknowledgedResults);
  const pendingCount = inboxState.requests.length + inboxState.issues.length;
  $('attention').hidden = !inboxState.total || panels.some(p => !p.hidden);
  $('attention-count').textContent = String(inboxState.total);
  $('attention').dataset.urgent = String(!!pendingCount);
  $('attention').title = $('attention').ariaLabel = notificationCopy(notificationLocale()).inboxSummary(inboxState.replies.length, pendingCount);
  $('chat-current').disabled = !snapshot.sessions.length; $('chat-session-name').textContent = selected?.label ?? uiCopy().noSession;
  $('chat-current').setAttribute('aria-label', selected ? uiCopy().chatTarget(selected.label) : uiCopy().emptySessions);
  $('chat-session-state').textContent = sessionStateLabel(selected, notificationLocale());
  $('chat-session-detail').textContent = selected ? `${selected.cwd || selected.project || ''} · #${shortIds.get(selected.id)}` : '';
  const latestReply = snapshot.results?.find(r => r.id === selected?.replyId)?.text || selected?.reply || '';
  $('chat-reply').textContent = latestReply ? replyPreview(latestReply).text : ''; $('chat-reply').hidden = !latestReply;
  $('chat-read').hidden = !latestReply;
  const enabled = !!snapshot.sessionId && selected?.chatAvailable !== false;
  const draft = composer.state(snapshot.sessionId);
  draftSessionId = snapshot.sessionId;
  if ($('message').value !== draft.text) $('message').value = draft.text;
  $('message').disabled = !enabled || draft.phase === 'sending'; $('send').disabled = !enabled || draft.phase === 'sending';
  $('send').textContent = draft.phase === 'failed' ? uiCopy().retrySend : uiCopy().send;
  $('chat-send-state').textContent = draft.phase === 'failed' ? uiCopy().sendFailure(draft.code) : uiCopy()[{ sending: 'sending', accepted: 'sendAccepted' }[draft.phase]] ?? '';
  $('chat-send-state').dataset.state = draft.phase;
  $('conversation-open').disabled = !snapshot.sessionId; $('chat-session').disabled = !snapshot.sessionId;
  $('chat-help').textContent = enabled ? uiCopy().chatHelp(selected.label) : snapshot.sessionId ? uiCopy().unavailableChat : uiCopy().noChat;
  if (previous !== snapshot.sessionId) {
    bubble.hidden = true;
    clearTimeout(touchTimer); reactionUntil = 0;
  }
  renderedSessionId = snapshot.sessionId;
  if (!reader.hidden) updateReaderNavigation();
  // Host can enqueue the role notice before the final-result IPC frame. The
  // focused reply then supplies completion presentation for that exact event.
  if (completionHasReply(currentNotice)) { interaction.hidden = true; currentNotice = undefined; }
  showNextReply(); presentNextNotice(); renderRequests(); updateMood(); position();
}

function presentNextNotice() {
  if (!options.notifications || !interaction.hidden || userOccupied()) return;
  if (notificationState && (notificationState.runtime.phase !== 'running' || !notificationState.runtime.visible || notificationState.runtime.suspended)) return;
  let notice = noticeQueue.next(false, notificationState?.interactions);
  while (notice && completionHasReply(notice)) notice = noticeQueue.next(false, notificationState?.interactions);
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
  const copy = notificationCopy(notificationLocale());
  inboxState = inboxContents(snapshot, pendingRequests(), acknowledgedResults);
  const { requests: items, issues, replies } = inboxState;
  const sources = new Map(snapshot.sessions.map(session => [session.id, session])), shortIds = shortSessionIds(snapshot.sessions);
  const sourceDetail = id => { const session = sources.get(id); return [session?.project || session?.cwd, `#${shortIds.get(id) ?? id}`].filter(Boolean).join(' · '); };
  $('requests-title').textContent = copy.inboxTitle; $('inbox-caption').textContent = copy.inboxCaption; $('requests-close').ariaLabel = copy.close;
  $('inbox-count').textContent = copy.inboxSummary(replies.length, items.length + issues.length);
  $('inbox-focus').textContent = copy.focus(sources.get(snapshot.sessionId)?.label ?? '—');
  $('inbox-empty').textContent = copy.inboxEmpty; $('inbox-empty').hidden = !!inboxState.total;
  const keys = [notificationLocale(), snapshot.sessions.map(session => [session.id, session.label, session.project, session.cwd])];
  replaceInboxList($('request-list'), JSON.stringify([...keys, items, [...snoozing.keys()], options.reminders, options.notifications]), () => items.map(item => {
    const card = document.createElement('article'); card.className = 'request-card';
    const label = document.createElement('strong'), preview = document.createElement('p'), meta = document.createElement('small'), actions = document.createElement('div');
    label.textContent = item.kind === 'question' ? copy.questionLabel : copy.approvalLabel;
    preview.textContent = item.preview;
    const session = snapshot.sessions.find(session => session.id === item.sessionId);
    meta.textContent = `${session?.label ?? item.sessionId}${item.state === 'continued' ? ' · ' + copy.continued : ''}${item.dueAt ? ' · ' + copy.delay + ': ' + new Intl.DateTimeFormat(notificationLocale(), { hour: '2-digit', minute: '2-digit' }).format(item.dueAt) : ''}`;
    const open = document.createElement('button'); open.textContent = copy.handle; open.dataset.requestId = item.id; open.dataset.inboxKey = item.id; open.dataset.action = 'open'; open.onclick = () => openSession(item.sessionId);
    const later = document.createElement('button'); later.textContent = snoozing.has(item.id) ? copy.snoozing : copy.snooze; later.dataset.requestId = item.id; later.dataset.inboxKey = item.id; later.dataset.action = 'snooze'; later.disabled = snoozing.has(item.id) || !options.notifications || options.reminders === false;
    later.onclick = () => { snoozing.set(item.id, { dueAt: item.dueAt, expiresAt: performance.now() + 10000 }); $('request-feedback').textContent = ''; send({ type: 'notification-snooze', interactionId: item.id, generation: notificationState.runtime.generation }); renderRequests(); };
    actions.append(open, later); card.append(label, preview, meta, actions); return card;
  }));
  replaceInboxList($('inbox-issues'), JSON.stringify([...keys, issues.map(session => [session.id, session.mood, session.text])]), () => issues.map(session => {
    const card = document.createElement('article'); card.className = 'inbox-card inbox-issue';
    const meta = document.createElement('small'), label = document.createElement('strong'), preview = document.createElement('p'), actions = document.createElement('div'), open = document.createElement('button');
    meta.textContent = `${session.mood === 'error' ? copy.errorLabel : copy.waitingLabel} · ${sourceDetail(session.id)}`;
    label.textContent = session.label; preview.textContent = session.mood === 'error' ? petCopy(notificationLocale()).issueError : petCopy(notificationLocale()).issueWaiting;
    open.textContent = copy.handle; open.dataset.inboxKey = session.id; open.dataset.action = 'open'; open.onclick = () => openSession(session.id);
    actions.append(open); card.append(meta, label, preview, actions); return card;
  }));
  // Confirmed reply text is immutable for its result id; avoid rescanning long bodies on live frames.
  replaceInboxList($('inbox-replies'), JSON.stringify([...keys, replies.map(result => [result.id, result.sessionId, result.time])]), () => replies.map(result => {
    const card = document.createElement('article'); card.className = 'inbox-card inbox-reply';
    const content = document.createElement('button'), meta = document.createElement('small'), label = document.createElement('strong'), preview = document.createElement('span'), detail = document.createElement('small'), actions = document.createElement('div'), open = document.createElement('button');
    content.className = 'inbox-content'; content.dataset.resultId = result.id; content.dataset.inboxKey = result.id; content.dataset.action = 'read';
    content.ariaLabel = `${copy.readReply} · ${sources.get(result.sessionId)?.label ?? result.sessionId}`;
    // Capture the queue at the explicit read action so incoming replies cannot reorder it.
    content.onclick = () => openReader(result, inboxContents(snapshot, pendingRequests(), acknowledgedResults).replies.map(item => ({ ...item })));
    meta.textContent = `${copy.newReply} · ${sessionTime({ updatedAt: result.time }, notificationLocale())}`;
    label.textContent = sources.get(result.sessionId)?.label ?? result.sessionId;
    preview.className = 'inbox-preview'; preview.textContent = replyPreview(result.text).text;
    detail.textContent = `${sourceDetail(result.sessionId)} · ${copy.readReply}`;
    content.append(meta, label, preview, detail);
    open.textContent = copy.continue; open.dataset.resultId = result.id; open.dataset.inboxKey = result.id; open.dataset.action = 'open'; open.onclick = () => { acknowledge(result); continueSession(result.sessionId); };
    actions.append(open); card.append(content, actions); return card;
  }));
}
function replaceInboxList(list, key, build) {
  if (list.dataset.key === key) return;
  const focused = list.contains(document.activeElement) ? document.activeElement.dataset : undefined;
  list.replaceChildren(...build()); list.dataset.key = key; list.hidden = !list.children.length;
  if (focused?.inboxKey) (list.querySelector(`[data-inbox-key="${CSS.escape(focused.inboxKey)}"][data-action="${focused.action}"]`) ?? $('requests-close')).focus();
}
function openRequests(autoRead = true) {
  clearTimeout(touchTimer); interaction.hidden = true; bubble.hidden = true; $('request-feedback').textContent = '';
  const contents = inboxContents(snapshot, pendingRequests(), acknowledgedResults);
  if (autoRead !== false && contents.replies.length === 1 && contents.total === 1) { openReader(contents.replies[0], contents.replies.map(item => ({ ...item }))); return; }
  panels.forEach(panel => { panel.hidden = panel !== requests; });
  renderRequests(); updateMood(); position(); $('requests-close').focus();
}
$('requests-close').onclick = closePanels;
$('interaction-close').onclick = () => { interaction.hidden = true; currentNotice = undefined; presentNextNotice(); showNextReply(); };
$('interaction-open').onclick = () => openSession(currentNotice?.sessionId);
$('interaction-pending').onclick = () => openRequests(false);

function applyOptions(value) {
  const previousSize = options.size;
  options = { ...options, ...value, textScale: Object.hasOwn(value ?? {}, 'textScale') ? textScale(value.textScale) : options.textScale };
  document.documentElement.style.setProperty('--size', `${options.size}px`);
  document.documentElement.style.setProperty('--text-scale', String(options.textScale));
  if (options.size !== previousSize) body?.set({ bounds: bounds() });
  // Keep DOM, captured reader result, composer, speech and expiry clocks intact.
  position();
}
// Font reflow and async Markdown/locale layout changes need fresh panel bounds.
const panelResize = new ResizeObserver(() => position());
for (const panel of [bubble, interaction, ...panels, $('attention')]) panelResize.observe(panel);

function receive(message) {
  if (!message || typeof message !== 'object') return;
  switch (message.type) {
    case 'init':
      applyOptions(message.options);
      if (message.snapshot) snapshot = message.snapshot;
      // Recovery restores unread results as an inbox baseline, without speaking them again.
      if (message.baseline) for (const result of snapshot.results ?? []) shownResults.add(result.id);
      pet.dataset.hostReady = 'true';
      body?.set({ bounds: bounds() }); render(); break;
    case 'configure': {
      const changed = Object.keys(message.options ?? {}).some(key => key !== 'textScale' && key !== 'size' && options[key] !== message.options[key]);
      applyOptions(message.options);
      if (changed) render();
      break;
    }
    case 'ui-control':
      if (message.command === 'chat') openChat();
      else if (message.command === 'sessions') openRequests();
      else if (message.command === 'sleep') $('toggle-sleep').click();
      else if (message.command === 'sound') $('toggle-sound').click();
      break;
    case 'characters': $('open-characters').click(); break;
    case 'snapshot': snapshot = { ...message.snapshot, results: message.snapshot.results ?? snapshot.results ?? [] }; render(); break;
    case 'chat-result':
      if (composer.receive(message)) {
        clearTimeout(chatTimers.get(message.requestId)); chatTimers.delete(message.requestId); render();
      }
      break;
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
      toastNotice = message.notice;
      const toast = appNoticeCopy(message.notice, notificationLocale());
      $('toast-title').textContent = toast.title;
      $('toast-body').textContent = toast.body;
      $('toast').hidden = false; clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { $('toast').hidden = true; }, options.bubbleDurationMs); break;
    }
    case 'hit-state': pet.dataset.nativeHit = String(message.active); break;
    case 'cursor': {
      if (!displayGeometry || message.revision !== displayGeometry.revision) break;
      const point = viewportPoint(message, displayGeometry.contentBounds, { width: innerWidth, height: innerHeight });
      hit(point.x, point.y); break;
    }
    case 'display-changed': {
      if (!Number.isSafeInteger(message.revision) || message.revision <= (displayGeometry?.revision ?? 0)) break;
      if (displayGeometry && message.displayId !== displayGeometry.displayId) {
        pendingDisplayPlacement = resizeOrigin ?? { ratio: (body?.layout?.x ?? stageWidth * .6) / stageWidth, facing: body?.layout?.facing ?? 1 };
      }
      displayGeometry = message;
      pet.dataset.displayId = String(message.displayId); pet.dataset.displayRevision = String(message.revision);
      cursorPoint = undefined; lastHit = false; native?.hit(false);
      resizeStage(); break;
    }
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
  const moved = dragging;
  body?.pointer(event.type === 'pointercancel' ? 'cancel' : 'up', { x: event.clientX, y: event.clientY, t: event.timeStamp });
  pressing = false; dragging = false;
  if (event.type === 'pointerup' && native && moved) send({ type: 'move-display' });
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
$('attention').onclick = () => openRequests();
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
$('chat-read').onclick = () => openReader(unreadReplies(snapshot, acknowledgedResults).find(r => r.sessionId === snapshot.sessionId) ?? (snapshot.results ?? []).find(r => r.id === snapshot.sessions.find(s => s.id === snapshot.sessionId)?.replyId));
$('reader-close').onclick = closePanels;
for (const [id, offset] of [['reader-prev', -1], ['reader-next', 1]]) $(id).onclick = () => {
  const history = readerQueue ?? (snapshot.results ?? []).filter(r => r.sessionId === readerResult?.sessionId);
  openReader(history[history.findIndex(r => r.id === readerResult?.id) + offset], readerQueue);
};
$('reader-inbox').onclick = () => openRequests(false);
$('reader-session').onclick = () => { acknowledge(readerResult); continueSession(readerResult?.sessionId); };
$('conversation-list').onclick = event => {
  const card = event.target.closest('[data-session-id]');
  const session = card && snapshot.sessions.find(item => item.id === card.dataset.sessionId);
  if (!session) return;
  conversations.hidden = true;
  if (session.id !== snapshot.sessionId) send({ type: 'select', sessionId: session.id });
  const result = unreadReplies(snapshot, acknowledgedResults).find(r => r.sessionId === session.id);
  if (result) openReader(result); else render();
};
function continueSession(id) {
  if (!id || !snapshot.sessions.some(session => session.id === id)) return;
  send({ type: 'select', sessionId: id }); snapshot = { ...snapshot, sessionId: id }; render(); openChat();
}
function openSession(id) { if (id) { send({ type: 'open-session', sessionId: id }); closePanels(); bubble.hidden = true; } }
$('conversation-open').onclick = () => openSession(snapshot.sessionId);
$('chat-session').onclick = () => openSession(snapshot.sessionId);
$('bubble-session').onclick = () => { acknowledge(bubbleResult); openSession(bubbleSession); };
$('message').oninput = () => { composer.edit(draftSessionId, $('message').value); };
$('chat-form').onsubmit = event => {
  event.preventDefault();
  const sessionId = snapshot.sessionId;
  if (!sessionId || snapshot.sessions.find(session => session.id === sessionId)?.chatAvailable === false) return;
  composer.edit(sessionId, $('message').value);
  const request = composer.begin(sessionId);
  if (!request) return;
  clearTimeout(touchTimer); render();
  clearTimeout(chatTimers.get(request.requestId));
  chatTimers.set(request.requestId, setTimeout(() => { chatTimers.delete(request.requestId); if (composer.expire(request)) render(); }, 15000));
  send(request);
  if (!native) {
    receive({ type: 'chat-result', sessionId, requestId: request.requestId, status: 'accepted' });
    demoState(sessionId, 'thinking');
    setTimeout(() => demoComplete(sessionId, uiCopy().demoReply(request.text)), 350);
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
function resizeStage() {
  if (innerWidth !== stageWidth) resizeOrigin ??= { ratio: (body?.layout?.x ?? stageWidth * .6) / stageWidth, facing: body?.layout?.facing ?? 1 };
  stageWidth = innerWidth;
  resizeLayout = body?.layout;
  body?.set({ bounds: bounds() });
  // Native geometry and viewport resize can arrive in either order. Placement
  // waits until this viewport reflects the newly acknowledged content bounds.
  if (pendingDisplayPlacement && innerWidth === displayGeometry?.contentBounds.width && innerHeight === displayGeometry?.contentBounds.height) {
    body?.place(innerWidth * pendingDisplayPlacement.ratio, pendingDisplayPlacement.facing);
    pendingDisplayPlacement = undefined;
  }
  if (innerWidth === displayGeometry?.contentBounds.width && innerHeight === displayGeometry?.contentBounds.height) resizeOrigin = undefined;
  previewBody?.set({ bounds: previewBounds() }); position();
}
addEventListener('resize', resizeStage);
$('toggle-sound').onclick = () => { sfx.set(!sfx.isOn()); updateMood(); };


let last = performance.now();
function animate(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  for (const [id, pending] of snoozing) if (now >= pending.expiresAt) { snoozing.delete(id); $('request-feedback').textContent = notificationCopy(notificationLocale()).unavailable; renderRequests(); }
  if (!options.notifications) { noticeQueue.clear(); interaction.hidden = true; }
  if (!interaction.hidden) {
    if (interaction.matches(':hover') || interaction.contains(document.activeElement)) interactionExpires = now + options.bubbleDurationMs;
    if (now >= interactionExpires) { interaction.hidden = true; currentNotice = undefined; showNextReply(); }
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
    { id: 'demo', label: uiCopy().demoSession, project: 'dsh-coopanion', cwd: '/workspace/dsh-coopanion', prompt: uiCopy().demoPrompt, createdAt: Date.now() - 3600000, updatedAt: Date.now(), mood: 'idle', text: snapshot.text, revision: 0 },
    { id: 'demo-notes', label: uiCopy().demoOther, project: 'dsh-coopanion', cwd: '/workspace/dsh-coopanion', prompt: uiCopy().demoOtherPrompt, createdAt: Date.now() - 7200000, updatedAt: Date.now() - 1800000, mood: 'idle', text: '', revision: 0 },
  ];

  document.querySelectorAll('[data-demo]').forEach(button => { button.onclick = () => {
    const mood = button.dataset.demo;
    if (mood === 'happy') demoComplete(snapshot.sessionId, uiCopy().demoTexts.happy);
    else if (mood === 'long') demoComplete(snapshot.sessionId, uiCopy().demoLong);
    else if (mood === 'background') demoComplete(snapshot.sessions.find(s => s.id !== snapshot.sessionId).id, uiCopy().demoBackground);
    else demoState(snapshot.sessionId, mood, uiCopy().demoTexts[mood]);
  }; });
  y = innerHeight - pet.offsetHeight - 42; render();
}

async function setCharacter(view, scheme = '') {
  const next = await loadBody({ layer: $('body-layer'), pack: view, start: { x: body?.layout?.x ?? innerWidth * .68, facing: body?.layout?.facing ?? 1, scheme }, theme: 'light', bounds: bounds(),
    onSound: (name, kind, ...args) => sfx.play(name, kind, ...args),
    onEvent: (kind, detail) => { if (body === next) onBody(kind, detail); },
    onError: error => { characterStatus('bodyError', error.message); if (body === next && view.id !== BUILTIN_ID) void restoreBuiltin(); },
  });
  body?.dispose(); body = next; activeView = view; activeScheme = knownScheme(view, scheme); activeName = nameIn(view.name);
  // A new body has not reported its geometry yet. Retire the previous body's
  // input region until position() receives the new body's first frame.
  pet.hidden = true; delete pet.dataset.mode; delete pet.dataset.pressing;
  appliedMood = appliedControls = undefined;
  sfx.usePack(view.base, view.sounds);
  pet.dataset.character = view.id; pet.dataset.scheme = activeScheme;
  applyAppearance();
  pet.setAttribute('aria-label', uiCopy().petLabel(activeName));
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
  catch (error) { characterStatus('builtinError', error.message); }
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
  choices.push(new Option(pack.axes.length ? uiCopy().customOutfit : uiCopy().defaultScheme, '__custom'));
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
  $('character-action').replaceChildren(...view.vocab.map(w => new Option(wordName(w, view), w.id)));
  $('character-action').value = view.vocab.some(w => w.id === 'wave') ? 'wave' : view.vocab[0]?.id ?? '';
  const next = await loadBody({ layer: $('character-preview'), pack: view, start: { x: previewBounds().W / 2, facing: 1, scheme: previewScheme }, theme: 'light', bounds: previewBounds(),
    onError: error => { previewCharacter = undefined; characterStatus('previewError', error.message); setBusy(false); },
  });
  previewBody = next; previewBody.set({ roam: 'off' }); previewCharacter = view;
  $('character-about').textContent = nameIn(view.about);
  $('character-credit').textContent = uiCopy().authorCredit(view.author ?? uiCopy().unknownAuthor, view.credits?.map(c => c.name).join('、') ?? '', view.builtin ? uiCopy().builtinLicense : view.license ?? uiCopy().authorLicense);
  setCopyNode('character-use', pet.dataset.character === id ? 'using' : 'useCharacter');
}
async function refreshCharacters(selected) {
  libraryState = await library.list();
  $('character-select').replaceChildren(...libraryState.characters.map(pack => new Option(nameIn(pack.name), pack.id)));
  $('character-select').value = selected ?? libraryState.selected;
  if (!$('character-select').value) $('character-select').value = BUILTIN_ID;
  await preview($('character-select').value);
  if (libraryState.problems.length) characterStatus('operationError', libraryState.problems.join('; '));
}
async function characterOperation(operation) {
  if (libraryBusy) return;
  setBusy(true);
  try { await operation(); }
  catch (error) { characterStatus('operationError', String(error.message ?? error).slice(0, 400)); }
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
  setCopyNode('character-use', 'useScheme');
});
$('character-axes').onchange = () => void characterOperation(async () => {
  const scheme = [...$('character-axes').querySelectorAll('select')].map(el => el.value).join('-');
  fillSchemes(previewCharacter, scheme);
  await previewBody?.setScheme(previewScheme, { fade: reduced ? 0 : .25 });
  setCopyNode('character-use', 'useOutfit');
});
$('character-test').onclick = () => { if (previewBody && previewCharacter) act(previewBody, previewCharacter, $('character-action').value); };
$('character-import').onclick = () => $('character-file').click();
$('character-file').onchange = () => void characterOperation(async () => {
  const file = $('character-file').files[0]; if (!file) return;
  try {
    if (file.size > PACK_LIMIT) throw new Error(uiCopy().packTooLarge);
    const after = await library.import(await file.arrayBuffer());
    await refreshCharacters(after.importedId);
    characterStatus('imported');
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
  setCopyNode('character-use', 'using'); characterStatus('switched');
});
$('character-remove').onclick = () => void characterOperation(async () => {
  const id = $('character-select').value;
  if (pet.dataset.character === id) await restoreBuiltin();
  previewBody?.dispose(); previewBody = undefined;
  await library.remove(id); await refreshCharacters(); characterStatus('removed');
});
void (async () => {
  setBusy(true);
  try {
    libraryState = await library.list();
    try { await setCharacter(await library.load(libraryState.selected), libraryState.schemes[libraryState.selected]); }
    catch (error) { await restoreBuiltin(); characterStatus('restoreError', String(error.message ?? error).slice(0, 300)); }
  } catch (error) { characterStatus('loadError', error.message); }
  finally { setBusy(false); }
})();
