import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = process.cwd();
const caseRoot = resolve(process.env.DSH_DIAG_CASE);
const base = resolve('.cache/install-resolution-20261018');
process.env.DSH_HOME = join(caseRoot, 'home');
process.env.DSH_TELEMETRY_DISABLED = '1';
for (const [key, dir] of Object.entries({ XDG_CONFIG_HOME: 'config', XDG_CACHE_HOME: 'cache', XDG_DATA_HOME: 'data', XDG_STATE_HOME: 'state' })) {
  process.env[key] = join(caseRoot, dir);
}
const cli = join(project, '.cache/compat-20261017/runtime-rc2/node_modules/@deepseek-ai/dsh/lib/bin.js');
const { runCli } = await import(pathToFileURL(cli).href);
await runCli({
  packageManager: {
    command: process.execPath,
    args: [
      '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs',
      `--cache-dir=${join(base, 'pnpm-cache')}`,
      `--store-dir=${join(base, 'pnpm-store')}`,
      `--config.state-dir=${join(base, 'pnpm-state')}`,
    ],
  },
});
