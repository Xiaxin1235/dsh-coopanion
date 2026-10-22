// Isolated browser acceptance for the stage 1 editor. Reuses the one local
// preview service; never talks to a real Harness or an OS desktop instance.
import assert from 'node:assert/strict';
import { chromium } from '../scripts/lib/playwright.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.env.SPACE_PREVIEW_URL??'http://127.0.0.1:4189';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/space-preview');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:output,size:{width:1440,height:1080}}});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const frame=()=>page.locator('#world').getAttribute('data-frame').then(JSON.parse);
const wait=async(predicate,timeout=45000)=>page.waitForFunction(predicate,undefined,{timeout});
const edit=async(id,x,y)=>{await page.selectOption('#object-select',id);await page.fill('#edit-x',String(x));if(await page.isEnabled('#edit-y'))await page.fill('#edit-y',String(y));await page.click('#apply-placement');};
let final;
try {
  await page.goto(base);await wait(()=>document.documentElement.dataset.ready==='true');await page.waitForFunction(()=>document.querySelector('#world').dataset.painted);
  check((await page.textContent('#route-result')).includes('可通过'),'default full-body route passes');
  check(await page.locator('.object img').evaluateAll(images=>images.every(im=>im.complete&&im.naturalWidth>0)),'four authored SVG resource types decode');
  await page.screenshot({path:resolve(output,'space-ready.jpg'),fullPage:true});
  const planter=await page.locator('[data-object="planter"]').boundingBox();await page.mouse.move(planter.x+planter.width/2,planter.y+planter.height/2);await page.mouse.down();await page.mouse.move(planter.x+planter.width/2+30,planter.y+planter.height/2+10,{steps:5});await page.mouse.up();
  check(await page.locator('[data-object="planter"]').evaluate(el=>parseFloat(el.style.left)>500),'scene object receives real pointer drag through guide layers');await edit('planter',485,220);
  await page.uncheck('#show-zones');check(await page.locator('#zones').evaluate(el=>el.hidden),'zones can be hidden');await page.check('#show-zones');
  await page.uncheck('#show-route');check(await page.locator('#route-layer').evaluate(el=>getComputedStyle(el).display==='none'),'geometric route overlay can be hidden');await page.check('#show-route');
  await page.click('#block-route');check((await page.textContent('#route-result')).includes('替代路线'),'live obstacle relocation finds a legal ground detour');await page.screenshot({path:resolve(output,'space-blocked.jpg'),fullPage:true});
  await page.click('#restore-route');check((await page.textContent('#route-result')).includes('可通过'),'restoring obstacle recovers route');
  await edit('gate-north',621,420);check((await page.textContent('#threshold-label')).includes('162px')&&(await page.textContent('#route-result')).includes('可通过'),'edited 162px threshold retains finite ground-body clearance');await edit('gate-north',621,280);
  await edit('planter',235,480);check(await page.evaluate(()=>Number(getComputedStyle(document.querySelector('[data-object="planter"]')).zIndex)>Number(getComputedStyle(document.querySelector('#composition')).zIndex)),'foreground prop sorts over the complete body-shell-finger unit');await page.selectOption('#object-select','actor');await page.click('[data-object="planter"]');check(await page.inputValue('#object-select')==='planter','foreground object wins pointer selection over the body behind it');await page.screenshot({path:resolve(output,'space-occlusion.jpg'),fullPage:true});await edit('planter',485,220);
  await edit('planter',330,450);check(!(await page.isEnabled('#loop')),'unsafe horizontal action plane is locked');
  await page.uncheck('#show-zones');check(!(await page.isEnabled('#loop')),'hiding region overlay never disables solid geometry');await page.check('#show-zones');
  await edit('planter',485,220);
  await edit('actor',260,575);await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).bodyX===260&&Math.abs(JSON.parse(document.querySelector('#world').dataset.frame).groundQuad[2].y-575)<1&&!document.querySelector('#apply-placement').disabled);
  check((await frame()).commits.pickup===0,'editor body x/y placement resets rather than fabricates motion commits');
  check(Math.abs((await frame()).groundGrip.x-335)<1,'body edit preserves shell x and aligns the action floor');
  await page.click('#reset-layout');await page.waitForFunction(()=>!document.querySelector('#reset-layout').disabled);await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).bodyX===240);
  // Real pointer events on the scaled world, not synthetic command injection.
  const shell=await page.locator('#shell-hit').boundingBox();await page.mouse.move(shell.x+shell.width/2,shell.y+shell.height/2);await page.mouse.down();await page.mouse.move(shell.x+shell.width/2+24,shell.y+shell.height/2,{steps:6});await page.mouse.up();
  await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).groundGrip.x>350);check((await frame()).commits.pickup===0,'shell pointer drag changes placement without pickup');
  await page.check('#show-anchors');await page.check('#show-occlusion');check(await page.locator('#anchors-layer circle').count()>2,'actual feet, hand and grip anchors render');
  await page.screenshot({path:resolve(output,'space-anchors.jpg'),fullPage:true});await page.uncheck('#show-occlusion');
  await page.click('#loop');await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='reach'&&f.elapsed>.25;});await page.click('#pause');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).phase==='paused');const paused=await frame();await page.waitForTimeout(1300);const frozen=await frame();
  check(paused.elapsed===frozen.elapsed&&paused.owner==='ground','long pre-contact pause freezes clock and ownership');await page.click('#step');await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='paused'&&f.elapsed>0;});await page.waitForTimeout(100);check((await frame()).elapsed>paused.elapsed,'one-frame step advances the real authored state');await page.waitForTimeout(1300);await page.click('#resume');
  await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).phase==='held');await page.click('#pause');await wait(()=>JSON.parse(document.querySelector('#world').dataset.frame).phase==='paused');await page.screenshot({path:resolve(output,'space-held.jpg'),fullPage:true});await page.click('#resume');
  await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='idle'&&f.commits.drop===1;});
  check((await frame()).commits.pickup===1,'first real loop commits exactly one pickup and drop');
  await edit('destination',260,555);await page.click('#loop');await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='idle'&&f.commits.drop===2;});
  check((await frame()).commits.pickup===2&&Math.abs((await frame()).groundGrip.x-260)<2,'repeated opposite-direction loop reaches changed actual destination');
  await page.click('#actor-hit');check((await frame()).commits.drop===2,'clicking to select the actor preserves completed action counts');
  const downloadWait=page.waitForEvent('download');await page.click('#download');const download=await downloadWait;await download.saveAs(resolve(output,'exported-layout.json'));check(download.suggestedFilename()==='coopanion-space-layout.json','editable geometry is downloadable');
  final=await page.evaluate(()=>window.spacePreview.snapshot());
  const m=final.measuredRaster,b=final.bodyEnvelope;check(m.frames>20&&m.left<=b.left&&m.right<=b.right&&m.top<=b.top&&m.bottom<=b.bottom,'measured real body and hand raster fits the route envelope');
  check(m.binding<.01&&m.ownerMismatches===0&&m.wrongLayers===0&&m.ownerSwitchJump<1.5,'binding, opaque continuous hands and owner transition remain correct');
  const events=final.events.filter(e=>['pickup','drop'].includes(e.type));check(events.length===4&&events.every(e=>e.type==='pickup'?e.contact.distance<=1.5:e.contact.groundDistance<=1.5),'both loops commit through actual stable contact');
  check(final.route.passed&&final.navigationImplemented===true,'runtime navigation is explicitly enabled while authored contact remains independent');
  await page.screenshot({path:resolve(output,'space-complete.jpg'),fullPage:true});
  await page.setViewportSize({width:700,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'narrow editor fits viewport without horizontal overflow');await page.screenshot({path:resolve(output,'space-narrow.jpg'),fullPage:true});
  check(errors.length===0,'no browser page errors');
  // The unchanged O03 mesh and compositor must still pass actual WebGL pixels,
  // as well as its original slow/paused three-loop acceptance in a fresh page.
  if(!process.argv.includes('--space-only')) {
  const legacy=await browser.newPage({viewport:{width:1280,height:1000}});
  try {
    await legacy.goto(base+'/docs/design/art-workflow/o03-shell-hands-v1/continuity.html');await legacy.click('#run');
    await legacy.waitForFunction(()=>document.querySelector('#report').textContent.includes('"passed"'));
    const pixels=JSON.parse(await legacy.textContent('#report'));
    await writeFile(resolve(output,'contact-pixels.json'),JSON.stringify(pixels,null,2)+'\n');await legacy.screenshot({path:resolve(output,'contact-pixels.jpg'),fullPage:true});
    check(pixels.passed,'legacy WebGL wrist, cuff, finger and owner-switch pixels still pass');
    await legacy.goto(base+'/docs/design/art-workflow/o03-shell-hands-v1/index.html');await legacy.click('#qa-run');
    await legacy.waitForFunction(()=>document.querySelector('#qa-report').textContent.includes('"passed"'),undefined,{timeout:210000});
    const motion=JSON.parse(await legacy.textContent('#qa-report'));check(motion.passed&&motion.checks.length===44,'legacy 44 checks pass including slow closure, pause, step and repeated release');
    await writeFile(resolve(output,'legacy-motion.json'),JSON.stringify(motion,null,2)+'\n');
  } finally {await legacy.close();}
  }
  await writeFile(resolve(output,'browser-qa.json'),JSON.stringify({passed:true,checks,errors,final,legacyIncluded:!process.argv.includes('--space-only'),browser:browser.version(),url:page.url()},null,2)+'\n');
  console.log(JSON.stringify({passed:true,checks:checks.length,measurements:final.measuredRaster,output}));
} catch(error) {
  await page.screenshot({path:resolve(output,'failure.jpg'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'browser-qa.json'),JSON.stringify({passed:false,error:error.stack,checks,errors,frame:await frame().catch(()=>null)},null,2));throw error;
} finally {await context.close();await browser.close();}
