/** Live output drives short mouth bursts; an unchanged work status is not speech. */
export function createLiveMouth() {
  let seen = new Map(), until = -Infinity, nextAt = -Infinity, lastAt = -Infinity;
  return {
    step(snapshot, now, enabled = true) {
      const sessions = snapshot.sessions?.length ? snapshot.sessions : snapshot.sessionId ? [{ ...snapshot, id: snapshot.sessionId }] : [];
      const current = new Map(); let fresh = false, talking = false;
      for (const session of sessions) {
        const live = Number.isSafeInteger(session.speechRevision);
        const progress = live ? session.speechRevision : session.revision ?? 0;
        const previous = seen.get(session.id);
        const eligible = session.mood === 'talking' && session.active !== false && session.streaming !== false;
        const changed = !previous || previous.live !== live || progress > previous.progress;
        if (eligible) { talking = true; fresh ||= changed && (!live || progress > 0); }
        current.set(session.id, { live, progress: previous?.live === live ? Math.max(previous.progress, progress) : progress });
      }
      seen = current;
      const gap = now < lastAt || now - lastAt > 1000;
      lastAt = now;
      if (!enabled || !talking || gap && until !== -Infinity) { until = nextAt = -Infinity; return false; }
      if (fresh) until = now + 1200;
      if (now >= until || now < nextAt) return false;
      nextAt = now + 180; return true;
    },
  };
}
