import { inflateSync } from 'node:zlib';

// Read-only decoding for authoring checks. Does not transform or write image pixels.
export function readRgbaPng(raw) {
  if (raw.length > 16 * 1024 * 1024 || !raw.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Expected a PNG no larger than 16 MiB');
  let width, height, depth, color, interlace, ended = false;
  const compressed = [];
  for (let p = 8; p + 12 <= raw.length;) {
    const length = raw.readUInt32BE(p), kind = raw.toString('ascii', p + 4, p + 8);
    if (p + length + 12 > raw.length) throw new Error('Truncated PNG chunk');
    const chunk = raw.subarray(p + 8, p + 8 + length);
    if (kind === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); depth = chunk[8]; color = chunk[9]; interlace = chunk[12]; }
    if (kind === 'IDAT') compressed.push(chunk);
    p += length + 12;
    if (kind === 'IEND') { ended = true; break; }
  }
  if (!ended || !width || !height || width * height > 16_777_216 || depth !== 8 || color !== 6 || interlace !== 0) throw new Error('Inspector supports non-interlaced 8-bit RGBA PNG up to 16 megapixels');
  const stride = width * 4, expected = (stride + 1) * height;
  const scan = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (scan.length !== expected) throw new Error('Unexpected PNG pixel length');
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p-a), db = Math.abs(p-b), dc = Math.abs(p-c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (stride + 1)];
    if (filter > 4) throw new Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? pixels[i-4] : 0, b = y ? pixels[i-stride] : 0, c = y && x >= 4 ? pixels[i-stride-4] : 0;
      pixels[i] = (scan[y * (stride+1) + x + 1] + [0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]) & 255;
    }
  }
  return { width, height, depth, interlace, pixels };
}
