import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '../scripts/lib/playwright.mjs';
import { previewServer } from '../scripts/preview.mjs';
import { checkMenuSurface, menuSnapshot } from './helpers/menu-surfaces.mjs';
const require=createRequire(import.meta.url), { CompanionStore }=require('../dist/companion-store.cjs');
const directory=await mkdtemp(join(tmpdir(),'dsh-menu-ui-'));
const store=new CompanionStore(join(directory,'companionship-v1'));
for(let i=0;i<16;i++) {const current=await store.request({type:'read',characterId:'whale'});await store.request({type:i%2?'play':'pet',characterId:'whale',requestId:`menu-${i}`,revision:current.revision,memoryGeneration:current.memory.generation});}
await store.close();
const server=previewServer({dataDir:directory});server.listen(0,'127.0.0.1');await once(server,'listening');
const out=process.env.MENU_EVIDENCE_DIR??await mkdtemp(join(tmpdir(),'dsh-menu-shots-')),checks=[];
await mkdir(out,{recursive:true});let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  for(const viewport of [{width:320,height:640},{width:960,height:900}]) for(const locale of ['zh','en']) for(const textScale of [1,1.25,1.5]) {
    const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.dshPetBridge={subscribe(fn){window.receiveMenu=fn;},action(){},hit(){}};});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('#pet[data-mode]');
    const send=value=>page.evaluate(value=>window.receiveMenu(value),value);
    await send({type:'init',baseline:true,options:{locale,textScale,size:180,roam:false,companionship:'off'},snapshot:menuSnapshot});
    checks.push(await checkMenuSurface(page,{send,locale,textScale,out,name:`menu-${viewport.width}-${locale}-${textScale}`}));
    // A text-only configure must retain the focused memory action and its DOM.
    await page.locator('#pet').dispatchEvent('contextmenu',{button:2});
    await page.locator('#memory-list button').first().focus();
    const handle=await page.locator('#memory-list button').first().elementHandle();
    await send({type:'configure',options:{textScale:textScale===1.5?1:1.5}});
    assert.equal(await handle.evaluate(e=>e.isConnected&&e===document.activeElement),true);
    assert.deepEqual(errors,[]);await page.close();
  }
  // Presentation states use a disposable store; no user's memories are changed.
  const page=await browser.newPage({viewport:{width:320,height:640},reducedMotion:'reduce'});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('#pet[data-mode]');
  await page.locator('#pet').dispatchEvent('contextmenu',{button:2});
  await page.locator('#companion-memories summary').click();await page.waitForSelector('#memory-list li');
  await page.locator('#memory-clear').click();await page.waitForFunction(()=>document.querySelector('#memory-list').children.length===0);
  assert.ok((await page.locator('#memory-status').innerText()).length>0);assert.equal(await page.locator('#memory-clear').isDisabled(),true);
  await page.screenshot({path:join(out,'menu-empty.png')});
  await page.route('**/api/companionship',async route=>{const response=await route.fetch(),data=await response.json();data.value.writable=false;await route.fulfill({response,json:data});});
  await page.locator('#companion-memories summary').click();await page.locator('#companion-memories summary').click();
  await page.waitForFunction(()=>/暂时|cannot/.test(document.querySelector('#memory-status').textContent));
  assert.equal(await page.locator('#memory-clear').isDisabled(),true);
  await page.screenshot({path:join(out,'menu-readonly.png')});await page.close();
  await writeFile(join(out,'checks.json'),JSON.stringify({passed:true,browser:browser.version(),checks,emptyState:true,readonlyState:true},null,2)+'\n');
  console.log(JSON.stringify({passed:true,cases:checks.length,out}));
} finally {await browser?.close();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
