/** Observe a rendered animation frame rather than assuming a fixed GPU latency. */
export async function waitForCanvasChange(canvas, previous) {
  const element = await canvas.elementHandle();
  try {
    await canvas.page().waitForFunction(({ element, previous }) => element.toDataURL() !== previous, { element, previous });
  } finally { await element.dispose(); }
}
