// Scroll the actual reply/reader wells; header, actions and paper edge must stay put.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '../scripts/lib/playwright.mjs';
import { previewServer } from '../scripts/preview.mjs';
const directory = await mkdtemp(join(tmpdir(), 'dsh-message-surfaces-'));
const server = previewServer({dataDir:directory}); server.listen(0,'127.0.0.1'); await once(server,'listening');
let browser;
const out = process.env.MESSAGE_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(),'dsh-message-shots-')), checks=[];
await mkdir(out,{recursive:true});
try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  for(const locale of ['zh','en']) for(const scale of [1,1.25,1.5]) {
    const page = await browser.newPage({locale:locale==='zh'?'zh-CN':'en-US',viewport:{width:320,height:640},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.dshPetBridge={subscribe(fn){window.receiveMessageDesign=fn;},action(){},hit(){}};});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('#pet[data-mode]');
    const text='## 一封长回复 · A long reply\n\n'+'正文保留在自己的阅读区域。 Keep the paper and controls still.\n\n'.repeat(50);
    const session={id:'design',label:'一段很长的来源会话 · A long conversation name',mood:'idle',active:false};
    const snapshot={sessionId:session.id,mood:'idle',active:false,sessions:[session],results:[{id:'design-result',sessionId:session.id,text,time:1,read:false}]};
    await page.evaluate(value=>window.receiveMessageDesign(value),{type:'init',options:{locale,textScale:scale,size:180,roam:false,bubbleDurationMs:120000},snapshot:{...snapshot,results:[]}});
    await page.evaluate(value=>window.receiveMessageDesign(value),{type:'snapshot',snapshot});await page.locator('#bubble').waitFor();
    const geometry = selector => page.locator(selector).evaluate(node=>{
      const outer=node.getBoundingClientRect(),body=node.querySelector('.b-text, .reader-text').getBoundingClientRect();
      const header=node.querySelector('header').getBoundingClientRect(),footer=node.querySelector('footer').getBoundingClientRect();
      return {outer:{x:outer.x,y:outer.y,width:outer.width,height:outer.height},header:{x:header.x,y:header.y,width:header.width,height:header.height},footer:{x:footer.x,y:footer.y,width:footer.width,height:footer.height},inset:outer.right-body.right,viewport:[innerWidth,innerHeight],noHorizontalOverflow:node.scrollWidth<=node.clientWidth+1};
    });
    const checkGeometry=state=>{assert.ok(state.outer.x>=0&&state.outer.y>=0&&state.outer.x+state.outer.width<=state.viewport[0]&&state.outer.y+state.outer.height<=state.viewport[1]);assert.ok(state.inset>=8,'scroll rail is inset from the paper outline');assert.ok(state.noHorizontalOverflow);};
    const bubble=await geometry('#bubble');checkGeometry(bubble);
    await page.screenshot({path:join(out,`bubble-${locale}-${scale}.png`)});
    await page.locator('#bubble-expand').click();await page.locator('#reader').waitFor();
    const before=await geometry('#reader');checkGeometry(before);
    const reader=page.locator('#reader-text'); await reader.focus();await page.keyboard.press('PageDown');
    await page.waitForFunction(()=>document.querySelector('#reader-text').scrollTop>0);
    const after=await geometry('#reader');assert.deepEqual(after,before,'scrolling does not move paper, header or actions');
    await page.screenshot({path:join(out,`reader-${locale}-${scale}.png`)});
    assert.deepEqual(errors,[]);checks.push({locale,scale,bubble,before,keyboardScroll:true});await page.close();
  }
  await writeFile(join(out,'checks.json'),JSON.stringify({passed:true,checks,browser:browser.version()},null,2)+'\n');
  console.log(JSON.stringify({passed:true,cases:checks.length,out}));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
