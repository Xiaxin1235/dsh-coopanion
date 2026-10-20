// One real-time page-only story. Inputs change intent; the body plans and commits.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spaceSourceIdentity} from './space-source-identity.mjs';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-3-showcase');await mkdir(output,{recursive:true});
const sourceIdentity=await spaceSourceIdentity(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1180},recordVideo:{dir:output,size:{width:1440,height:1180}}}),page=await context.newPage();
const started=performance.now();let video;
const phase=name=>page.waitForFunction(name=>window.spacePreview.snapshot().frame.phase===name,name,{timeout:30000});
try{
 await page.goto('http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.click('#sit');await page.waitForFunction(()=>window.spacePreview.snapshot().frame.sit>.95);await page.waitForTimeout(1500);
 await page.click('#pickup');await phase('held');await page.click('#pause');await phase('paused');await page.screenshot({path:resolve(output,'held.png'),fullPage:true});await page.waitForTimeout(1500);await page.click('#resume');await phase('held');
 await page.selectOption('#object-select','destination');await page.fill('#edit-x','800');await page.fill('#edit-y','600');await page.click('#apply-placement');await phase('paused');await page.click('#resume');await phase('held');
 await page.click('#drop');await phase('carry');await page.waitForTimeout(1000);await page.click('#pause');await phase('paused');await page.waitForTimeout(1500);await page.click('#resume');await phase('idle');
 const snapshot=await page.evaluate(()=>window.spacePreview.snapshot());assert.deepEqual(snapshot.frame.commits,{pickup:1,drop:1});assert.ok(Math.abs(snapshot.frame.groundGrip.x-800)<1.5&&Math.abs(snapshot.frame.groundQuad[2].y-600)<1.5);
 await page.screenshot({path:resolve(output,'complete.png'),fullPage:true});
 while(performance.now()-started<36000)await page.waitForTimeout(250);
 await writeFile(resolve(output,'showcase.json'),JSON.stringify({passed:true,sourceIdentity,browser:browser.version(),seconds:(performance.now()-started)/1000,actions:['awake sitting','rise and approach','stable pickup','pause while holding','change actual two-dimensional destination','carry and pause mid-route','real drop and exit'],snapshot},null,2)+'\n');video=page.video();
}finally{await context.close();if(video)await video.saveAs(resolve(output,'continuous-actions.webm'));await browser.close();}
