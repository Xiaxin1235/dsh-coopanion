import assert from 'node:assert/strict';
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'coopanion-space-native-')),output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-2-native');await mkdir(output,{recursive:true});
const checks=[];checks.push=(...items)=>{Array.prototype.push.apply(checks,items);console.log(items[0]);};
const require=createRequire(import.meta.url);let app,page;
try{
 app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',resolve('desktop/space-preview.cjs')],env:{...process.env,DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_NO_SANDBOX:'1'}});
 page=await app.firstWindow();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.click('#nav-work');await page.waitForFunction(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived');},null,{timeout:25000});
 const s=await page.evaluate(()=>window.spacePreview.snapshot());assert.equal(s.frame.bodyX,850);assert.equal(s.frame.bodyY,600);checks.push('native body executes x/y and reports actual arrival');
 assert.ok(Math.abs(s.bodyLayout.x-s.frame.bodyX)<1&&Math.abs(s.bodyLayout.y-s.frame.bodyY)<1);assert.ok(Math.abs(s.bodyLayout.bubble.y-s.frame.bubble.y)<1);checks.push('native draw root, hit and bubble share body coordinates');
 assert.equal(await page.locator('iframe').contentFrame().locator('body').evaluate(()=>typeof window.dshPetBridge),'undefined');checks.push('native sandbox has no privileged bridge');
 await page.screenshot({path:join(output,'native-arrival.png')});

 // Suspend is controlled; no real system sleep or lock is requested.
 const clickWorld=async(x,y)=>{const r=await page.locator('#world').boundingBox();await page.mouse.click(r.x+x*r.width/1080,r.y+y*r.height/660);};
 await clickWorld(240,555);await page.waitForFunction(()=>window.spacePreview.snapshot().frame.bodyX<800);
 const old=(await page.evaluate(()=>window.spacePreview.snapshot())).navigation.id;
 await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));
 await page.waitForFunction(()=>window.spacePreview.snapshot().navigation.paused);await page.waitForTimeout(1300);
 const frozen=await page.evaluate(()=>window.spacePreview.snapshot().frame);await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>window.spacePreview.snapshot().frame)).bodyX,frozen.bodyX);
 await page.click('#nav-resume');await page.waitForFunction(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived'&&e.id===s.navigation.id);},null,{timeout:25000});
 assert.equal((await page.evaluate(()=>window.spacePreview.snapshot().events)).some(e=>e.kind==='navigation-arrived'&&e.id===old),false);checks.push('controlled native suspend, long pause and first resume invalidate the old receipt');
 await page.click('#nav-work');await page.waitForFunction(()=>window.spacePreview.snapshot().frame.bodyX>300);
 const drag=await page.locator('#actor-hit').boundingBox();await page.mouse.move(drag.x+drag.width/2,drag.y+drag.height/2);await page.mouse.down();await page.mouse.move(drag.x+drag.width/2-20,drag.y+drag.height/2+10,{steps:6});await page.mouse.up();await page.waitForTimeout(600);
 const released=await page.evaluate(()=>window.spacePreview.snapshot().frame);await page.waitForTimeout(600);assert.equal((await page.evaluate(()=>window.spacePreview.snapshot().frame)).bodyX,released.bodyX);checks.push('native pointer drag cancels navigation and keeps release position');
 // Verify the real OS cursor and window DIP conversion against this map's
 // actual scaled hit region. Only this isolated preview is made click-through.
 await page.click('#desktop-overlay');
 const probe=await page.evaluate(()=>{const s=window.spacePreview.snapshot(),r=document.querySelector('#world').getBoundingClientRect(),hit=s.bodyLayout.hit[0];return {x:r.x+hit.x*r.width/1080,y:r.y+hit.y*r.height/660};});
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const warp=async p=>{if(process.platform!=='darwin')return;const b=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getContentBounds());await promisify(execFile)('python3',['-c',`import ctypes,sys
class P(ctypes.Structure): _fields_=[('x',ctypes.c_double),('y',ctypes.c_double)]
c=ctypes.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');c.CGWarpMouseCursorPosition.argtypes=[P];c.CGWarpMouseCursorPosition(P(float(sys.argv[1]),float(sys.argv[2])))`,String(b.x+p.x),String(b.y+p.y)]);};
 if(process.platform==='darwin'){
  await warp({x:2,y:2});await page.waitForTimeout(200);assert.equal((await app.evaluate(()=>global.spaceNativeState)).hit,false);
  await warp(probe);await page.waitForTimeout(250);const native=await app.evaluate(()=>global.spaceNativeState);assert.equal(native.hit,true);assert.ok(Math.hypot(native.cursor.x-native.bounds.x-probe.x,native.cursor.y-native.bounds.y-probe.y)<2);checks.push('real macOS cursor leaves and re-enters scaled body; native ignore-mouse flag follows hit');
 }
 await page.keyboard.press('Escape');await page.waitForTimeout(100);
 const fallback=await page.evaluate(async()=>{
  const {loadBody}=await import('/web/upstream/body-host.js'),pack=await(await fetch('/web/upstream/whale/figure.json')).json();pack.base='/web/upstream/whale/';
  const layer=document.createElement('div');layer.style.cssText='position:absolute;inset:0;pointer-events:none';document.body.append(layer);const events=[];
  const body=await loadBody({layer,pack,start:{x:300,facing:1,scheme:'deepseek'},theme:'light',bounds:{W:1080,H:660,S:180/256,floorY:555},onEvent:(kind,value)=>events.push({kind,...value}),onSound:()=>{}});
  const offered=body.navigate({id:1,generation:1,target:{x:500,y:600}});body.walk(400,false,92);
  const timer=setInterval(()=>body.tick(1/60),16);await new Promise((ok,bad)=>{const started=performance.now();const poll=setInterval(()=>{if(events.some(e=>e.kind==='arrived'&&e.walkId===92)){clearInterval(poll);ok();}else if(performance.now()-started>12000){clearInterval(poll);bad(Error('horizontal fallback timeout'));}},30);});clearInterval(timer);const result={offered,capabilities:body.capabilities,layout:body.layout,events};body.dispose();layer.remove();return result;
 });
 assert.equal(fallback.offered,false);assert.deepEqual(fallback.capabilities,[]);assert.ok(Math.abs(fallback.layout.x-400)<2);assert.equal(fallback.layout.y,555);checks.push('legacy API 2 sandbox declines navigation and completes actual horizontal walk');
 const versions=await app.evaluate(({app,screen,BrowserWindow})=>({electron:process.versions.electron,chrome:process.versions.chrome,platform:process.platform,displays:screen.getAllDisplays().map(d=>({id:d.id,scaleFactor:d.scaleFactor,bounds:d.bounds})),window:BrowserWindow.getAllWindows()[0].getBounds()}));
 await writeFile(join(output,'native.json'),JSON.stringify({passed:true,checks,versions,snapshot:await page.evaluate(()=>window.spacePreview.snapshot()),fallback,scope:'isolated native single-screen map with controlled lifecycle and real macOS cursor',physicalMultiDisplay:false},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,versions}));
}catch(error){console.error('native failure',error);throw error;}finally{if(app){const child=app.process();let timeout;try{await Promise.race([app.close(),new Promise(resolve=>{timeout=setTimeout(()=>{child.kill('SIGTERM');resolve();},5000);})]);}finally{clearTimeout(timeout);}}await rm(profile,{recursive:true,force:true});}
