// Supplemental acceptance probe; the fixed package and its source stay unchanged.
// Normalize the reload in all groups, shield physical/CDP input, and record RAF delivery.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2), index = args.indexOf('--checkout');
const checkout = resolve(index < 0 ? '.' : args[index + 1]);
const original = await readFile(join(checkout, 'scripts/measure-idle.mjs'), 'utf8').catch(async error => {
  // M5 predates the measurement template. Use the explicitly supplied M6 template.
  const template = args.indexOf('--template'); if (template < 0) throw error;
  return readFile(resolve(args[template + 1]), 'utf8');
});
const digest = value => createHash('sha256').update(value).digest('hex');
const probe = { probeSha256: digest(await readFile(new URL(import.meta.url))), templateSha256: digest(original), normalizedReload: true, inputShield: 'CDP Input.setIgnoreInputEvents', frameCounter: 'requestAnimationFrame, same extra callback in every group' };
function replace(source, from, to) { assert.equal(source.split(from).length, 2, `template seam changed: ${from}`); return source.replace(from, to); }
let source = replace(original, "from 'playwright-core'", `from ${JSON.stringify(pathToFileURL(join(checkout, 'node_modules/playwright-core/index.mjs')).href)}`);
source = replace(source, "if (mode !== 'baseline') {", 'if (true) {');
source = replace(source, 'const page = browser.contexts()[0].pages()[0];', `const page = browser.contexts()[0].pages()[0];
  const inputSession = await page.context().newCDPSession(page);
  await inputSession.send('Input.setIgnoreInputEvents', {ignore:true});
  await page.addInitScript(() => {
    window.resourceInputs = 0; window.resourceFrames = 0;
    for (const type of ['pointerdown','keydown']) addEventListener(type, event => { if (event.isTrusted) window.resourceInputs++; }, true);
    const count = () => { window.resourceFrames++; requestAnimationFrame(count); }; requestAnimationFrame(count);
  });`);
source = replace(source, 'let previous = sampleTree(pid), at = performance.now();', 'let previous = sampleTree(pid), at = performance.now(); let previousFrames = await page.evaluate(() => window.resourceFrames);');
source = replace(source, 'heapBytes: performance.memory?.usedJSHeapSize', `heapBytes: performance.memory?.usedJSHeapSize, deliveredFrames: window.resourceFrames, trustedInputs: window.resourceInputs, pressing: document.querySelector('#pet').dataset.pressing, openPanels: ['chat','reader','requests','menu','characters','conversations','bubble','interaction'].filter(id => !document.getElementById(id).hidden)`);
source = replace(source, 'samples.push({ round:', `renderer.framesPerSecond = (renderer.deliveredFrames - previousFrames) / elapsed; previousFrames = renderer.deliveredFrames;
      assert.equal(renderer.trustedInputs, 0, 'isolated idle observation received trusted input');
      assert.notEqual(renderer.mode, 'drag', 'idle observation entered pointer dragging');
      assert.notEqual(renderer.pressing, 'true'); assert.deepEqual(renderer.openPanels, []);
      samples.push({ round:`);
source = replace(source, 'const report = { schema: 1,', `const report = { schema: 1, measurementProbe: {...${JSON.stringify(probe)}, generatedScriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')},`);
const directory = await mkdtemp(join(tmpdir(), 'dsh-m6-resource-probe-'));
try {
  const file = join(directory, 'measure.mjs'); await writeFile(file, source);
  await import(pathToFileURL(file).href);
} finally { await rm(directory, { recursive: true, force: true }); }
