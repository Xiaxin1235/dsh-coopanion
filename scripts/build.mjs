import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await rm('dist', { recursive: true, force: true });
await build({ entryPoints: ['src/index.ts', 'src/bridge.ts', 'src/model.ts'], outdir: 'dist', bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22', sourcemap: true });
await build({ entryPoints: ['src/character-store.ts', 'src/figure-server.ts'], outdir: 'dist', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
await build({ entryPoints: ['src/client/index.ts'], outfile: 'dist/client.js', bundle: true, packages: 'external', platform: 'browser', format: 'cjs', target: 'chrome130', jsx: 'automatic', loader: { '.css': 'text' },
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
});
