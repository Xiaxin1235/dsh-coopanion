// Stage 3: drive the public editor/transport, observe real navigation and rig.
import {spaceSourceIdentity} from './space-source-identity.mjs';
import assert from 'node:assert/strict';
import {chromium, _electron} from 'playwright-core';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const sourceIdentity=await spaceSourceIdentity();
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-3-actions');await mkdir(output,{recursive:true});
const native=process.argv.includes('--native'),profile=native?await mkdtemp(join(tmpdir(),'coopanion-stage3-')):null;
const browser=native?await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',resolve('desktop/space-preview.cjs')],env:{...process.env,DSH_SPACE_STAGE:'3',DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_NO_SANDBOX:'1'}}):await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=native?browser.context():await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:output,size:{width:1440,height:1080}}});
const page=native?await browser.firstWindow():await context.newPage(),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.spacePreview.snapshot());
const frame=async()=>(await snapshot()).frame;
const wait=fn=>page.waitForFunction(fn,null,{timeout:45000});
const phase=async name=>{await page.waitForFunction(name=>window.spacePreview.snapshot().frame.phase===name,name,{timeout:45000});return frame();};
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const edit=async(id,x,y)=>{await page.selectOption('#object-select',id);await page.fill('#edit-x',String(x));await page.fill('#edit-y',String(y));await page.click('#apply-placement');};
async function pause(label) {
 await page.click('#pause');const a=await phase('paused');await page.waitForTimeout(1200);const b=await frame();
 check(a.elapsed===b.elapsed&&a.bodyX===b.bodyX&&a.bodyY===b.bodyY&&JSON.stringify(a.heldQuad)===JSON.stringify(b.heldQuad),label+' freezes root, clock and hand/prop pose');
 await page.screenshot({path:resolve(output,label+'.png'),fullPage:true});await page.click('#resume');return a;
}
try{
 if(!native)await page.goto((process.env.SPACE_PREVIEW_URL??'http://127.0.0.1:4189')+'/docs/design/art-workflow/space-v1/index.html?stage=3');await wait(()=>document.documentElement.dataset.ready==='true');
 check((await frame()).continuous===true,'third stage is explicitly enabled in an isolated page');
 await page.click('#nav-work');await wait(()=>{const s=window.spacePreview.snapshot();return s.frame.bodyX===850&&s.frame.bodyY===600&&!s.navigation.active;});
 await page.waitForTimeout(250);check(await page.locator('#ground-shell').evaluate(el=>el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((v,i)=>i%4===3&&v>8)),'distant ground prop retains its own rendered depth plane');
 await edit('destination',450,600);await page.click('#sit');await wait(()=>window.spacePreview.snapshot().frame.sit>.95);
 await page.click('#loop');await wait(()=>{const f=window.spacePreview.snapshot().frame;return f.phase==='prepare'&&f.sit>.1;});await pause('seated-rise');
 await phase('approach');const old=(await frame()).actionNavigation;await pause('approach');
 await wait(()=>{const f=window.spacePreview.snapshot().frame;return f.actionNavigation?.id>0||f.phase==='settle';});
 check((await snapshot()).events.filter(e=>e.kind==='navigation-arrived'&&e.id===old.id).length===0,'interrupted route does not report arrival');
 await phase('grasp');const pre=await pause('before-pickup');check(pre.owner==='ground'&&pre.commits.pickup===0,'before pickup commit ownership remains on ground');
 await phase('lift');const post=await pause('after-pickup');check(post.owner==='hand'&&post.commits.pickup===1,'after pickup commit ownership stays attached exactly once');
 await phase('carry');await wait(()=>window.spacePreview.snapshot().frame.navigation.speed>5);let moving=await frame();check(moving.owner==='hand'&&moving.bodyY>555,'held prop follows actual two-axis movement');
 if(native){await browser.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));const a=await phase('paused');await page.waitForTimeout(1300);check((await frame()).bodyX===a.bodyX&&(await frame()).owner==='hand','native powerMonitor suspend preserves root and owned prop');await page.click('#resume');await phase('carry');}
 await pause('held-navigation');await phase('release');const releasing=await pause('before-drop');check(releasing.owner==='hand'&&releasing.commits.drop===0,'release interruption cannot commit before hand opens');
 await phase('retract');const dropped=await pause('after-drop');check(dropped.owner==='ground'&&dropped.commits.drop===1,'drop commit is preserved through interrupted exit');
 await phase('idle');let s=await snapshot();check(s.frame.commits.pickup===1&&s.frame.commits.drop===1&&Math.abs(s.frame.groundQuad[2].y-600)<1,'one loop reaches an independent destination floor and commits once');
 // Reverse destination requires a real turn, from the current body/prop position.
 await edit('destination',250,555);await page.click('#loop');await phase('carry');await wait(()=>Math.abs(window.spacePreview.snapshot().frame.visualFacing)<.8);const turning=await pause('half-turn');check(turning.owner==='hand','half turn keeps object bound');
 await phase('idle');s=await snapshot();check(s.frame.commits.pickup===2&&s.frame.commits.drop===2&&Math.abs(s.frame.groundGrip.x-250)<1.5&&Math.abs(s.frame.groundQuad[2].y-555)<1.5,'reverse loop resumes from current pose and drops at the changed two-dimensional target');
 // Change geometry through the live editor while navigating; the old receipt is retired.
 await edit('destination',450,600);await page.click('#loop');await phase('carry');const previous=(await frame()).actionNavigation;
 await edit('planter',490,220);await phase('paused');check((await frame()).error==='world-changed'&&(await frame()).owner==='hand','world revision pauses an owned action without releasing the object');
 await page.click('#resume');await phase('carry');check((await frame()).actionNavigation.id>previous.id,'resume replans with fresh operation identity');await phase('idle');
 s=await snapshot();check(s.frame.commits.pickup===3&&s.frame.commits.drop===3,'changed geometry completes without replaying contact commits');
 // A real body drag interrupts contact, preserving the object and counters.
 await page.click('#pickup');await phase('reach');const beforeDrag=await frame(),box=await page.locator('#actor-hit').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2-8,{steps:6});await page.mouse.up();await phase('paused');
 const dragged=await frame();check(dragged.owner==='ground'&&dragged.commits.pickup===3&&Math.hypot(dragged.bodyX-beforeDrag.bodyX,dragged.bodyY-beforeDrag.bodyY)>1,'real contact-time drag preserves ground ownership and actual release root');
 await page.click('#resume');await phase('held');check((await frame()).commits.pickup===4,'drag recovery approaches the still-grounded object exactly once');await page.click('#drop');await phase('idle');s=await snapshot();check(s.frame.commits.drop===4,'drag recovery completes a single matching drop');
 const commits=s.events.filter(e=>e.type==='pickup'||e.type==='drop');check(commits.length===8&&commits.every(e=>e.type==='pickup'?e.contact.distance<=1.5:e.contact.groundDistance<=1.5),'all eight ownership commits came from actual rig contact');
 check(s.measuredRaster.binding<.01&&s.measuredRaster.ownerMismatches===0&&s.measuredRaster.wrongLayers===0&&s.measuredRaster.ownerSwitchJump<1.5,'same-frame composition preserves binding, opacity and contact continuity');
 const m=s.measuredRaster,b=s.bodyEnvelope;check(m.left<=b.left&&m.right<=b.right&&m.top<=b.top&&m.bottom<=b.bottom,'actual decoded body, hands and held prop stay inside the collision envelope');
 await page.screenshot({path:resolve(output,'four-loops-complete.png'),fullPage:true});
 await page.click('#reset-action');await wait(()=>window.spacePreview.snapshot().frame.phase==='idle'&&window.spacePreview.snapshot().frame.commits.pickup===0&&!document.querySelector('#reset-action').disabled);check(Math.abs((await frame()).groundQuad[2].y-600)<1,'explicit reset preserves independent prop floor after dragging the actor');
 await page.click('#nav-work');await wait(()=>{const s=window.spacePreview.snapshot();return s.frame.bodyX===850&&s.frame.bodyY===600&&!s.navigation.active;});check((await frame()).commits.pickup===0,'manual navigation after action and reset remains usable with independent logical identities');
 check(errors.length===0,'no browser errors');await page.screenshot({path:resolve(output,'complete.png'),fullPage:true});
 await writeFile(resolve(output,'actions.json'),JSON.stringify({passed:true,sourceIdentity,checks,errors,browser:native?await browser.evaluate(()=>process.versions):browser.version(),native,physicalMultiDisplay:false,snapshot:s},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,output}));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({sourceIdentity,checks,error:error.stack,snapshot:await snapshot().catch(()=>null)},null,2));throw error;}finally{if(!native)await context.close();await browser.close();if(profile){await rm(profile,{recursive:true,force:true});await writeFile(resolve(output,'cleanup.json'),JSON.stringify({profile,removed:true})+'\n');}}
