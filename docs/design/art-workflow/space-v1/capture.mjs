// Record real UI inputs and real body receipts. No prerecorded motion or editing.
import { chromium } from '../../../../node_modules/playwright-core/index.mjs';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/space-showcase');
await mkdir(output); // A new directory is required; never overwrite evidence.
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:output,size:{width:1440,height:1080}}});
const page=await context.newPage(),trace=[],errors=[];let sampling=false;
page.on('pageerror',e=>errors.push(e.message));
const started=Date.now();
const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{const f=JSON.parse(await page.locator('#world').getAttribute('data-frame'));if(f&&f.phase!==trace.at(-1)?.phase)trace.push({...f,wallOffsetMs:Date.now()-started});}catch{}finally{sampling=false;}},100);
const wait=predicate=>page.waitForFunction(predicate,undefined,{timeout:60000});
let video;
try {
  await page.goto(process.env.SPACE_PREVIEW_URL??'http://127.0.0.1:4189/');await wait(()=>document.documentElement.dataset.ready==='true');
  await page.waitForTimeout(2500);await page.click('#block-route');await page.waitForTimeout(1500);await page.click('#restore-route');
  await page.check('#show-anchors');await page.selectOption('#speed','0.5');await page.click('#loop');
  await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='grasp'&&f.elapsed>.08;});await page.click('#pause');await page.waitForTimeout(1000);await page.click('#resume');
  await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='idle'&&f.commits.drop===1;});
  await page.selectOption('#object-select','destination');await page.fill('#edit-x','260');await page.click('#apply-placement');await page.click('#loop');
  await wait(()=>{const f=JSON.parse(document.querySelector('#world').dataset.frame);return f.phase==='idle'&&f.commits.drop===2;});
  if(Date.now()-started<35000)await page.waitForTimeout(35000-(Date.now()-started));
  const final=await page.evaluate(()=>window.spacePreview.snapshot());
  if(errors.length||final.frame.commits.pickup!==2||!final.route.passed)throw Error('Showcase did not finish actual loops');
  await page.screenshot({path:resolve(output,'showcase-complete.jpg'),fullPage:true});
  video=page.video();clearInterval(timer);await page.close();await context.close();
  await video.saveAs(resolve(output,'space-showcase.webm'));
  const sha=b=>createHash('sha256').update(b).digest('hex');
  const result={schema:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),captureSourceSha256:sha(await readFile(new URL('./capture.mjs',import.meta.url))),browser:browser.version(),speed:.5,realTime:true,edited:false,wallDurationMs:Date.now()-started,trace,final,video:{file:'space-showcase.webm',sha256:sha(await readFile(resolve(output,'space-showcase.webm')))},errors};
  await writeFile(resolve(output,'showcase-record.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,wallDurationMs:result.wallDurationMs,commits:final.frame.commits,output}));
} catch(error) {
  await page.screenshot({path:resolve(output,'failure.jpg'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(output,'failure.json'),JSON.stringify({error:error.stack,trace,errors,frame:await page.locator('#world').getAttribute('data-frame').catch(()=>null)},null,2));
  throw error;
} finally {clearInterval(timer);await context.close();await browser.close();}
