import { createWhaleFigure } from '/web/upstream/whale/figure.js';

// Preview-only adapter: the upstream raster option makes the real mesh visible in captures.
// It does not change the figure, motion, production runtime or generated shell pixels.
export async function createReferenceBody(base, options) {
  const whaleBase = new URL('/web/upstream/whale/', base);
  const figure = await createWhaleFigure(whaleBase, { ...options, raster:true, asset:path=>new URL(path,whaleBase) });
  return options.kit.createBody(options.host,{ figure });
}
