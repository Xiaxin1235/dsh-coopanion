import assert from 'node:assert/strict';
import {chromium} from '../scripts/lib/playwright.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.SPACE_EVIDENCE_DIR??'artifacts/space-routing-feedback/browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1180},recordVideo:{dir:output,size:{width:1440,height:1180}}}),page=await context.newPage();let video;
const started=Date.now();
const snapshot=()=>page.evaluate(()=>window.spacePreview.snapshot());
const edit=async(id,x,y)=>{await page.selectOption('#object-select',id);await page.fill('#edit-x',String(x));await page.fill('#edit-y',String(y));await page.click('#apply-placement');await page.waitForFunction(()=>!document.querySelector('#apply-placement').disabled);};
try{
 await page.goto('http://127.0.0.1:4189/');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await edit('actor',186,542);await edit('gate-north',621,75);await edit('planter',570,515);
 const before=await snapshot();await page.screenshot({path:resolve(output,'reported-layout.png'),fullPage:true});
 assert.equal(before.route.passed,true,'screenshot layout must route around the flowerbox via the open ground above it');
 assert.equal(before.route.alternative,true,'the direct ground route is blocked');
 await page.click('#nav-work');await page.waitForFunction(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived'&&e.id===s.navigation.id);},null,{timeout:30000});
 const final=await snapshot();assert.equal(final.frame.bodyX,850);assert.equal(final.frame.bodyY,600);assert.equal(final.events.filter(e=>e.kind==='navigation-arrived'&&e.id===final.navigation.id).length,1);
 await page.screenshot({path:resolve(output,'actual-arrival.png'),fullPage:true});
 const r=await page.locator('#world').boundingBox();await page.mouse.click(r.x+186*r.width/1080,r.y+542*r.height/660);
 await page.waitForFunction(()=>{const s=window.spacePreview.snapshot();return s.events.some(e=>e.kind==='navigation-arrived'&&e.id===s.navigation.id);},null,{timeout:30000});
 const returned=await snapshot();assert.ok(Math.abs(returned.frame.bodyX-186)<1&&Math.abs(returned.frame.bodyY-542)<1);
 const preset=await context.newPage();await preset.goto('http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?layout=flowerbox-570-515');await preset.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 const presetState=await preset.evaluate(()=>window.spacePreview.snapshot());assert.deepEqual(presetState.layout.actor,{x:186,y:542});assert.equal(presetState.layout.objects.find(o=>o.id==='planter').y,515);assert.equal(presetState.route.alternative,true);await preset.close();
 while(Date.now()-started<30000)await page.waitForTimeout(200);
 await writeFile(resolve(output,'feedback.json'),JSON.stringify({passed:true,browser:browser.version(),before,final,returned,presetRoute:presetState.route},null,2)+'\n');video=page.video();console.log('reported flowerbox detour: real pointer setup, actual swept movement and one arrival passed');
}catch(error){await writeFile(resolve(output,'failure.json'),JSON.stringify({error:error.stack,snapshot:await snapshot().catch(()=>null)},null,2)+'\n');throw error;}finally{await context.close();if(video)await video.saveAs(resolve(output,'flowerbox-detour.webm'));await browser.close();}
