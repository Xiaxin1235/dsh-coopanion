import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve,join,extname,relative,dirname} from 'node:path';
import {tmpdir,hostname,platform,release} from 'node:os';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,_electron,artifactRoot} from '../scripts/lib/playwright.mjs';
import {readRgbaPng} from '../scripts/lib/rgba-png.mjs';
const root=resolve('.'),base='docs/design/art-workflow/d1-directions-v1',native=process.argv.includes('--native');
if(native&&process.platform==='darwin'&&process.env.DSH_MACOS_VM_TEST!=='1')throw new Error('macOS native authoring tests must run in the dedicated VM; read docs/macos-vm-testing.md');
const output=resolve(process.env.DIRECTION_EVIDENCE_DIR??join(artifactRoot,'direction-art'));await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
execFileSync(process.execPath,[base+'/inspect-atlases.mjs','--check']);
execFileSync(process.execPath,[base+'/prepare-model.mjs','--check']);
const checks=[];const check=s=>{checks.push(s);console.log(s);};
const manifest=JSON.parse(await readFile(base+'/source/manifest.json'));for(const a of manifest.assets){assert.equal(createHash('sha256').update(await readFile(base+'/source/'+a.file)).digest('hex'),a.sha256);assert.equal(createHash('sha256').update(await readFile(base+'/source/'+a.prompt)).digest('hex'),a.promptSha256);}assert.equal(manifest.assets.length,9);check('nine generated originals and all full prompts match their provenance digests');
const regions=JSON.parse(await readFile(base+'/source/atlas-regions.json'));let total=0;
const faithful=JSON.parse(await readFile(base+'/source/faithful-revision-v1.json'));
for(const a of faithful.assets){for(const [name,sha]of [[a.file,a.sha256],[a.prompt,a.promptSha256],...Object.entries(a.references)])assert.equal(createHash('sha256').update(await readFile(base+'/source/'+name)).digest('hex'),sha);}
for(const [id,file]of Object.entries(faithful.selected))assert.equal(regions[id].file,file);
for(const[id,group]of Object.entries(regions)){
 const {width,height,pixels}=readRgbaPng(await readFile(base+'/source/'+group.file));
 assert.equal(width,group.width);assert.equal(height,group.height);
 for(const[name,p]of Object.entries(group.parts)){
  const[x,y,w,h]=p.crop;assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,`${id}/${name} crop inside source`);
  let solid=0,clear=0,edge=0;
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const a=pixels[(j*width+i)*4+3];if(a>=240)solid++;if(a===0)clear++;if((i===x||i===x+w-1||j===y||j===y+h-1)&&a>=16)edge++;}
  assert.ok(solid>w*h*.1,`${id}/${name} has painted interior`);assert.ok(clear>w*h*.05,`${id}/${name} has transparent margins`);
  assert.equal(edge,0,`${id}/${name} UV crop cuts visible paint`);total++;
 }
}assert.equal(total,25);check('25 source parts have real alpha, painted interiors and no cut crop edges');
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=resolve(root,'.'+decodeURIComponent(u.pathname));if(req.method!=='GET'||!p.startsWith(root+'/')||!([base+'/','web/upstream/'].some(prefix=>relative(root,p).startsWith(prefix))))throw Error('no');res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css'}[extname(p)]??'application/octet-stream'));res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}/${base}/index.html`,errors=[];let browser,app,context,page,profile,video,versions;
try{
 if(native){profile=await mkdtemp(join(tmpdir(),'dsh-direction-native-'));const entry=join(profile,'preview.cjs');await writeFile(entry,`const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(join(profile,'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({width:1380,height:950,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});w.loadURL(${JSON.stringify(url)});});app.on('window-all-closed',()=>app.quit());`);app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['--no-sandbox',entry]});page=await app.firstWindow();versions=await app.evaluate(()=>process.versions);
 }else{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});context=await browser.newContext({viewport:{width:1360,height:900},recordVideo:{dir:join(output,'video'),size:{width:1360,height:900}}});page=await context.newPage();await page.goto(url);video=page.video();versions={chromium:browser.version()};}
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.directionPreview?.state.frames>0);check('three independent directional rigs load and draw with the shared WebGL renderer');
 const render=pose=>page.evaluate(p=>{directionPreview.pose(p);return Object.fromEntries(['front','back','backRight'].map(id=>[id,document.getElementById(id).toDataURL()]));},pose);
 // Rest assembly must ignore time, motion, gaze and blinking, including rest-shape compensation.
 const restProbe=await page.evaluate(()=>{
  directionPreview.pose({t:0});const animated=Object.fromEntries(Object.keys(directionPreview.samples).map(id=>[id,document.getElementById(id).toDataURL()]));
  const draw=p=>Object.fromEntries(Object.entries(directionPreview.samples).map(([id,sample])=>{sample.draw({...p,rest:true});return[id,document.getElementById(id).toDataURL()];}));
  return{animated,a:draw({t:0}),b:draw({t:2.13,walk:1,blink:1,look:[2,-2],stress:1})};
 });
 assert.ok(Object.keys(restProbe.a).every(id=>restProbe.a[id]===restProbe.b[id]),'raw rest assembly must ignore every animation input');
 for(const id of ['front','backRight'])assert.notEqual(restProbe.a[id],restProbe.animated[id],'raw rest assembly must also remove static and t=0 warp offsets');
 await page.selectOption('#render-mode','rest');assert.equal(await page.locator('#step').isDisabled(),true);assert.equal(await page.locator('#blink').isDisabled(),true);
 const held=await render({t:7,motion:'walk',blink:true});assert.ok(Object.keys(held).every(id=>held[id]===restProbe.a[id]));assert.equal(await page.evaluate(()=>directionPreview.state.t),0);
 await page.screenshot({path:join(output,'raw-rest-assembly.png')});
 await page.selectOption('#render-mode','animated');assert.equal(await page.locator('#step').isDisabled(),false);assert.equal(await page.locator('#blink').isDisabled(),false);
 check('raw rest assembly removes animation and static compensation; controls distinguish it from time zero');
 // Compare the actual neutral meshes against the independently supplied design.
 const neutral=await render({t:0});
 const designMetrics=await page.evaluate(()=>{
  const pixels=canvas=>{const c=document.createElement('canvas');c.width=c.height=840;const g=c.getContext('2d');g.drawImage(canvas,0,0);return g.getImageData(0,0,840,840).data;};
  const result={};
  for(const [id,reference]of Object.entries(directionPreview.references)){
   const a=pixels(document.getElementById(id)),b=pixels(reference);let intersection=0,union=0;
   for(let i=3;i<a.length;i+=4){const aa=a[i]>128,bb=b[i]>128;if(aa||bb)union++;if(aa&&bb)intersection++;}
   result[id]={silhouetteIoU:intersection/union};
   if(id==='front'){
    const eyeStats=data=>[[98,124],[137,162]].map(([x0,x1])=>{let n=0,xs=0,ys=0;for(let y=354;y<438;y++)for(let x=(x0+12)*3;x<(x1+12)*3;x++){const k=(y*840+x)*4,[r,g,b,a]=data.slice(k,k+4);if(a>200&&g>120&&g>r*1.5&&b>g*.9){n++;xs+=x/3-12;ys+=y/3-8;}}return{count:n,x:xs/n,y:ys/n};});
    result[id].eyes={actual:eyeStats(a),design:eyeStats(b)};
   }
  }
  return result;
 });
 for(const [id,m]of Object.entries(designMetrics))assert.ok(m.silhouetteIoU>=.89,`${id} silhouette must follow design: ${m.silhouetteIoU}`);
 for(let i=0;i<2;i++){const a=designMetrics.front.eyes.actual[i],b=designMetrics.front.eyes.design[i];assert.ok(a.count>350);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1.2,'visible iris must stay on its design landmark');}
 check('legacy silhouette and iris landmark thresholds retained as numeric regression, not character identity acceptance');
 await writeFile(join(output,'design-comparison.json'),JSON.stringify(designMetrics,null,2)+'\n');
 await page.selectOption('#reference-view','overlay');assert.equal(await page.evaluate(()=>directionPreview.state.t),0);await page.screenshot({path:join(output,'design-overlay.png')});await page.selectOption('#reference-view','design');await page.screenshot({path:join(output,'design-reference.png')});await page.selectOption('#reference-view','actual');
 for(const id of ['front','backRight'])await writeFile(join(output,id+'.png'),Buffer.from(neutral[id].split(',')[1],'base64'));
 const idle=await render({t:1});const blink=await render({t:1,blink:true});assert.notEqual(idle.front,blink.front);assert.equal(idle.back,blink.back);assert.equal(idle.backRight,blink.backRight);
 // Blink must only change the front eye area, leaving cloth, hair and skin outside it identical.
 const a=readRgbaPng(Buffer.from(idle.front.split(',')[1],'base64')),b=readRgbaPng(Buffer.from(blink.front.split(',')[1],'base64'));let changes=0,outside=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;if(!a.pixels.subarray(i,i+4).equals(b.pixels.subarray(i,i+4))){changes++;const rx=x/3-12,ry=y/3-8;if(rx<88||rx>179||ry<108||ry>140)outside++;}}
 assert.ok(changes>100);assert.equal(outside,0);check('blink changes the independent front eyes only; back views never gain a face');
 const walk=await render({t:1.15,motion:'walk'});for(const id of Object.keys(walk))assert.notEqual(walk[id],idle[id]);
 const motion=await page.evaluate(()=>{const result=[];for(let i=0;i<120;i++){directionPreview.pose({t:i/60,motion:'walk'});result.push(Object.fromEntries(Object.entries(directionPreview.state.states).map(([id,s])=>[id,{root:s.root,feet:s.feet}])));}return result;});
 for(const id of Object.keys(walk)){for(const sample of motion){assert.deepEqual(sample[id].root,[128,256]);assert.ok(sample[id].feet.every(p=>p.every(Number.isFinite)));}assert.ok(Math.max(...motion.map(s=>s[id].feet[0][1]))-Math.min(...motion.map(s=>s[id].feet[0][1]))>3);}
 check('120 actual gait frames articulate separate legs while foot-origin remains fixed');
 await page.evaluate(()=>directionPreview.pose({t:1,motion:'walk'}));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>directionPreview.state.t),1);await page.click('#step');assert.ok(Math.abs(await page.evaluate(()=>directionPreview.state.t)-(1+1/60))<1e-9);check('pause holds the pose; single-step advances exactly one authored frame');
 // Shared painted overlap at thigh/skirt and shoulder attachments under both arm extremes.
 const probe=await page.evaluate(()=>{const bad=[];for(const t of [.785,2.356]){directionPreview.pose({t,motion:'stress'});for(const id of ['front','back','backRight']){const cv=document.getElementById(id),c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const g=c.getContext('2d');g.drawImage(cv,0,0);for(const [x,y]of (id==='backRight'?[[114,211],[141,214],[133,165]]:id==='front'?[[114,216],[141,216],[128,170]]:[[116,218],[149,218],[128,174]])){const a=g.getImageData(Math.round((x+12)*3),Math.round((y+8)*3),1,1).data[3];if(a<220)bad.push({id,t,x,y,a});}}}return bad;});assert.deepEqual(probe,[]);check('painted thigh/skirt and torso overlaps remain opaque at both arm stress extremes');
 for(const size of ['90','180','240'])for(const bg of ['white','dark']){await page.selectOption('#size',size);await page.selectOption('#bg',bg);await render({t:1.15,motion:'walk'});await page.screenshot({path:join(output,`${size}-${bg}.png`)});}
 check('90/180/240px on white/dark backgrounds captured for visual review');
 await page.selectOption('#size','180');await page.selectOption('#bg','checker');await page.selectOption('#motion','walk');await page.click('#pause');await page.waitForTimeout(1800);await page.selectOption('#speed','0.25');await page.waitForTimeout(1500);await page.click('#pause');
 assert.deepEqual(errors,[]);check('normal and slow gait run without page errors');
 await render({t:1});await page.screenshot({path:join(output,'overview.png')});
 const source={};async function hashTree(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await hashTree(p);else source[relative(root,p)]=createHash('sha256').update(await readFile(p)).digest('hex');}}await hashTree(resolve(base));for(const p of ['web/upstream/kit/rig.js','web/upstream/whale/front-face.js','web/upstream/whale/direction-shape.js','web/upstream/whale/feat/eyeL_ball.png','web/upstream/whale/feat/eyeL_iris.png','web/upstream/whale/feat/eyeL_lash.png','web/upstream/whale/feat/neutral_mouth.png','web/upstream/whale/tex/brows.png','tests/direction-art-ui.mjs'])source[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 await writeFile(join(output,'verification.json'),JSON.stringify({schema:1,time:new Date().toISOString(),mode:native?'isolated-native-authoring':'headless-browser-authoring',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),host:{hostname:hostname(),platform:platform(),release:release()},versions,checks,source,limitations:['Authoring sample only, not the default product.','No six-direction turn acceptance, multi-direction grip, physical-device or user LIVE acceptance.']},null,2)+'\n');
}finally{if(app)await app.close();if(context)await context.close();if(video)await video.saveAs(join(output,'authoring-loop.webm'));if(browser)await browser.close();await new Promise(r=>server.close(r));if(profile)await rm(profile,{recursive:true,force:true});}
