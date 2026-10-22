import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';
import { chromium, artifactRoot } from '../scripts/lib/playwright.mjs';import {previewServer} from '../scripts/preview.mjs';
let browser;const output=process.env.LIVING_EVIDENCE_DIR??`${artifactRoot}/living-integration`;
before(async()=>{await mkdir(output,{recursive:true});browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});});after(async()=>{await browser?.close();});
const idle={mood:'idle',active:false,sessionId:null,sessions:[],results:[]};
const fact=(revision,extra={})=>({sessionId:'live-work',epoch:1,revision,driver:'running',running:true,activity:'tools',category:'working',requests:[],needsAttention:false,tools:{pending:1,entered:1},resultId:null,cue:null,...extra});
async function fixture(t,options={}){const directory=await mkdtemp(join(tmpdir(),'dsh-live-ui-')),server=previewServer({dataDir:directory});server.listen(0,'127.0.0.1');await once(server,'listening');const page=await browser.newPage({viewport:{width:1100,height:800}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await writeFile(join(output,t.name.replace(/[^a-z0-9]/gi,'-').slice(0,70)+'.json'),JSON.stringify(await page.evaluate(()=>({pet:{...document.querySelector('#pet').dataset},events:window.lifeEvents?.slice(-30)})),null,2));await page.close();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});assert.deepEqual(errors,[]);});
 await page.addInitScript(()=>{window.actions=[];window.lifeEvents=[];window.lifeInput='idle';window.dshPetBridge={subscribe(fn){window.receive=fn;},action(a){window.actions.push(a);},hit(){}};const feed=()=>{window.receive?.({type:'keyboard-activity',value:window.lifeInput});requestAnimationFrame(feed);};requestAnimationFrame(feed);addEventListener('message',e=>{if(e.data?.t==='frame'){window.lifeFrame=e.data.layout?.living;}if(e.data?.t==='frame')for(const v of e.data.events??[]){if(v.kind==='motion-action'){window.lifeEvents.push(v.detail);window.lifeEvents=window.lifeEvents.slice(-400);}}});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('#pet[data-mode]');const receive=msg=>page.evaluate(msg=>window.receive(msg),msg);await receive({type:'init',baseline:true,options:{companionship:'quiet',roam:true,npcPersonality:'lively',livingSpace:true,locale:'zh',...options},snapshot:idle});await page.mouse.move(0,0);const read=()=>page.evaluate(async()=>{const r=await fetch('./api/companionship',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'read',characterId:'whale'})});return(await r.json()).value;});return{page,receive,read,configure:options=>receive({type:'configure',options})};}
async function menu(page){await page.locator('#pet').dispatchEvent('contextmenu',{button:2});await page.locator('#menu').waitFor();}
const drop=async(page,count)=>page.waitForFunction(count=>Number(document.querySelector('#pet').dataset.lifeDrop)>=count,count,{timeout:90000});

test('default product independently observes, navigates and arranges once with real contact, without storing fictional shared memories',async t=>{const{page,read}=await fixture(t);await page.waitForSelector('#pet[data-life-action=reach]',{timeout:60000});const contactBody=await page.locator('#pet').boundingBox();await page.mouse.move(contactBody.x+contactBody.width/2+200,contactBody.y+contactBody.height/2);await page.waitForSelector('#pet[data-life-action=lift]',{timeout:10000});await page.mouse.move(0,0);await drop(page,1);await page.waitForFunction(()=>document.querySelector('#pet').dataset.lifeGoal!=='arrange',null,{timeout:15000});const before=await page.locator('#pet').getAttribute('data-life-pickup');const events=await page.evaluate(()=>window.lifeEvents);assert.ok(events.some(e=>e.type==='pickup'&&e.contact.distance<=1.5));assert.ok(events.some(e=>e.type==='drop'&&e.contact.groundDistance<=1.5));assert.equal((await read()).memory.entries.length,0);assert.equal((await read()).relation.total,0);await page.waitForTimeout(7000);assert.equal(await page.locator('#pet').getAttribute('data-life-pickup'),before);await page.screenshot({path:join(output,'autonomous-arranged.png')});assert.deepEqual(await page.evaluate(()=>window.actions.filter(a=>a.type!=='presentation')),[]);});

test('carried shell yields through real parking, retains an unresolved question, and resumes the original goal after work',async t=>{const{page,receive,read}=await fixture(t);await page.waitForSelector('#pet[data-life-action=carry]',{timeout:60000});await receive({type:'snapshot',snapshot:{...idle,mood:'working',active:true,workFacts:[fact(1)]}});await page.waitForSelector('#pet[data-life-phase=work-wait]',{timeout:30000});assert.equal(await page.locator('#pet').getAttribute('data-life-goal'),'arrange');assert.equal(await page.locator('#pet').getAttribute('data-life-drop'),'1');await page.screenshot({path:join(output,'work-parked.png')});await receive({type:'snapshot',snapshot:{...idle,workFacts:[fact(2,{driver:'idle',running:false,category:'reply',requests:[{id:'q',kind:'question',state:'continued'}]})]}});await page.waitForTimeout(1000);assert.equal(await page.locator('#pet').getAttribute('data-life-phase'),'work-wait');await receive({type:'snapshot',snapshot:{...idle,workFacts:[fact(3,{driver:'idle',running:false,category:'reply',activity:'idle'})]}});await drop(page,2);assert.equal(await page.locator('#pet').getAttribute('data-life-pickup'),'2');assert.equal((await read()).memory.entries.length,0);await page.screenshot({path:join(output,'work-resumed.png')});});

test('manual shared activity safely preempts a carried prop, requires a response and preserves its original arrangement',async t=>{const{page,read}=await fixture(t);await page.waitForSelector('#pet[data-life-action=carry]',{timeout:60000});await menu(page);await page.locator('#companion-play').click();await page.mouse.move(0,0);await page.locator('#companion-turn').waitFor();assert.equal((await read()).memory.entries.length,0);await page.locator('#companion-respond').focus();await page.keyboard.press('Enter');await page.mouse.move(0,0);await page.waitForFunction(()=>document.querySelector('#companion-feedback').textContent.includes('记住'),null,{timeout:15000});assert.equal((await read()).memory.entries.filter(e=>e.kind==='play').length,1);await drop(page,2);assert.equal((await read()).relation.total,1);});

test('current input, hot scene/personality changes, captured reading and a small viewport preserve the same body and draft',async t=>{const{page,receive,configure}=await fixture(t);await page.evaluate(()=>{window.lifeInput='active';window.originalFrame=document.querySelector('#body-layer iframe');});const session={id:'live-chat',label:'Live chat',mood:'idle',active:false,chatAvailable:true};const result={id:'live-reader',sessionId:session.id,time:1,read:false,text:'## Captured\n\n'+'Keep this content.\n\n'.repeat(80)};await receive({type:'snapshot',snapshot:{...idle,sessionId:session.id,sessions:[{...session,replyId:result.id,reply:result.text}],results:[result]}});await receive({type:'ui-control',command:'chat'});await page.locator('#message').fill('a retained draft');await page.locator('#message').evaluate(n=>n.setSelectionRange(2,6));for(const p of[{livingSpace:false},{npcPersonality:'quiet'},{livingSpace:true},{companionship:'interactive'},{companionship:'quiet'}])await configure(p);assert.deepEqual(await page.locator('#message').evaluate(n=>[n.value,n===document.activeElement,n.selectionStart,n.selectionEnd]),['a retained draft',true,2,6]);await page.locator('#chat-read').click();await page.locator('#reader-text').evaluate(n=>{n.scrollTop=120;window.liveReader=n.firstChild;});await configure({livingSpace:false});await configure({livingSpace:true});assert.equal(await page.locator('#reader-text').evaluate(n=>n.firstChild===window.liveReader&&n.scrollTop===120),true);assert.equal(await page.evaluate(()=>window.originalFrame===document.querySelector('#body-layer iframe')),true);await page.setViewportSize({width:320,height:640});await configure({locale:'en',textScale:1.5});await page.keyboard.press('Escape');await menu(page);await page.locator('#living-space-mode').selectOption('on');await page.waitForFunction(()=>document.querySelector('#living-space').hidden);await page.screenshot({path:join(output,'small-menu-en.png')});});

for(const size of [90,240])test(`real contact remains proportional at ${size}px and viewport contraction keeps the body visible`,async t=>{
 const{page}=await fixture(t,{size});await drop(page,1);
 await page.setViewportSize({width:700,height:600});
 await page.waitForTimeout(700);
 const box=await page.locator('#pet').boundingBox();
 assert.ok(box.width>20&&box.height>20&&box.x+box.width>0&&box.y+box.height>0&&box.x<700&&box.y<600);
});
test('dragging and switching the living scene off while carrying preserve the body and safely park before simple wandering',async t=>{
 const{page,configure}=await fixture(t);await page.waitForSelector('#pet[data-life-action=carry]',{timeout:60000});
 const box=await page.locator('#pet').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2-30,box.y+box.height/2-35,{steps:8});await page.mouse.up();await page.mouse.move(0,0);
 await page.waitForFunction(()=>!['drag','air'].includes(document.querySelector('#pet').dataset.mode));
 await configure({livingSpace:false});
 await page.waitForFunction(()=>window.lifeFrame?.owner==='ground'&&window.lifeFrame?.action==='idle',null,{timeout:25000});
 assert.equal(await page.locator('#living-space').isHidden(),true);
 await configure({livingSpace:true});await drop(page,2);
 assert.equal(await page.locator('#pet').getAttribute('data-life-pickup'),'2');
});

test('desktop life forms an observed outward-return-rest cycle without permanent furniture or fictional memories',async t=>{
 const{page,read}=await fixture(t);
 assert.equal(await page.locator('#living-space img').count(),0);
 await page.waitForFunction(()=>Number(document.querySelector('#pet').dataset.lifeCycles)>=1,null,{timeout:140000});
 assert.equal(await page.locator('#pet').getAttribute('data-life-routine'),'rest');
 assert.equal(await page.locator('#pet').getAttribute('data-life-pickup'),'1');
 assert.equal(await page.locator('#pet').getAttribute('data-life-drop'),'1');
 await page.screenshot({path:join(output,'desktop-rest-after-return.png')});
 await page.waitForFunction(()=>document.querySelector('#pet').dataset.lifeRoutine==='outbound',null,{timeout:45000});
 assert.equal((await read()).memory.entries.length,0);
 assert.equal((await read()).relation.total,0);
});

test('typing and mouse proximity produce one safe wait and a retained goal, without empty grabbing on recovery',async t=>{
 const{page,read}=await fixture(t);await drop(page,1);
 await page.waitForFunction(()=>document.querySelector('#pet').dataset.lifeAction==='idle');
 await page.evaluate(()=>{window.lifeEvents=[];window.lifeInput='active';});
 await page.waitForSelector('#pet[data-life-phase=environment-wait]');
 for(let i=0;i<3;i++){await page.evaluate(()=>{window.lifeInput='idle';});await page.waitForTimeout(100);await page.evaluate(()=>{window.lifeInput='active';});await page.waitForTimeout(100);}
 await page.evaluate(()=>{window.lifeInput='idle';});
 await page.waitForTimeout(1000);
 assert.equal(await page.locator('#pet').getAttribute('data-life-environment'),'typing');
 const box=await page.locator('#pet').boundingBox();await page.mouse.move(box.x+box.width+25,box.y+box.height/2);
 await page.waitForSelector('#pet[data-life-environment=pointer]',{timeout:12000});
 assert.equal(await page.locator('#pet').getAttribute('data-life-phase'),'environment-wait');
 await page.mouse.move(0,0);
 await page.waitForFunction(()=>!document.querySelector('#pet').dataset.lifeEnvironment,null,{timeout:10000});
 const events=await page.evaluate(()=>window.lifeEvents);
 assert.equal(events.filter(e=>e.type==='phase'&&['reach','grasp','retract'].includes(e.phase)).length,0);
 assert.equal(await page.locator('#pet').getAttribute('data-life-pickup'),'1');
 assert.equal((await read()).memory.entries.length,0);
});
