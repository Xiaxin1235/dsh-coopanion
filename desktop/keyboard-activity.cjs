const { spawn } = require('node:child_process');
const { join } = require('node:path');
const STATES = new Set(['active', 'idle', 'unknown']);
// A bounded enum-only stream. Unsupported platforms and stale/dead helpers are unknown.
exports.createKeyboardActivity = ({ platform = process.platform, start = spawn, now = () => performance.now() } = {}) => {
  let child, value = 'unknown', at = -Infinity, pending = '';
  return {
    configure(enabled) {
      if (!enabled) { const old = child; child = undefined; old?.kill(); value = 'unknown'; at = -Infinity; pending = ''; return; }
      if (child || platform !== 'darwin') return;
      const next = start('/usr/bin/osascript', ['-l', 'JavaScript', join(__dirname, 'keyboard-activity.jxa')], { stdio: ['ignore', 'pipe', 'ignore'] });
      child = next;
      next.stdout.on('data', bytes => {
        if (child !== next) return;
        pending += bytes.toString();
        if (pending.length > 256) { next.kill(); value = 'unknown'; at = -Infinity; pending = ''; return; }
        let index;
        while ((index = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, index); pending = pending.slice(index + 1);
          value = STATES.has(line) ? line : 'unknown'; at = now();
        }
      });
      const ended = () => { if (child === next) { value = 'unknown'; at = -Infinity; } };
      next.on('error', ended); next.on('exit', ended);
    },
    sample() { return now() - at <= 2500 ? value : 'unknown'; },
  };
};
