// Local raster-frame decoding. Loading the PNG data URL into an image would
// repeat its full base64 text in Chromium's Network events on every frame.
export function pngFrameBlob(href) {
  const prefix = 'data:image/png;base64,';
  if (typeof href !== 'string' || !href.startsWith(prefix)) throw new Error('Expected a PNG frame');
  const binary = atob(href.slice(prefix.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

export function decodePngFrame(href) {
  return createImageBitmap(pngFrameBlob(href));
}
