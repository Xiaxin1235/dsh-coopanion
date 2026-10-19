// Page-only real-time recording. All actions use visible controls and pointer
// coordinates; snapshots inspect the same body, never replace its movement.
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/stage-2-showcase');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1180},recordVideo:{dir:output,size:{width:1440,height:1180}}}),page=await context.newPage();const start=Date.now();let video;
try{
 await page.goto('http://127.0.0.1:4189/');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 const edit=async(x,y)=>{await page.selectOption('#object-select','planter');await page.fill('#edit-x',String(x));await page.fill('#edit-y',String(y));await page.click('#apply-placement');};
 const arrived=()=>page.waitForFunction(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived'&&e.id===s.navigation.id);},null,{timeout:30000});
 const point=async(x,y)=>{const r=await page.locator('#world').boundingBox();await page.mouse.click(r.x+x*r.width/1080,r.y+y*r.height/660);};
 await edit(508,261);await page.waitForTimeout(1600);await edit(485,280);await page.click('#nav-work');await arrived();
 await point(240,555);await page.waitForFunction(()=>window.spacePreview.snapshot().frame.bodyX<700);await edit(508,261);await arrived();
 await page.click('#nav-work');await page.waitForFunction(()=>window.spacePreview.snapshot().frame.bodyX>400);await page.click('#nav-pause');await page.waitForTimeout(1600);await page.click('#nav-resume');await arrived();
 await page.screenshot({path:resolve(output,'showcase-final.png'),fullPage:true});
 while(Date.now()-start<42000)await page.waitForTimeout(250);
 await writeFile(resolve(output,'showcase.json'),JSON.stringify({browser:browser.version(),seconds:(Date.now()-start)/1000,actions:['reported flowerbox','actual detour','mid-motion obstacle revision','long pause and first resume'],snapshot:await page.evaluate(()=>window.spacePreview.snapshot())},null,2)+'\n');video=page.video();
}finally{await context.close();if(video)await video.saveAs(resolve(output,'navigation-showcase.webm'));await browser.close();}
