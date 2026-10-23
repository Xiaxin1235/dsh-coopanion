import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,join,relative,resolve} from 'node:path';
import {platform,release} from 'node:os';
import {chromium} from '../scripts/lib/playwright.mjs';

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
for(const ref of manifest.referencePriority)assert.equal(await digest(join(source,ref.file)),ref.sha256,ref.file);
check('all original candidates, exact prompts and reference bytes match provenance hashes');

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
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1120}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/${base}/index.html`);
 await page.waitForFunction(()=>window.turnaroundReview?.current);
 assert.equal(await page.evaluate(()=>turnaroundReview.current),manifest.reviewCandidate);
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
  assert.equal(Number(await page.locator('#annotations rect').getAttribute('x')),candidate.rearTailReviewBox[0]*1000);
  assert.equal(await page.locator('#candidate-notes').textContent(),candidate.review);
 }
 check('every candidate decodes with its own view labels, proportion guides and review notes');
 // Rapid selection must leave the final candidate and its annotations together.
 await page.evaluate(files=>{const selector=document.getElementById('candidate');for(const file of files){selector.value=file;selector.dispatchEvent(new Event('change'));}},[manifest.candidates[0].file,manifest.reviewCandidate]);
 await page.waitForFunction(file=>turnaroundReview.current===file,manifest.reviewCandidate);
 await page.locator('#guides').uncheck();await page.locator('#structure').uncheck();
 await page.screenshot({path:join(output,'overview.png'),fullPage:true});
 await page.locator('#focus-tail').click();
 assert.equal(await page.locator('#zoom').inputValue(),'2');
 assert.equal(await page.locator('#annotations rect').count(),1);
 assert.ok(await page.locator('#viewport').evaluate(element=>element.scrollLeft)>0);
 const widths=await page.evaluate(()=>['turnaround','view-labels'].map(id=>document.getElementById(id).getBoundingClientRect().width));
 assert.ok(Math.abs(widths[0]-widths[1])<1,'labels must stay aligned with zoomed source sheet');
 await page.screenshot({path:join(output,'tail-review.png')});
 check('rapid switching, 200 percent tail inspection and zoomed labels remain consistent');
 await page.locator('.reference img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 for(const href of await page.locator('a').evaluateAll(links=>links.map(link=>link.href)))assert.equal((await page.request.get(href)).status(),200,href);
 assert.deepEqual(errors,[]);
 check('new user references and authoring links load without browser errors');
 const sourceHashes={};for(const file of [base+'/index.html',base+'/review.js',base+'/source/manifest.json','tests/turnaround-art-ui.mjs'])sourceHashes[file]=await digest(join(root,file));
 await writeFile(join(output,'verification.json'),JSON.stringify({time:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),host:{platform:platform(),release:release()},browser:browser.version(),sourceHashes,checks,reviewCandidate:manifest.reviewCandidate,limitations:['static authoring UI and provenance only','no automatic anatomy or character identity approval','no product export or native platform validation']},null,2)+'\n');
 console.log(`Static turnaround review: ${checks.length} check groups passed.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
