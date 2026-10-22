import { parseArgs } from 'node:util';
import { hostRuntime } from './lib/host-runtime.mjs';
const { values } = parseArgs({ options: { version: { type: 'string' }, lock: { type: 'string' } } });
if (!values.version) throw Error('Usage: npm run runtime:host -- --version <exact> [--lock <package-lock.json>]');
const runtime = await hostRuntime(values.version, { lockFile: values.lock });
try { console.log(JSON.stringify({ runtime: runtime.path, key: runtime.key })); } finally { await runtime.dispose(); }
