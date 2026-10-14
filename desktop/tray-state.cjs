const labels = { idle: '陪伴中', thinking: '正在思考', talking: '正在回复', working: '正在工作', waiting: '等待确认', happy: '任务完成', error: '需要关注', sleeping: '休息中' };
const { sessionActivity } = require('../web/session-ui.js');

/** Desktop and status bar project the same host snapshot and acknowledged preferences. */
function trayState(snapshot = {}, presentation = {}, options = {}, visible = false) {
  const selected = snapshot.sessions?.find(session => session.id === snapshot.sessionId);
  const activity = sessionActivity(snapshot), active = activity.active;
  const mood = !active && !activity.waiting && !activity.errors && presentation.sleeping ? 'sleeping' : activity.mood;
  const name = presentation.name || 'DeepSeek 大肥鱼';
  return { name, characterId: presentation.characterId || 'whale', scheme: presentation.scheme || '', iconReady: !!presentation.ready, icon: mood === 'sleeping' ? 'sleeping' : activity.icon, mood, stateLabel: labels[mood] ?? labels.idle, activity, active, sleeping: mood === 'sleeping', visible, roam: options.roam ?? true, notifications: options.notifications ?? true, sound: presentation.sound ?? true,
    sessionId: snapshot.sessionId ?? null, sessionLabel: selected?.label ?? '还没有会话',
    sessions: [...(snapshot.sessions ?? [])].sort((a, b) => Number(b.id === snapshot.sessionId) - Number(a.id === snapshot.sessionId) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).map(session => ({ id: session.id, label: session.label, project: session.project, selected: session.id === snapshot.sessionId, mood: session.mood, unread: Number(!!session.unread) })),
    tooltip: `${name} · ${labels[mood] ?? labels.idle}\n关注：${selected?.label ?? '还没有会话'}\n${activity.busy} 段进行中 · ${activity.waiting + activity.errors} 段需要你 · ${activity.unread} 份未读回复`,
    title: '',
  };
}
module.exports = { trayState };
