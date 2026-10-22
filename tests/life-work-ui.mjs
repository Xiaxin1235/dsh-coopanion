// Public Stage 4 controls, simulated public facts, real body/navigation/contact.
import assert from 'node:assert/strict';
import {chromium,_electron} from '../scripts/lib/playwright.mjs';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spaceSourceIdentity} from './space-source-identity.mjs';
execFileSync(process.execPath,['docs/design/art-workflow/space-v1/prepare-stage4.mjs']);
const native=process.argv.includes('--native'),output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-4-life-work');
await mkdir(output,{recursive:true});
const sourceIdentity=await spaceSourceIdentity({stage4:true}),profile=native?await mkdtemp(join(tmpdir(),'coopanion-stage4-')):null;
const browser=native?await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',resolve('desktop/space-preview.cjs')],env:{...process.env,DSH_SPACE_STAGE:'4',DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_NO_SANDBOX:'1'}}):await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=native?browser.context():await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:output,size:{width:1440,height:1080}}});
let page=native?await browser.firstWindow():await context.newPage();const checks=[],errors=[],milestones=[];
const bind=()=>page.on('pageerror',e=>errors.push(e.stack));bind();
const snapshot=()=>page.evaluate(()=>window.spacePreview.snapshot());
const frame=()=>page.evaluate(()=>JSON.parse(document.querySelector('#world').dataset.frame));
const wait=(fn,arg=null,timeout=45000)=>page.waitForFunction(fn,arg,{timeout});
const phase=name=>wait(name=>JSON.parse(document.querySelector('#world').dataset.frame).phase===name,name);
const coord=name=>wait(name=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.phase===name,name);
const click=id=>page.locator('#'+id).evaluate(el=>{assertEnabled(el);el.click();function assertEnabled(e){if(e.disabled)throw Error(e.id+' disabled');}});
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const mark=async label=>{milestones.push({label,at:Date.now(),frame:await frame()});await page.screenshot({path:join(output,label+'.png'),fullPage:true});};
const ready=()=>wait(()=>document.documentElement.dataset.ready==='true');
const open=async()=>{await page.goto((process.env.SPACE_PREVIEW_URL??'http://127.0.0.1:4189')+'/docs/design/art-workflow/space-v1/index.html?stage=4');await ready();};
const edit=async(id,x,y)=>{await page.locator('.space-inspector').evaluate(el=>el.open=true);await page.selectOption('#object-select',id);await page.fill('#edit-x',String(x));await page.fill('#edit-y',String(y));await page.click('#apply-placement');};
const settled=async()=>{await coord('work-wait');const f=await frame();check(f.bodyX===850&&f.bodyY===600&&!f.moving&&f.owner==='ground','physical at-work requires actual root, stopped body and parked object');};
try{
 if(!native)await open();else await ready();
 if(native&&(await frame()).coordination.phase==='paused'){check((await frame()).coordination.life===null,'native initial hidden/lifecycle guard stays conservative with no invented life intent');await click('resume');await coord('idle');}
 check((await frame()).coordination.phase==='idle','Stage 4 starts idle in an isolated page');
 await click('nav-work');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).navigation?.speed>5);const manual=(await snapshot()).navigation.id;await click('work-start');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.focus==='A');check((await snapshot()).events.some(e=>e.kind==='navigation-interrupted'&&e.id===manual),'work cancels an active manual route through the sole navigator');await click('work-complete');await coord('idle');
 await click('story-start');await phase('lift');const pre=await frame(),at=Date.now();await click('work-start');
 await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.focus==='A');
 let f=await frame();check(Date.now()-at<1000&&f.coordination.phase==='handoff'&&f.owner==='hand','logical work attention appears immediately before physical arrival and does not detach the owned prop');
 check(JSON.stringify(f.coordination.life.target)===JSON.stringify(pre.coordination.life.target),'life target is preserved separately from temporary parking');await mark('01-attention-before-arrival');
 const revision=f.coordination.sessions[0].revision;await click('work-accepted');await click('work-repeat');await page.waitForTimeout(150);f=await frame();check(f.coordination.sessions[0].revision===revision,'send acceptance and repeated event cannot produce completion or replay work');
 await coord('work-travel');f=await frame();check(f.commits.pickup===1&&f.commits.drop===1&&f.owner==='ground','handoff parks the owned shell exactly once through real contact');
 await page.selectOption('#work-session','B');await click('work-question');await click('work-continued');await page.selectOption('#work-session','A');await click('work-progress');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.sessions.find(s=>s.sessionId==='A')?.category==='goal-progress');check((await frame()).coordination.focus==='B','idle active goal releases body attention while continued question remains');
 await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.focus==='B');
 await page.selectOption('#work-session','A');await click('work-complete');
 await settled();f=await frame();check(f.coordination.sessions.find(s=>s.sessionId==='A').category==='completed'&&f.coordination.focus==='B','one session completion cannot release another pending question');await mark('02-at-work-question');
 await page.selectOption('#work-session','B');await click('work-reply');await click('work-approval');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.sessions.find(s=>s.sessionId==='B')?.requests.length===2);check((await frame()).coordination.phase==='work-wait','ordinary reply and approval retain the independent continued question');await click('work-approved');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).coordination.sessions.find(s=>s.sessionId==='B')?.requests.length===1);await click('work-error');await click('work-ack');await page.waitForTimeout(250);f=await frame();check(f.coordination.phase==='work-wait'&&f.coordination.sessions.find(s=>s.sessionId==='B').requests.length===1,'exception acknowledgement does not settle a continued question');
 await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).sit<.1);check((await frame()).performance.kind==='continued','continued question invites a response in an awake standing posture');await click('work-answered');await coord('life');await phase('carry');
 const before=await frame();await edit('destination',450,600);await coord('paused');f=await frame();check(f.owner==='hand'&&f.commits.pickup===before.commits.pickup&&f.coordination.life.target.x===450,'editing the life target pauses with real ownership and updates the retained intent');
 await click('resume');await phase('carry');
 if(native){await browser.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));}else await page.evaluate(()=>window.dispatchEvent(new Event('space-suspend')));
 await coord('paused');const suspended=await frame();await page.waitForTimeout(1250);f=await frame();check(f.bodyX===suspended.bodyX&&f.bodyY===suspended.bodyY&&f.owner===suspended.owner,'controlled lifecycle suspension freezes root and owned object');await click('resume');
 await coord('ended');f=await frame();check(f.commits.pickup===2&&f.commits.drop===2&&Math.abs(f.groundGrip.x-450)<1.5&&Math.abs(f.groundQuad[2].y-600)<1.5,'work release rechecks the changed goal and completes the resumed real contact story once');await mark('03-life-resumed');
 const s=await snapshot(),commits=s.events.filter(e=>e.type==='pickup'||e.type==='drop');
 check(commits.length===4&&commits.every(e=>e.type==='pickup'?e.contact.distance<=1.5:e.contact.groundDistance<=1.5),'all story ownership commits have real stable rig contact');
 check(s.measuredRaster.binding<.01&&s.measuredRaster.ownerMismatches===0&&s.measuredRaster.wrongLayers===0&&s.measuredRaster.ownerSwitchJump<1.5,'handoff and return retain same-frame layers and subpixel ownership continuity');
 // Real pointer drag while a second work journey owns the body.
 await page.selectOption('#work-session','A');await click('work-start');await coord('work-travel');
 await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).navigation?.speed>5);
 const old=(await frame()).coordination.navigation;await page.locator('#actor-hit').scrollIntoViewIfNeeded();const box=await page.locator('#actor-hit').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2-5,{steps:6});await page.mouse.up();await coord('paused');
 f=await frame();check(f.owner==='ground'&&f.coordination.sessions.some(s=>s.running),'actual pointer drag interrupts the sole body without releasing work demand');
 await click('resume');await coord('work-travel');f=await frame();check(f.coordination.navigation.id>old.id,'drag recovery uses a fresh navigation identity');
 await edit('planter',490,220);await coord('paused');await click('resume');await settled();await click('work-complete');await coord('ended');await mark('04-drag-and-geometry-recovered');
 if(!native){
  const storyVideo=page.video();await page.close();await storyVideo.saveAs(join(output,'story.webm'));page=await context.newPage();bind();
  // Isolated fresh pages inject work on both sides of pickup/drop commits.
  for(const target of ['grasp','lift','release','retract']){
   await page.close();page=await context.newPage();bind();await open();await click('story-start');await phase(target);
   const before=await page.evaluate(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);document.querySelector('#work-start').click();return f;});
   check(before.phase===target,'work injection observes actual '+target+' boundary');
   await settled();const parked=await frame();check(parked.commits.pickup===before.commits.pickup&&parked.commits.drop===before.commits.drop+(before.owner==='hand'?1:0),'handoff at '+target+' preserves actual ownership without repeating pickup/drop');
   await click('work-complete');await coord('ended');const end=await frame();check(Math.abs(end.groundGrip.x-390)<1.5&&Math.abs(end.groundQuad[2].y-600)<1.5,'return after '+target+' rechecks and reaches the original target');await mark('boundary-'+target);
  }
  await page.close();page=await context.newPage();bind();await open();await click('story-start');await phase('reach');await click('work-start');await click('story-cancel');await settled();check((await frame()).coordination.life===null,'explicit life cancellation keeps work and removes only retained life intent');await click('work-complete');await coord('idle');check((await frame()).commits.pickup===0,'cancelled uncommitted pickup cannot return or fabricate a commit');
 }
 check(errors.length===0,'no page errors');
 await writeFile(join(output,'life-work.json'),JSON.stringify({passed:true,sourceIdentity,native,simulatedHarness:true,realHarness:false,physicalMultiDisplay:false,browser:native?await browser.evaluate(()=>process.versions):browser.version(),checks,errors,milestones,snapshot:await snapshot()},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,native,output}));
}catch(error){await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(join(output,'failure.json'),JSON.stringify({sourceIdentity,checks,errors,error:error.stack,snapshot:await snapshot().catch(()=>null)},null,2));throw error;}
finally{if(!native)await context.close();await browser.close();if(profile){await rm(profile,{recursive:true,force:true});await writeFile(join(output,'cleanup.json'),JSON.stringify({profile,removed:true})+'\n');}}
