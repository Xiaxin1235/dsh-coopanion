// Public authoring controls, simulated permissions/facts, real body and navigation.
import assert from 'node:assert/strict';
import {chromium,_electron} from 'playwright-core';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spaceSourceIdentity} from './space-source-identity.mjs';
execFileSync(process.execPath,['docs/design/art-workflow/space-v1/prepare-stage4.mjs']);
const native=process.argv.includes('--native'),output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-5a-personality');
await mkdir(output,{recursive:false});
const sourceIdentity=await spaceSourceIdentity({stage4:true,stage5:true}),profile=native?await mkdtemp(join(tmpdir(),'coopanion-stage5a-')):null;
const browser=native?await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',resolve('desktop/space-preview.cjs')],env:{...process.env,DSH_SPACE_STAGE:'5a',DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_NO_SANDBOX:'1'}}):await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=native?browser.context():await browser.newContext({viewport:{width:1500,height:1120},recordVideo:{dir:output,size:{width:1500,height:1120}}});
const equalComparison=[];
let page=native?await browser.firstWindow():await context.newPage();
const checks=[],errors=[],milestones=[];
const bind=()=>page.on('pageerror',e=>errors.push(e.stack));bind();
const wait=(fn,arg=null,timeout=45000)=>page.waitForFunction(fn,arg,{timeout});
const ready=()=>wait(()=>document.documentElement.dataset.ready==='true');
const frame=()=>page.evaluate(()=>JSON.parse(document.querySelector('#world').dataset.frame));
const coord=phase=>wait(p=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.phase===p,phase);
const click=id=>page.locator('#'+id).evaluate(el=>{if(el.disabled)throw Error(el.id+' disabled');el.click();});
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const mark=async label=>{milestones.push({label,frame:await frame()});await page.screenshot({path:join(output,label+'.png'),fullPage:true});};
const open=async()=>{await page.goto('http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?stage=5a');await ready();};
const enable=async id=>{await page.selectOption('#personality-id',id);await page.selectOption('#personality-mode','quiet');await page.check('#personality-roam');await page.selectOption('#personality-input','idle');await click('personality-start');};
const stable=async ms=>{const before=await frame();await page.waitForTimeout(ms);const after=await frame();check(before.bodyX===after.bodyX&&before.bodyY===after.bodyY&&before.owner===after.owner,'blocked body and ownership remain still');return after;};
try{
 if(native)await ready();else await open();
 if((await frame()).coordination.phase==='paused'){await click('resume');await coord('idle');}
 await click('sit');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).sit>.95);
 await page.evaluate(()=>{window.poseSamples=[];const sample=()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);if(window.poseSamples.length<240){window.poseSamples.push({sit:f.sit,waist:f.posture.waist,phase:f.phase,x:f.bodyX,y:f.bodyY});requestAnimationFrame(sample);}};requestAnimationFrame(sample);});
 await click('personality-start');await coord('paused');check((await frame()).coordination.personality.ordinal===0,'off default consumes no choice');
 await page.selectOption('#personality-mode','quiet');await page.check('#personality-roam');await page.selectOption('#personality-input','idle');await coord('personal-dwell');
 const quiet=(await frame()).coordination.personality.decision;
 check(quiet.kind==='stay'&&quiet.personality==='quiet','seed 7 quiet chooses stationary object attention');check((await frame()).sit<.05,'ordinary observation stays standing');
 const poses=await page.evaluate(()=>window.poseSamples);check(Math.max(...poses.map(p=>Math.abs(p.waist)))<1,'seated exit never uses the prop-reaching bend');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).renderedFace==='thinking');await mark('01-quiet-observes-shell');
 await click('personality-stop');await coord('idle');
 // A fresh isolated page for exact same-map/seed/fact comparison; original user pages untouched.
 if(native){await page.reload();await ready();if((await frame()).coordination.phase==='paused'){await click('resume');await coord('idle');}}
 else {const video=page.video();await page.close();await video.saveAs(join(output,'quiet.webm'));page=await context.newPage();bind();await open();}
 await page.evaluate(()=>{window.renderedGestures=[];new MutationObserver(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);if(f.gesture?.kind && !window.renderedGestures.includes(f.gesture.kind))window.renderedGestures.push(f.gesture.kind);}).observe(document.querySelector('#world'),{attributes:true,attributeFilter:['data-frame']});});
 await enable('lively');await coord('personal-travel');const lively=(await frame()).coordination.personality.decision;
 check(lively.interestId==='planter'&&quiet.interestId==='o03-shell'&&lively.attention!==quiet.attention&&lively.kind==='explore'&&JSON.stringify(quiet.samples)===JSON.stringify(lively.samples)&&JSON.stringify(quiet.origin)===JSON.stringify(lively.origin),'same map/facts/seed yields a different real choice for lively');
 check(quiet.duration>lively.duration,'personality also changes bounded dwell duration');
 await coord('personal-dwell');let f=await frame();check(Math.hypot(f.bodyX-lively.target.x,f.bodyY-lively.target.y)<.5&&!f.moving&&f.navigation.id===null,'exploration only completes on actual stopped arrival');check(f.sit<.05,'arrival does not automatically sit');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.decision.result==='observed');check((await frame()).renderedFace==='happy','lively observation uses supported expression after actual attention');check((await page.evaluate(()=>window.renderedGestures)).includes('nod'),'existing nod gesture reaches the actual rendered rig');await mark('02-lively-observes-plant');
 // Switch from seated dwell, then while actually moving. Both re-evaluate the live root.
 await page.selectOption('#personality-id','quiet');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.ordinal>=2);await coord('personal-dwell');
 await page.selectOption('#personality-id','lively');await coord('personal-travel');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).navigation.speed>5);
 const pre=await frame();await page.selectOption('#personality-id','quiet');await wait(n=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.ordinal>n,pre.coordination.personality.ordinal);f=await frame();
 check(f.commits.pickup===0&&f.commits.drop===0&&f.coordination.personality.decision.origin.x!==240,'switch uses actual root without resetting body or touching object');await mark('03-live-switch');
 // Occupancy and input unknown freeze movement and do not accumulate decisions.
 await page.selectOption('#personality-input','unknown');await coord('paused');const count=(await frame()).coordination.personality.ordinal;await stable(1200);check((await frame()).coordination.personality.ordinal===count,'unknown input never advances selection history');
 await page.selectOption('#personality-input','idle');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.phase.startsWith('personal-'));
 await page.check('#personality-occupied');await coord('paused');await stable(350);await page.uncheck('#personality-occupied');
 await page.locator('#work-facts-panel').evaluate(el=>el.open=true);await page.check('#work-reduced');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.decision.reason==='reduced-motion');await coord('personal-dwell');await mark('04-reduced-stationary');await page.uncheck('#work-reduced');
 // Edit parameters then unknown-version fallback; user overrides survive.
 await page.locator('#personality-panel details').evaluate(el=>el.open=true);await page.fill('#personality-dwell','20');await page.fill('#personality-explore','0.3');await click('personality-apply');
 await click('personality-fallback');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.fallback);
 f=await frame();check(f.coordination.personality.id==='quiet'&&f.coordination.personality.overrides.quiet.dwellMin===20,'unknown-version fallback retains explicit quiet overrides');await click('personality-reset');
 // Real work preemption preserves priorities even when optional mode becomes off.
 await click('work-approval');await coord('work-travel');await page.selectOption('#personality-mode','off');await coord('work-wait');
 f=await frame();check(f.bodyX===850&&f.bodyY===600&&f.coordination.focus==='A'&&f.performance.kind==='approval','approval keeps semantic face and physically reaches work despite optional off');
 await page.check('#personality-occupied');await coord('paused');await stable(350);await page.uncheck('#personality-occupied');await coord('work-wait');check((await frame()).coordination.focus==='A','reading freezes work body without losing approval');
 await click('work-accepted');await page.waitForTimeout(100);check((await frame()).coordination.sessions[0].requests.length===1,'acceptance cannot settle approval');await mark('05-work-priority');await click('work-approved');await click('work-reply');await coord('paused');check((await frame()).coordination.reason==='personality:mode-off','work release rechecks permission before life restarts');
 // Geometry changed while paused: fresh route after explicit resume, with live candidate filtering.
 await page.selectOption('#personality-mode','quiet');await page.selectOption('#personality-id','lively');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.phase.startsWith('personal-'));
 await page.locator('.space-inspector').evaluate(el=>el.open=true);await page.selectOption('#object-select','planter');await page.fill('#edit-x','490');await page.fill('#edit-y','430');await click('apply-placement');await coord('paused');check((await frame()).coordination.reason==='world-changed','live obstacle edit pauses the coordinator');
 await click('resume');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.personality.decision.revision===window.spacePreview.snapshot().layout.revision);
 check((await frame()).coordination.personality.decision.revision>1,'resumed selection uses changed geometry');
 if(native)await browser.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));else await page.evaluate(()=>window.dispatchEvent(new Event('space-suspend')));
 await coord('paused');await stable(1200);await page.selectOption('#personality-id','quiet');check((await frame()).coordination.phase==='paused','profile change cannot override lifecycle pause');await click('resume');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.phase.startsWith('personal-'));await page.locator('#work-facts-panel').evaluate(el=>el.open=false);await mark('06-geometry-lifecycle');
 await click('personality-stop');await coord('idle');f=await frame();check(f.owner==='ground'&&f.commits.pickup===0&&f.commits.drop===0,'stop preserves real object and contact counts');
 // Equalize time and movement probability: differences must still be visible.
 for(const id of ['quiet','lively']){
   if(native){await page.reload();await ready();if((await frame()).coordination.phase==='paused'){await click('resume');await coord('idle');}}
   else {const video=page.video();await page.close();if(id==='quiet')await video.saveAs(join(output,'story.webm'));page=await context.newPage();bind();await open();}
   await page.selectOption('#personality-id',id);await page.locator('#personality-panel details').evaluate(el=>el.open=true);
   await page.fill('#personality-dwell','12');await page.fill('#personality-explore','0.95');await click('personality-apply');
   await enable(id);await coord('personal-dwell');await wait(face=>JSON.parse(document.querySelector('#world').dataset.frame).renderedFace===face,id==='quiet'?'thinking':'surprised');
   equalComparison.push(await frame());await mark('equal-'+id);
 }
 check(equalComparison[0].coordination.personality.decision.duration===equalComparison[1].coordination.personality.decision.duration,'equal timing stays exactly equal in both real runs');
 check(equalComparison[0].coordination.personality.decision.interestId!==equalComparison[1].coordination.personality.decision.interestId&&equalComparison[0].renderedFace!==equalComparison[1].renderedFace,'equal timing still changes actual object choice, stance and rendered expression');
 check(errors.length===0,'no page errors');
 await writeFile(join(output,'personality.json'),JSON.stringify({passed:true,sourceIdentity,native,simulatedPermissions:true,simulatedHarness:true,modelCalls:0,realHarness:false,physicalDeviceAcceptance:false,userAcceptance:false,runtime:native?await browser.evaluate(()=>process.versions):browser.version(),checks,errors,quiet,lively,equalComparison,milestones,snapshot:await page.evaluate(()=>window.spacePreview.snapshot())},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length,native,output}));
}catch(e){await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(join(output,'failure.json'),JSON.stringify({sourceIdentity,checks,errors,equalComparison,error:e.stack,frame:await frame().catch(()=>null)},null,2));throw e;}
finally{if(!native)await context.close();await browser.close();if(profile){await rm(profile,{recursive:true,force:true});await writeFile(join(output,'cleanup.json'),JSON.stringify({profile,removed:true})+'\n');}}
