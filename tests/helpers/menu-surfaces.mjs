import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

export const menuSnapshot = { mood: 'idle', active: false, sessionId: null, sessions: [], results: [] };
export async function checkMenuSurface(page, { send, locale, textScale, out, name }) {
  await send({ type: 'configure', options: { locale, textScale, companionship: 'off', roam: false } });
  await page.locator('#pet').dispatchEvent('contextmenu', { button: 2 });
  await page.locator('#menu').waitFor();
  await page.waitForFunction(() => document.querySelector('#companion-play').disabled);
  const details = page.locator('#companion-memories');
  if (await details.getAttribute('open') !== null) await details.locator('summary').click();
  await page.screenshot({ path: join(out, `${name}-collapsed.png`) });
  await details.locator('summary').click();
  await page.waitForSelector('#memory-list li');
  // ResizeObserver reanchors expanded panels on the next rendering opportunity.
  // Wait for the contract, rather than sampling the previous collapsed anchor.
  await page.waitForFunction(() => {
    const r=document.querySelector('#menu').getBoundingClientRect();
    return r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1;
  });
  const geometry = () => page.locator('#menu').evaluate(menu => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const body = menu.querySelector('.menu-content');
    return { outer: rect(menu), header: rect(menu.querySelector('header')), footer: rect(menu.querySelector('footer')), inset: body ? menu.getBoundingClientRect().right - body.getBoundingClientRect().right : 0, viewport: [innerWidth, innerHeight], shellScroll: getComputedStyle(menu).overflowY, noXOverflow: menu.scrollWidth <= menu.clientWidth + 1 && (!body || body.scrollWidth <= body.clientWidth + 1) };
  });
  const before = await geometry();
  await writeFile(join(out, `${name}-geometry.json`), JSON.stringify(before, null, 2));
  assert.ok(!['auto', 'scroll'].includes(before.shellScroll), 'menu shell must not own the scroll rail');
  assert.ok(before.inset >= 8, 'settings rail must be inset at least 8px');
  assert.ok(before.noXOverflow, 'settings must not overflow horizontally');
  assert.ok(before.outer.height <= 721, 'settings keep a bounded footprint around the character');
  assert.ok(before.outer.x >= 0 && before.outer.y >= 0 && before.outer.x + before.outer.width <= before.viewport[0] + 1 && before.outer.y + before.outer.height <= before.viewport[1] + 1, 'menu stays inside the viewport');
  const palette = await page.locator('#menu').evaluate(menu => {
    const style = s => getComputedStyle(menu.querySelector(s));
    return { accent: style('.menu-primary button').color, state: style('#menu-state').color, switch: style('#toggle-notices i').backgroundColor, memory: style('[data-memory-action="memory-correct"]').color, danger: style('[data-memory-action="memory-delete"]').color, clear: style('#memory-clear').color, disabledPlay: style('#companion-play').backgroundColor, listScroll: style('#memory-list').overflowY };
  });
  assert.equal(palette.state, palette.accent);
  assert.equal(palette.switch, palette.accent);
  assert.equal(palette.memory, palette.accent);
  assert.notEqual(palette.disabledPlay, palette.accent, 'disabled play must not look like an enabled primary action');
  assert.equal(palette.danger, palette.clear);
  assert.notEqual(palette.danger, palette.memory, 'destructive actions have a separate semantic role');
  assert.equal(palette.listScroll, 'visible', 'memory list must not create a nested scroll trap');
  const body = page.locator('.menu-content');
  await body.focus(); await page.keyboard.press('End');
  await page.waitForFunction(() => { const e = document.querySelector('.menu-content'); return e.scrollTop > 0; });
  assert.deepEqual(await geometry(), before, 'scrolling keeps shell, heading and footer fixed');
  await page.locator('#memory-clear').focus();
  await page.waitForFunction(() => {const e=document.querySelector('#memory-clear'),r=e.getBoundingClientRect(),b=e.closest('.menu-content').getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;});
  const inView = await page.locator('#memory-clear').evaluate(e => { const r=e.getBoundingClientRect(), b=e.closest('.menu-content').getBoundingClientRect(); return r.top>=b.top-1 && r.bottom<=b.bottom+1; });
  assert.ok(inView, `keyboard focus scrolls the action into the content well: ${JSON.stringify(await page.locator('#memory-clear').evaluate(e=>({action:e.getBoundingClientRect().toJSON(),body:e.closest('.menu-content').getBoundingClientRect().toJSON(),scroll:e.closest('.menu-content').scrollTop})))}`);
  await page.screenshot({ path: join(out, `${name}-expanded.png`) });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').isVisible(), false);
  return { locale, textScale, ...before, palette, fixedHeaderFooter: true, keyboardReachable: true };
}
