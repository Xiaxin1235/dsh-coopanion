import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,join,relative,resolve} from 'node:path';
import {platform,release} from 'node:os';
import {chromium} from '../scripts/lib/playwright.mjs';
import {tailMesh,project} from '../docs/design/art-workflow/d1-turnaround-v1/tail-geometry.js';

const root=resolve('.'),base='docs/design/art-workflow/d1-turnaround-v1';
const source=join(root,base,'source'),manifest=JSON.parse(await readFile(join(source,'manifest.json')));
const output=resolve(process.env.TURNAROUND_EVIDENCE_DIR??`artifacts/runs/turnaround-${Date.now()}`);
await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
const digest=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const checks=[],check=message=>{checks.push(message);console.log(message);};
for(const candidate of manifest.candidates){
 assert.equal(await digest(join(source,candidate.file)),candidate.sha256,candidate.file);
 assert.equal(await digest(join(source,candidate.prompt)),candidate.promptSha256,candidate.prompt);
 for(const ref of candidate.references)assert.equal(await digest(join(source,ref.file)),ref.sha256,ref.file);
}
for(const ref of [...manifest.referencePriority,...manifest.referenceHistory,...(manifest.feedback??[])])assert.equal(await digest(join(source,ref.file)),ref.sha256,ref.file);
for(const study of manifest.constructionHistory){
 assert.equal(study.status,'superseded-study-not-current-design');
 assert.equal(await digest(join(source,study.file)),study.sha256);
 assert.equal(await digest(join(source,study.geometry)),study.geometrySha256);
}
for(const attempt of manifest.interruptedAttempts)assert.equal(await digest(join(source,attempt.prompt)),attempt.promptSha256);
assert.equal(manifest.constructionReference,undefined,'superseded geometry must not remain a current design source');
const historicalConstruction=manifest.constructionHistory.at(-1);
check('all original candidates, exact prompts and reference bytes match provenance hashes');

for(const observation of manifest.observations??[])assert.equal(await digest(join(source,observation.file)),observation.sha256);
const geometry=JSON.parse(await readFile(join(source,historicalConstruction.geometry))),mesh=tailMesh(geometry);
for(const {points}of mesh)for(const [x,y,z]of points){
 if(y<geometry.hemHeight)continue;
 const t=(y-geometry.hemHeight)/(geometry.skirt.waistHeight-geometry.hemHeight);
 const radii=geometry.skirt.hemRadii.map((r,i)=>r+(geometry.skirt.waistRadii[i]-r)*t);
 assert.ok((x/radii[0])**2+(z/radii[1])**2<=1.00001,'proximal tail must fit inside the skirt above its hem');
}
const projectedSpan=yaw=>{const xs=mesh.flatMap(t=>t.points.map(p=>project(p,yaw,geometry.projection.elevationDegrees)[0]));return Math.max(...xs)-Math.min(...xs);};
assert.ok(Math.abs(projectedSpan(0)-geometry.flukeSpan)<1e-9);
assert.ok(Math.abs(projectedSpan(180)-geometry.flukeSpan)<1e-9);
check('historical proxy uses equal front/back span and hides the proximal tail inside the skirt');

const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(req.method!=='GET'||!relative(root,path).startsWith('docs/design/art-workflow/'))throw Error('outside authoring scope');
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png'}[extname(path)]??'text/plain'));
  res.setHeader('cache-control','no-store');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/${base}/index.html`);
 await page.waitForFunction(()=>window.turnaroundReview?.current);
 assert.equal(await page.evaluate(()=>turnaroundReview.current),manifest.reviewCandidate);
 assert.equal(await page.locator('#selected-reference img').getAttribute('src'),'source/'+manifest.referencePriority[0].file);
 assert.equal(manifest.referencePriority.length,1,'one current primary reference');
 assert.deepEqual(await page.locator('#connection-comparison img').evaluateAll(images=>images.map(img=>img.getAttribute('src'))),manifest.structureComparison.map(file=>'source/'+file));
 await page.locator('#connection-comparison img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.locator('#connection-comparison').screenshot({path:join(output,'connection-comparison.png')});
 assert.equal(await page.locator('details.history').getAttribute('open'),null,'obsolete references must be collapsed');
 await page.locator('#guides').check();await page.locator('#structure').check();
 for(const candidate of manifest.candidates){
  await page.selectOption('#candidate',candidate.file);
  await page.waitForFunction(file=>turnaroundReview.current===file,candidate.file);
  assert.deepEqual(await page.locator('#turnaround').evaluate(img=>[img.naturalWidth,img.naturalHeight]),candidate.canvas);
  assert.deepEqual(await page.locator('#view-labels span').allTextContents(),candidate.views);
  assert.equal(await page.locator('#annotations line').count(),candidate.guides.length);
  const h=1000*candidate.canvas[1]/candidate.canvas[0];
  const ys=await page.locator('#annotations line').evaluateAll(lines=>lines.map(line=>Number(line.getAttribute('y1'))));
  assert.deepEqual(ys,candidate.guides.map(guide=>guide.y*h));
  assert.equal(Number(await page.locator('#annotations rect').getAttribute('x')),(candidate.primaryTailReviewBox??candidate.rearTailReviewBox)[0]*1000);
  assert.equal(await page.locator('#candidate-notes').textContent(),candidate.review);
  assert.equal(await page.locator('#focus-back-tail').isEnabled(),Boolean(candidate.backTailReviewBox));
  assert.equal(await page.locator('#annotations .attachment-guide').count(),candidate.attachmentGuides?.length??0);
  if(candidate.backTailReviewBox){
   await page.locator('#focus-back-tail').click();
   assert.equal(Number(await page.locator('#annotations rect').getAttribute('x')),candidate.backTailReviewBox[0]*1000);
   await page.locator('#focus-tail').click();
  }
 }
 check('every candidate decodes with its own view labels, proportion guides and review notes');
 // Rapid selection must leave the final candidate and its annotations together.
 await page.evaluate(files=>{const selector=document.getElementById('candidate');for(const file of files){selector.value=file;selector.dispatchEvent(new Event('change'));}},[manifest.candidates[0].file,manifest.reviewCandidate]);
 await page.waitForFunction(file=>turnaroundReview.current===file,manifest.reviewCandidate);
 await page.locator('#guides').uncheck();await page.locator('#structure').uncheck();await page.selectOption('#zoom','1');
 await page.screenshot({path:join(output,'overview.png'),fullPage:true});
 await page.locator('#focus-tail').click();
 assert.equal(await page.locator('#zoom').inputValue(),'2');
 assert.equal(await page.locator('#annotations rect').count(),1);
 const tailFocus=await page.evaluate(()=>{const current=turnaroundReview.manifest.candidates.find(c=>c.file===turnaroundReview.current),zone=current.primaryTailReviewBox??current.rearTailReviewBox,v=document.getElementById('viewport'),s=document.getElementById('sheet');return{actual:v.scrollLeft,expected:Math.max(0,Math.min(s.scrollWidth-v.clientWidth,s.scrollWidth*(zone[0]+zone[2]/2)-v.clientWidth/2))};});
 assert.ok(Math.abs(tailFocus.actual-tailFocus.expected)<2,'tail inspection must reach the active candidate region, including lower-left grid cells');
 assert.ok(await page.evaluate(()=>{const c=turnaroundReview.manifest.candidates.find(c=>c.file===turnaroundReview.current),r=document.getElementById('turnaround').getBoundingClientRect(),z=c.primaryTailReviewBox??c.rearTailReviewBox,center=r.top+r.height*(z[1]+z[3]/2);return center>0&&center<innerHeight;}),'tail inspection must scroll to the lower row vertically');
 const widths=await page.evaluate(()=>['turnaround','view-labels'].map(id=>document.getElementById(id).getBoundingClientRect().width));
 assert.ok(Math.abs(widths[0]-widths[1])<1,'labels must stay aligned with zoomed source sheet');
 await page.screenshot({path:join(output,'tail-review.png')});
 check('rapid switching, 200 percent tail inspection and zoomed labels remain consistent');
 const active=manifest.candidates.find(c=>c.file===manifest.reviewCandidate);
 if(active.backTailReviewBox){
  await page.locator('#focus-back-tail').click();
  assert.equal(Number(await page.locator('#annotations rect').getAttribute('x')),active.backTailReviewBox[0]*1000);
  assert.ok(await page.evaluate(()=>{const c=turnaroundReview.manifest.candidates.find(c=>c.file===turnaroundReview.current),r=document.getElementById('turnaround').getBoundingClientRect(),z=c.backTailReviewBox,x=r.left+r.width*(z[0]+z[2]/2),y=r.top+r.height*(z[1]+z[3]/2);return x>0&&x<innerWidth&&y>0&&y<innerHeight;}),'straight-back attachment must be visible after focus');
  await page.screenshot({path:join(output,'back-tail-review.png')});
  check('rear-quarter and straight-back attachment regions have independent reachable review targets');
 }
 await page.locator('.reference img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 for(const href of await page.locator('a').evaluateAll(links=>links.map(link=>link.href)))assert.equal((await page.request.get(href)).status(),200,href);
 assert.deepEqual(errors,[]);
 check('new user references and authoring links load without browser errors');
 await page.goto(`http://127.0.0.1:${server.address().port}/${base}/tail-geometry.html`);
 await page.waitForFunction(()=>window.tailGeometry);
 assert.equal(await page.evaluate(()=>tailGeometry.metrics.length),4);assert.deepEqual(errors,[]);
 const roots=await page.evaluate(()=>{
  const {spec}=tailGeometry,canvas=document.getElementById('geometry'),gl=canvas.getContext('webgl'),[x,y,z]=spec.peduncle[1].center,e=spec.projection.elevationDegrees*Math.PI/180,columns=spec.layout?.columns??4,panelWidth=canvas.width/columns;
  return spec.views.map((view,i)=>{const a=view.yaw*Math.PI/180,u=x*Math.cos(a)+z*Math.sin(a),d=-x*Math.sin(a)+z*Math.cos(a),v=-y*Math.cos(e)+d*Math.sin(e),pixel=new Uint8Array(4),cx=(i%columns+.5)*panelWidth+(view.offsetX??0)*265,baseline=(Math.floor(i/columns)+1)*420-30;gl.readPixels(Math.round(cx+u*265),canvas.height-1-Math.round(baseline+v*265),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];});
 });
 for(const pixel of roots)assert.deepEqual(pixel,[228,232,237,255],'actual skirt pixels must occlude the proximal root in each view');
 check('historical construction page renders all four views and actually occludes their proximal roots');
 const sourceHashes={};for(const file of [base+'/index.html',base+'/review.js',base+'/source/manifest.json',base+'/tail-geometry.html',base+'/tail-geometry.js',base+'/source/'+historicalConstruction.geometry,'tests/turnaround-art-ui.mjs'])sourceHashes[file]=await digest(join(root,file));
 await writeFile(join(output,'verification.json'),JSON.stringify({time:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),host:{platform:platform(),release:release()},browser:browser.version(),sourceHashes,checks,reviewCandidate:manifest.reviewCandidate,limitations:['static authoring UI and provenance only','no automatic anatomy or character identity approval','no product export or native platform validation']},null,2)+'\n');
 console.log(`Static turnaround review: ${checks.length} check groups passed.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
