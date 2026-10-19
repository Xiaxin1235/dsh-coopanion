import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRgbaPng } from './lib/rgba-png.mjs';
import { planHandArt } from '../web/upstream/whale/hand-art.js';

export async function checkHandArt(path) {
  const spec = JSON.parse(await readFile(path, 'utf8')), reports = {}, plan = planHandArt(spec);
  for (const name of ['reach', 'grip', 'release']) {
    const a = spec.assets[name], bytes = await readFile(resolve(dirname(path), a.image));
    const png = readRgbaPng(bytes), alpha = ([x, y]) => png.pixels[(Math.round(y) * png.width + Math.round(x)) * 4 + 3];
    const inside = ([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < png.width && y < png.height;
    if (!inside(a.wrist) || !inside(a.contact)) throw new Error(name + ': source anchor outside canvas');
    const b = a.visibleBounds, gates = {
      sourceIdentity: createHash('sha256').update(bytes).digest('hex') === a.sha256 && a.canvas.width === png.width && a.canvas.height === png.height,
      visibleBoundsInsideCanvas: b.x > 0 && b.y > 0 && b.x + b.width < png.width && b.y + b.height < png.height,
      attachedWrist: alpha(a.wrist) >= 240,
      clearOuterMargin: alpha([0, 0]) === 0 && alpha([png.width - 1, png.height - 1]) === 0,
      usableGeometry: plan[name].scale > 0 && plan[name].full.box.every(Number.isFinite),
    };
    if (name === 'grip') {
      const f = a.frontRect, p = a.frontProbe;
      gates.transparentGraspPocket = alpha(a.contact) < 16;
      gates.visibleFrontFinger = inside(p) && alpha(p) >= 240 && p[0] >= f.x && p[0] <= f.x + f.width && p[1] >= f.y && p[1] <= f.y + f.height;
      gates.frontCropInsideImage = f.x >= b.x && f.y >= b.y && f.x + f.width <= b.x + b.width && f.y + f.height <= b.y + b.height;
    }
    reports[name] = { sha256: a.sha256, canvas: a.canvas, wristAlpha: alpha(a.wrist), contactAlpha: alpha(a.contact), sourceScale: plan[name].scale, gates };
  }
  const reference = await readFile(new URL('../' + spec.sourceReference, import.meta.url));
  const referenceIdentity = createHash('sha256').update(reference).digest('hex') === spec.sourceReferenceSha256;
  const shellSpec = JSON.parse(await readFile(new URL('../web/props/shell/asset.json', import.meta.url), 'utf8'));
  const shell = readRgbaPng(await readFile(new URL('../web/props/shell/shell.png', import.meta.url)));
  const shellX = Math.round(shellSpec.visibleBounds.x + spec.propGrip.x * shellSpec.visibleBounds.width), shellY = Math.round(shellSpec.visibleBounds.y + spec.propGrip.y * shellSpec.visibleBounds.height);
  const propRimAlpha = shell.pixels[(shellY * shell.width + shellX) * 4 + 3];
  const passed = referenceIdentity && propRimAlpha >= 240 && Object.values(reports).every(r => Object.values(r.gates).every(Boolean));
  return { id: spec.id, passed, referenceIdentity, propRim: { x: shellX, y: shellY, alpha: propRimAlpha }, assets: reports, limitations: ['Read-only alpha, identity and anchor checks; no pixel rewrite or visual-quality inference.', 'Original PNG byte provenance is retained; PNG chunk CRC is not checked.'] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkHandArt(resolve(process.argv[2] ?? 'web/props/shell/hands/asset.json'));
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 2;
}
