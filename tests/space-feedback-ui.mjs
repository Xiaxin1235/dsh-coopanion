// Reproduce the two screenshot reports via public controls in an isolated page.
import assert from 'node:assert/strict';
import {chromium,_electron} from 'playwright-core';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';import {createRequire} from 'node:module';
import {checkPath} from '../web/upstream/kit/navigation.js';
import {spaceSourceIdentity} from './space-source-identity.mjs';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-3-feedback');await mkdir(output,{recursive:true});
const sourceIdentity=await spaceSourceIdentity(),native=process.argv.includes('--native'),profile=native?await mkdtemp(join(tmpdir(),'space-feedback-')):null;
const browser=native?await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',resolve('desktop/space-preview.cjs')],env:{...process.env,DSH_SPACE_STAGE:'3',DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_NO_SANDBOX:'1'}}):await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=native?browser.context():await browser.newContext({viewport:{width:1440,height:1180},recordVideo:{dir:output,size:{width:1440,height:1180}}});
const page=native?await browser.firstWindow():await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.spacePreview.snapshot());
const wait=fn=>page.waitForFunction(fn,null,{timeout:30000});
const edit=async(id,x,y)=>{await page.selectOption('#object-select',id);await page.fill('#edit-x',String(x));await page.fill('#edit-y',String(y));await page.click('#apply-placement');};
const check=(value,label)=>{checks.push({passed:!!value,label});};
const arrived=()=>wait(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived'&&e.id===s.navigation.id)&&!s.navigation.active;});
let first,second,video;
try{
 if(!native)await page.goto('http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=3&layout=stage-3-feedback-20261020');await wait(()=>document.documentElement.dataset.ready==='true');
 await edit('actor',112,640);await wait(()=>!document.querySelector('#apply-placement').disabled);await edit('shell',335,450);await wait(()=>Math.abs(window.spacePreview.snapshot().frame.groundQuad[2].y-450)<1);
 await edit('gate-north',621,18);await edit('planter',580,528);await page.click('#nav-work');first=await snapshot();
 check(first.route.passed,'580/528 flowerbox permits a route to work');
 if(first.route.passed){await arrived();first=await snapshot();check(first.frame.bodyX===850&&first.frame.bodyY===600,'real body arrives at work through the reported lower flowerbox layout');}
 await page.screenshot({path:resolve(output,'lower-flowerbox.png'),fullPage:true});
 await edit('planter',558,252);await page.click('#nav-work');await arrived();check((await snapshot()).frame.bodyX===850,'moved flowerbox permits work arrival');
 await page.evaluate(()=>{window.feedbackTrace=[];window.feedbackTimer=setInterval(()=>{const s=window.spacePreview.snapshot();window.feedbackTrace.push({x:s.frame.bodyX,y:s.frame.bodyY,phase:s.frame.phase,owner:s.frame.owner});},40);});
 await page.click('#pickup');await wait(()=>['held','paused'].includes(window.spacePreview.snapshot().frame.phase));second=await snapshot();
 check(second.frame.phase==='held'&&second.frame.owner==='hand'&&second.frame.commits.pickup===1,'real pickup after work reaches the shell and commits exactly once');
 await page.screenshot({path:resolve(output,'pickup-after-work.png'),fullPage:true});
 if(second.frame.phase==='held'){
   await edit('destination',390,600);await wait(()=>window.spacePreview.snapshot().frame.phase==='paused');await page.click('#resume');await wait(()=>window.spacePreview.snapshot().frame.phase==='held');await page.click('#drop');await wait(()=>window.spacePreview.snapshot().frame.phase==='idle');
   const end=await snapshot();check(end.frame.commits.pickup===1&&end.frame.commits.drop===1,'held navigation and drop finish once after changing the target');
   await page.screenshot({path:resolve(output,'complete.png'),fullPage:true});
 }
 const trace=await page.evaluate(()=>{clearInterval(window.feedbackTimer);return window.feedbackTrace;});
 check(trace.slice(1).every((p,i)=>checkPath(second.navigationModel,[trace[i],p]).passed),'all observed actual body segments respect the ground/full-body collision model');
 check(second.measuredRaster.ownerSwitchJump<1.5&&second.measuredRaster.binding<.01,'contact transfer retains texture and anchor continuity');check(errors.length===0,'no browser errors');
 const report={passed:checks.every(c=>c.passed),sourceIdentity,native,checks,errors,first,second,trace,screenshotReconstruction:{actor:{x:112,y:640},planterLower:{x:580,y:528},planterMoved:{x:558,y:252},northY:18,shellY:450,notes:'flowerbox and actor coordinates read from screenshot UI; north inferred from 564px gap; shell plane approximated from pixels, also covered over a range in unit checks'},versions:native?await browser.evaluate(()=>process.versions):browser.version()};
 await writeFile(resolve(output,'feedback.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.map(c=>({label:c.label,passed:c.passed})),error:second.frame.error,events:second.events.slice(-3),output}));video=page.video();assert.ok(report.passed,'screenshot feedback regression');
}finally{if(!native){await context.close();if(video)await video.saveAs(resolve(output,'feedback.webm'));}await browser.close();if(profile)await rm(profile,{recursive:true,force:true});}
