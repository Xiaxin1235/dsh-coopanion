import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { git, readJson, releaseNotes, verifyMetadata } from './release-support.mjs';
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  'write-report': { type: 'boolean', default: false },
  report: { type: 'string' },
  'expected-commit': { type: 'string' },
  'expected-version': { type: 'string' },
} });
assert.ok(positionals.length <= 1, 'pass at most one tarball');
assert.ok(!(values['write-report'] && values.report), 'write or verify a report, not both');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const archive = positionals[0] ?? `${pkg.name}-${pkg.version}.tgz`;
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
assert.ok(entries.every(path => path.startsWith('package/') && !path.split('/').includes('..')), 'invalid archive paths');
const unpack = path => execFileSync('tar', ['-xOzf', archive, `package/${path}`], { encoding: 'utf8' });
const packed = JSON.parse(unpack('package.json'));
verifyMetadata(packed, JSON.parse(unpack('npm-shrinkwrap.json')));
if (values['expected-version']) assert.equal(packed.version, values['expected-version'], 'archive version differs from tag');
else assert.equal(packed.version, pkg.version);
assert.equal(packed.repository.url, pkg.repository.url);
for (const required of ['dist/client.js', 'dist/index.js', 'dist/character-store.cjs', 'dist/figure-server.cjs', 'cordis.patch.yml', 'desktop/main.cjs', 'desktop/tray-state.cjs', 'desktop/preload.cjs', 'web/index.html', 'web/pet.js', 'web/speech.js', 'web/session-ui.js', 'web/tray-icon.js', 'web/upstream/kit/rig.js', 'web/upstream/kit/body.js', 'web/upstream/figure-frame.html', 'web/upstream/body-host.js', 'web/upstream/whale/figure.json', 'web/upstream/whale/model.json', 'web/upstream/whale/tex/face.png', 'web/upstream/UPSTREAM.md', 'web/upstream/THIRD_PARTY_NOTICES.md', 'src/figure-server.ts', 'src/upstream/packs.ts', 'scripts/build.mjs', 'npm-shrinkwrap.json', 'tsconfig.json', 'tsconfig.client.json', '.node-version', 'docs/characters.md', 'examples/star/figure.json', 'examples/star/figure.js', 'tests/figures.test.ts', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'LICENSE-MIT', 'README.md']) assert.ok(entries.includes(`package/${required}`), `missing ${required}`);
assert.ok(!entries.some(path => path.includes('node_modules/') || path.includes('.cache/')));
assert.ok(!entries.some(path => /character-runtime|character.schema|\/animation\.|\/character-pack\.|\/web\/characters\//.test(path)), 'old engine and format must not be packaged');
const bytes = readFileSync(archive);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const notes = releaseNotes(unpack('docs/release-notes.md'), packed.version);
if (values['write-report']) {
  assert.equal(git(['status', '--porcelain']), '', 'release report requires a clean committed checkout');
  const sourceCommit = git(['rev-parse', 'HEAD']);
  if (values['expected-commit']) assert.equal(sourceCommit, values['expected-commit']);
  const report = { name: packed.name, version: packed.version, sourceCommit, sha256, integrity };
  writeFileSync(join(dirname(archive), 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dirname(archive), 'release-notes.md'), notes);
}
if (values.report) {
  const report = readJson(values.report);
  assert.ok(values['expected-commit'], '--report requires --expected-commit');
  assert.equal(report.sourceCommit, values['expected-commit'], 'artifact source differs from verified commit');
  assert.equal(report.name, packed.name);
  assert.equal(report.version, packed.version);
  assert.equal(report.sha256, sha256, 'archive SHA-256 differs from verified report');
  assert.equal(report.integrity, integrity, 'archive integrity differs from verified report');
  assert.equal(readFileSync(join(dirname(values.report), 'release-notes.md'), 'utf8'), notes);
}
console.log(`Package verified: ${entries.length} files, upstream runtime, native host and corresponding source included. SHA-256: ${sha256}`);
