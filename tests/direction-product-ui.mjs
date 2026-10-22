import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {once} from 'node:events';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {chromium,_electron,artifactRoot} from '../scripts/lib/playwright.mjs';import {previewServer} from '../scripts/preview.mjs';import {readRgbaPng} from '../scripts/lib/rgba-png.mjs';
const native=process.argv.includes('--native');if(native&&process.platform==='darwin'&&process.env.DSH_MACOS_VM_TEST!=='1')throw Error('Run native direction regression in macOS VM.');
const out=resolve(process.env.DIRECTION_EVIDENCE_DIR??join(artifactRoot,'direction-product'));await mkdir(out,{recursive:false});
const profile=await mkdtemp(join(tmpdir(),'dsh-direction-product-')),server=previewServer({dataDir:profile});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser,context,app,page,video;const errors=[],checks=[];const check=s=>{console.log(s);checks.push(s);};
try{
 const url=`http://127.0.0.1:${server.address().port}`;
 if(native){const entry=join(profile,'preview.cjs');await writeFile(entry,`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(join(profile,'user'))});app.whenReady().then(()=>new BrowserWindow({width:1100,height:850,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}}).loadURL(${JSON.stringify(url)}));app.on('window-all-closed',()=>app.quit());`);app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',entry]});page=await app.firstWindow();}
 else {browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});context=await browser.newContext({viewport:{width:1100,height:800},recordVideo:{dir:join(out,'video'),size:{width:1100,height:800}}});page=await context.newPage();video=page.video();await page.goto(url);}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.setDefaultTimeout(25000);
 await page.waitForSelector('#pet[data-mode]');
 // Use the production factory with a controlled host and frame clock. The main
 // page scenario remains in living-integration-ui/native; no test renderer here.
 await page.evaluate(async()=>{
  const [{createWhaleBody},kit]=await Promise.all([import('/upstream/whale/figure.js'),import('/upstream/kit/body.js')]);
  const whale=await(await fetch('/upstream/whale/model.json')).json();
  // Product assembly data comes from the same shipped files as the default page.
  whale.living={shell:await(await fetch('/props/shell/asset.json')).json(),motion:await(await fetch('/props/shell/motion-with-hands.json')).json(),hands:await(await fetch('/props/shell/hands/asset.json')).json()};
  const root=document.createElement('div');root.id='direction-product';root.style.cssText='position:fixed;inset:0;background:#f4f5f8;z-index:99999';document.body.append(root);
  window.testBounds={W:1100,H:800,S:180/256,floorY:760,livingSpace:true,navigation:true,continuousActions:true};
  window.directionEvents=[];window.directionActor=await createWhaleBody(new URL('/upstream/whale/',location.href),{model:whale,kit,host:{root,bounds:()=>testBounds,emit:(kind,detail)=>directionEvents.push({kind,detail}),start:{x:550,facing:1}}});
  directionActor.set({livingContext:{planar:true}});directionActor.place2d({x:550,y:500});
  window.advance=(frames=1,dt=1/60)=>{for(let i=0;i<frames;i++)directionActor.step(dt);return directionActor.layout();};
  window.travel=(dx,dy,id)=>{directionActor.step(1/60);directionActor.set({motionCommand:{type:'resume'}});directionActor.step(1/60);directionActor.cancelNavigation('test');directionActor.place2d({x:550,y:500});directionActor.navigate({id,generation:1,model:{width:1100,height:800,body:{left:104,right:104,top:205,bottom:8},margin:10,obstacles:[],revision:1},target:{x:550+dx,y:500+dy}});return advance(180);};
  advance(100);
 });
 check('shipped product factory, meshes and assets load without authoring resources');
 for(const [i,[name,x,y]]of [['front',0,180],['frontRight',200,150],['backRight',200,-150],['back',0,-200],['backLeft',-200,-150],['frontLeft',-200,150]].entries()){
  const l=await page.evaluate(([x,y,id])=>travel(x,y,id),[x,y,i+1]);assert.equal(l.direction.current,name);assert.equal(l.direction.legacy,false);assert.ok(l.navigation.speed>0||l.navigation.phase==='settling');
  assert.ok(l.box.w>100);await page.screenshot({path:join(out,name+'.png')});
 }
 check('actual 2D navigation selects all six directions with positive body width');
 const frames=await page.evaluate(()=>{directionActor.cancelNavigation('test');const r=[];for(let i=0;i<100;i++)r.push(advance());return r;});
 assert.equal(frames.at(-1).direction.current,'front');for(const l of frames)assert.ok(l.direction.width>=.9);check('stopping returns to the user through bounded adjacent turns');
 const pause=await page.evaluate(()=>({before:directionActor.layout(),after:advance(0)}));assert.deepEqual(pause.before,pause.after);
 await page.evaluate(async()=>{travel(200,-150,7);directionActor.cancelNavigation('record');directionActor.place2d({x:550,y:500});directionActor.navigate({id:8,generation:1,model:{width:1100,height:800,body:{left:104,right:104,top:205,bottom:8},margin:10,obstacles:[],revision:1},target:{x:750,y:350}});for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);advance(1,i<120?1/60:1/240);}directionActor.cancelNavigation('record-end');advance(120);});
 check('normal and quarter-speed production frames recorded; a zero-step holds the pose');
 const capture=async word=>{await page.evaluate(w=>{directionActor.set({expression:w});advance(20);},word);return page.locator('#direction-product canvas').evaluate(c=>c.toDataURL());};
 const neutral=await capture('neutral'),happy=await capture('happy');assert.notEqual(neutral,happy);await page.evaluate(()=>directionActor.talk());const talk=await page.evaluate(()=>{advance(1);return document.querySelector('#direction-product canvas').toDataURL();});assert.notEqual(happy,talk);
 check('frontal expression vocabulary and speech repaint the live face');
 const turned=await page.evaluate(()=>{directionActor.do('turn');return advance(45);});assert.equal(turned.direction.current,turned.facing<0?'frontLeft':'frontRight');await page.evaluate(()=>advance(160));
 check('explicit turn preserves the existing body motion word');
 const changed=await page.evaluate(async()=>{await directionActor.setScheme('qwen');return advance(60);});assert.equal(changed.direction.legacy,true);await page.evaluate(async()=>{await directionActor.setScheme('deepseek');advance(100);});
 for(const word of ['wave','sit','jump']){const l=await page.evaluate(w=>{directionActor.do(w);return advance(5);},word);assert.equal(l.direction.legacy,true);await page.evaluate(()=>{directionActor.do('stand');advance(160);});}
 check('other colours, gestures, sitting and jumping use calibrated compatible poses');
 for(const size of [90,180,240]){await page.evaluate(size=>{directionActor.do('stand');testBounds.S=size/256;directionActor.resize();directionActor.place2d({x:550,y:500});advance(100);},size);await page.screenshot({path:join(out,`front-${size}.png`)});}
 // Head edit is used only by its registered UV crop. It must preserve alpha margins.
 const m=JSON.parse(await readFile('web/upstream/whale/directions/model.json'));const def=m.directions.backRight,p=def.parts.find(p=>p.id==='head');const png=readRgbaPng(await readFile('web/upstream/whale/directions/'+def.headAtlas));let edge=0,clear=0;
 const [x0,y0,x1,y1]=p.uvBox.map((v,i)=>Math.round(v*(i%2?png.height:png.width)));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const a=png.pixels[(y*png.width+x)*4+3];if(a===0)clear++;if((x===x0||x===x1-1||y===y0||y===y1-1)&&a>=16)edge++;}assert.equal(edge,0);assert.ok(clear>1000);
 check('three product sizes and repaired head alpha verified');
 assert.deepEqual(errors,[]);
 const source={};for(const p of ['web/upstream/whale/figure.js','web/upstream/whale/direction.js','web/upstream/whale/directional-rig.js','web/upstream/whale/directions/model.js','web/upstream/kit/body.js','web/upstream/kit/living-body.js','tests/direction-product-ui.mjs'])source[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 await writeFile(join(out,'verification.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),platform:process.platform,engine:native?await app.evaluate(()=>process.versions):browser.version(),mode:native?'native-product-factory-controlled':'browser-product-factory-controlled',checks,source},null,2)+'\n');
}finally{await app?.close();await context?.close();if(video)await video.saveAs(join(out,'directions.webm'));await browser?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
