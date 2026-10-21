// Controlled native surface checks, using a disposable profile and no physical pointer input.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
const require=createRequire(import.meta.url),directory=await mkdtemp(join(tmpdir(),'dsh-message-native-'));
let app;
const out=process.env.MESSAGE_EVIDENCE_DIR??await mkdtemp(join(tmpdir(),'dsh-message-native-shots-')),checks=[];
await mkdir(out,{recursive:true});
try {
  app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',resolve('desktop/main.cjs')],env:{...process.env,DSH_PET_TEST_DATA_DIR:directory,DSH_PET_TEST_NO_SANDBOX:'1',DSH_PET_TEST_DEBUG_PORT:'0'}});
  const page=await app.firstWindow();await page.waitForSelector('#pet[data-mode]');
  const send=value=>app.evaluate((_,message)=>process.emit('message',message),value);
  const session={id:'native-message',label:'一起工作的会话 · Our conversation',mood:'idle',active:false};
  const snapshot={sessionId:session.id,mood:'idle',active:false,sessions:[session],results:[]};
  await send({type:'init',baseline:true,options:{size:180,roam:false,locale:'zh',textScale:1,bubbleDurationMs:120000,notifications:true},snapshot});
  for(const locale of ['zh','en']) for(const textScale of [1,1.25,1.5]) {
    await send({type:'configure',options:{locale,textScale}});
    await page.emulateMedia({reducedMotion:'reduce'});
    const result={id:`message-${locale}-${textScale}`,sessionId:session.id,text:'## 捎回来的一封回复 · A reply for you\n\n'+'这是一封保留完整内容的回复。 Scroll the page, keep the paper still.\n\n'.repeat(50),time:Date.now(),read:false};
    await send({type:'snapshot',snapshot:{...snapshot,results:[result]}});await page.locator('#bubble').waitFor();
    assert.equal(await page.locator('#bubble').evaluate(n=>getComputedStyle(n).overflowY),'visible');
    await page.locator('#bubble-expand').click();await page.locator('#reader').waitFor();
    const reader=page.locator('#reader-text'),before=await page.locator('#reader header').boundingBox(),footer=await page.locator('.reader-footer').boundingBox();
    await reader.focus();await page.keyboard.press('PageDown');await page.waitForFunction(()=>document.querySelector('#reader-text').scrollTop>0);
    assert.deepEqual(await page.locator('#reader header').boundingBox(),before);assert.deepEqual(await page.locator('.reader-footer').boundingBox(),footer);
    assert.equal(await page.locator('#reader').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth+1;}),true);
    assert.ok(await reader.evaluate(n=>n.parentElement.getBoundingClientRect().right-n.getBoundingClientRect().right>=8));
    await page.screenshot({path:join(out,`native-reader-${locale}-${textScale}.png`)});checks.push({locale,textScale,keyboardScroll:true,fixedHeaderFooter:true});
    await page.keyboard.press('Escape');
  }
  await writeFile(join(out,'checks.json'),JSON.stringify({passed:true,platform:process.platform,arch:process.arch,checks},null,2)+'\n');
  console.log(JSON.stringify({passed:true,cases:checks.length,out}));
} finally {await app?.close();await rm(directory,{recursive:true,force:true});}
