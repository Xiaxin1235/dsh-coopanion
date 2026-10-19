import { readFile, writeFile } from 'node:fs/promises';
import { readRgbaPng } from '../../../scripts/lib/rgba-png.mjs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only PNG inspection. Deliberately does not crop, resize, recolor or remove backgrounds.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const [input, ...flags] = process.argv.slice(2);
const options=new Map();
if(!input||flags.length%2)throw new Error('Usage: inspect-art-asset.mjs image.png [--output report.json] [--binding asset.json]');
for(let i=0;i<flags.length;i+=2){if(!['--output','--binding'].includes(flags[i])||options.has(flags[i]))throw new Error('Unknown or repeated option');options.set(flags[i],flags[i+1]);}
const raw = await readFile(resolve(input));
const { width, height, depth, interlace, pixels } = readRgbaPng(raw);
let transparent = 0, partial = 0, opaque = 0, border = 0, minX = width, minY = height, maxX = -1, maxY = -1;
const mask = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const alpha = pixels[(y * width + x) * 4 + 3];
  if (!alpha) transparent++; else if (alpha === 255) opaque++; else partial++;
  if (alpha >= 16) {
    mask[y * width + x] = 1;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (!x || !y || x === width-1 || y === height-1) border++;
  }
}
if (maxX < 0) throw new Error('PNG contains no visible subject');
const queue = new Uint32Array(width * height), components = [];
for (let seed = 0; seed < mask.length; seed++) {
  if (!mask[seed]) continue;
  let head = 0, tail = 1; queue[0] = seed; mask[seed] = 0;
  while (head < tail) {
    const i = queue[head++], x = i % width, y = Math.floor(i/width);
    for (const n of [x ? i-1 : -1, x+1 < width ? i+1 : -1, y ? i-width : -1, y+1 < height ? i+width : -1]) if (n >= 0 && mask[n]) { mask[n] = 0; queue[tail++] = n; }
  }
  components.push(tail);
}
components.sort((a,b) => b-a);
const count = width * height, bbox = { x: minX, y: minY, width: maxX-minX+1, height: maxY-minY+1 };
const bottomXs = [];
for (let x = minX; x <= maxX; x++) if (pixels[(maxY * width + x) * 4 + 3] >= 16) bottomXs.push(x);
const normalized = (x,y) => ({ x: Number((x/width).toFixed(6)), y: Number((y/height).toFixed(6)) });
const report = {
  asset: relative(root, resolve(input)), sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length,
  png: { width, height, bitDepth: depth, colorType: 'RGBA', interlaced: false },
  alpha: { transparentPixels: transparent, partialPixels: partial, opaquePixels: opaque, transparentFraction: Number((transparent/count).toFixed(6)), threshold: 16, visibleBorderPixels: border },
  visibleBounds: bbox, marginPixels: { left:minX, top:minY, right:width-maxX-1, bottom:height-maxY-1 },
  silhouette: { connectivity: 4, components: components.length, significantComponents: components.filter(n=>n>=16).length, largestComponentPixels: components[0], strayPixels: components.slice(1).reduce((a,b)=>a+b,0) },
  candidateAnchors: { ground: normalized(bottomXs[Math.floor(bottomXs.length/2)],maxY), grip: normalized((minX+maxX)/2,minY+bbox.height*.68), status:'proposed-not-character-contact-validated' },
  gates: { realTransparency: transparent > count*.05, clearCanvasEdge: border === 0, oneMainSilhouette: components.filter(n=>n>=16).length === 1 },
  limitations: ['Alpha and geometry checks do not prove art quality, semantic correctness, licensing or character contact.', 'Bounds ignore alpha below 16; edge fringes require visual inspection.', 'PNG chunk CRC is not validated; browser decode is checked separately.'],
};
if(options.has('--binding')){
  const binding=JSON.parse(await readFile(resolve(options.get('--binding')),'utf8'));
  const x=Math.round(binding.visibleBounds.x+binding.visibleBounds.width*binding.grip.x),y=Math.round(binding.visibleBounds.y+binding.visibleBounds.height*binding.grip.y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=width||y<0||y>=height)throw new Error('Binding point outside canvas');
  const alpha=pixels[(y*width+x)*4+3];
  report.binding={id:binding.id,gripPixel:{x,y,alpha},status:'opaque-image-contact-point-checked'};
  report.gates.bindingImageIdentity=binding.sha256===report.sha256&&binding.canvas.width===width&&binding.canvas.height===height;
  report.gates.gripInsideVisibleImage=alpha>=240;
}
if (options.has('--output')) await writeFile(resolve(options.get('--output')), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (!Object.values(report.gates).every(Boolean)) process.exitCode = 2;
