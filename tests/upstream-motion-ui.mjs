// Real WebGL regression in an isolated page, with a controlled body clock.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from '../scripts/lib/playwright.mjs';

const output = resolve(process.env.UPSTREAM_MOTION_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(), 'dsh-motion-ui-')));
await mkdir(output, { recursive: true });
const web = resolve('web');
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (path === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><style>body{margin:0;background:#eff8fc}svg{display:block}</style><svg width="2000" height="800"><ellipse id="shadow"/><g id="pet"></g><g id="fx"></g></svg>');
      return;
    }
    const file = resolve(web, '.' + path.replace(/^\/web/, ''));
    if (!path.startsWith('/web/upstream/') && !path.startsWith('/web/props/')) throw new Error('path');
    if (!file.startsWith(web + sep)) throw new Error('path');
    response.setHeader('Content-Type', { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(), headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 2000, height: 800 } });
const errors = [], checks = [], samples = {};
page.on('pageerror', error => errors.push(error.message));
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };
const correlation = pairs => {
  const mean = axis => pairs.reduce((sum, p) => sum + p[axis], 0) / pairs.length;
  const a = mean(0), b = mean(1), sum = f => pairs.reduce((n, p) => n + f(p[0] - a, p[1] - b), 0);
  return sum((x, y) => x * y) / Math.sqrt(sum(x => x * x) * sum((_x, y) => y * y));
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const { createWhaleFigure } = await import('/web/upstream/whale/figure.js');
    const { createPet } = await import('/web/upstream/kit/body.js');
    let body, figure, last, pose = {};
    window.motionRegression = {
      async reset({ navigation = false, facing = 1, authored = {} } = {}) {
        figure?.dispose(); pose = authored;
        figure = await createWhaleFigure(new URL('/web/upstream/whale/', location.href), {
          motionPose: () => pose,
          gripProp: { url: new URL('/web/props/shell/shell.png', location.href), hand: [166, 199], box: [151, 189, 30, 20], grip: [.5, .5], ground: [.5, 1] },
          gripPose: () => ({ visible: true }),
        });
        const observed = { ...figure, draw(group, face, frame) {
          last = { eyes: face.eyes, ...frame }; figure.draw(group, face, frame);
        } };
        body = createPet({ petG: document.querySelector('#pet'), shadowEl: document.querySelector('#shadow'), fxG: document.querySelector('#fx') }, {
          figure: observed, navigation, roam: 'off', startX: facing === 1 ? 250 : 1750,
          sfx: { play() {} }, bounds: () => ({ W: 2000, H: 800, floorY: 740, S: 180 / 256 }),
        });
        body.pet.facing = body.pet.faceVis = facing;
        body.render();
      },
      command(word) { body.doWord(word); },
      walk(facing) { body.walkTo(facing === 1 ? 1750 : 250, false, 1); },
      navigate() { return body.navigate({ id: 2, generation: 1, target: { x: 1750, y: 500 }, model: {
        width: 2000, height: 800, revision: 1, body: { left: 100, right: 100, top: 220, bottom: 0 }, margin: 0, obstacles: [],
      } }); },
      advance(frames, renderEvery = 1) {
        const result = [];
        for (let i = 0; i < frames; i++) {
          body.step(1 / 60);
          if (i % renderEvery === 0 || i === frames - 1) {
            body.render();
            const grip = figure.gripFrame;
            result.push({ mode: last.mode, facing: last.facing, arms: [grip.angles.armNear, grip.angles.armFar],
              legs: last.legs.map(([x, y, fx, fy]) => -Math.atan2(fx - x, fy - y) * 180 / Math.PI),
              binding: Math.hypot(grip.hand.x - grip.propGrip.x, grip.hand.y - grip.propGrip.y) });
          }
        }
        return result;
      },
      snapshot() { return { eyes: last.eyes, mode: last.mode, drowse: last.drowse, layout: body.layout(),
        webgl: !!(document.querySelector('canvas')?.getContext('webgl2') || document.querySelector('canvas')?.getContext('webgl')), pixels: document.querySelector('canvas')?.toDataURL().length }; },
    };
  });
  await page.evaluate(async () => { await motionRegression.reset(); motionRegression.command('sit'); motionRegression.advance(7200, 120); });
  const seated = await page.evaluate(() => motionRegression.snapshot());
  check(seated.mode === 'sit' && seated.drowse < .2 && seated.eyes.every(e => e.shape === 'lid' && e.ry > 10), 'explicit sit stays awake after two controlled minutes');
  check(seated.webgl && seated.pixels > 1000, 'real whale textures draw through WebGL');
  await page.screenshot({ path: join(output, 'awake-sit.png') });
  for (const [name, navigation, facing] of [['walk-right', false, 1], ['walk-left', false, -1], ['navigate', true, 1]]) {
    samples[name] = await page.evaluate(async ({ navigation, facing }) => {
      await motionRegression.reset({ navigation, facing });
      if (navigation) motionRegression.navigate(); else motionRegression.walk(facing);
      return motionRegression.advance(420).slice(180);
    }, { navigation, facing });
    const frames = samples[name];
    check(frames.every(f => f.mode === (navigation ? 'navigate' : 'walk') && Math.sign(f.facing) === facing), `${name}: real body keeps its movement and facing`);
    for (let side = 0; side < 2; side++) check(correlation(frames.map(f => [f.legs[side], f.arms[side]])) < -.98, `${name}: arm ${side} opposes its same-side leg`);
    check(frames.every(f => f.binding < 1e-6), `${name}: projected hand and prop stay bound`);
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  const authored = await page.evaluate(async () => {
    await motionRegression.reset({ authored: { armNear: -23, armFar: -42 } });
    motionRegression.walk(1); return motionRegression.advance(180);
  });
  check(authored.every(f => f.arms[0] === -23 && f.arms[1] === -42 && f.binding < 1e-6), 'authored arms retain exact ownership during walking');
  check(errors.length === 0, 'no browser errors');
  await writeFile(join(output, 'regression.json'), JSON.stringify({ passed: true, checks, errors, samples, seated, browser: browser.version(), node: process.version }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, browser: browser.version(), output }));
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  await writeFile(join(output, 'regression.json'), JSON.stringify({ passed: false, error: error.stack, checks, errors, samples }, null, 2));
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
