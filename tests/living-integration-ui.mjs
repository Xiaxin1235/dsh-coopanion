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
 await page.addInitScript(()=>{window.actions=[];window.lifeEvents=[];window.lifeInput='idle';window.dshPetBridge={subscribe(fn){window.receive=fn;},action(a){window.actions.push(a);},hit(){}};const feed=()=>{window.receive?.({type:'keyboard-activity',value:window.lifeInput});requestAnimationFrame(feed);};requestAnimationFrame(feed);addEventListener('message',e=>{if(e.data?.t==='frame'){window.lifeFrame=e.data.layout?.living;window.lifeLayout=e.data.layout;}if(e.data?.t==='frame')for(const v of e.data.events??[]){if(v.kind==='motion-action'){window.lifeEvents.push(v.detail);window.lifeEvents=window.lifeEvents.slice(-400);}}});});
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
 await drop(page,1);
 const b=await page.locator('#pet').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(350,240,{steps:12});await page.waitForSelector('#pet[data-mode=drag]');await page.mouse.up();await page.mouse.move(0,0);await page.waitForFunction(()=>lifeLayout.mode==='idle');
 const dock=await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y}));
 await page.evaluate(()=>{window.planeTravel={min:Infinity,max:-Infinity,directions:[]};addEventListener('message',e=>{const l=e.data?.t==='frame'&&e.data.layout;if(l?.navigation?.speed>0){planeTravel.min=Math.min(planeTravel.min,l.y);planeTravel.max=Math.max(planeTravel.max,l.y);if(l.direction&&!l.direction.legacy&&!planeTravel.directions.includes(l.direction.current))planeTravel.directions.push(l.direction.current);}});});
 await page.waitForFunction(()=>Number(document.querySelector('#pet').dataset.lifeCycles)>=1,null,{timeout:140000});
 assert.equal(await page.locator('#pet').getAttribute('data-life-routine'),'rest');
 const returned=await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y,travel:planeTravel.max-planeTravel.min,directions:planeTravel.directions}));
 assert.ok(Math.hypot(returned.x-dock.x,returned.y-dock.y)<2);assert.ok(returned.travel>100);assert.ok(returned.directions.some(d=>d.startsWith('back')));assert.ok(returned.directions.some(d=>d.startsWith('front')));
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

for(const size of [90,180,240])test(`planar placement at ${size}px keeps support, shadow, resize and cancelled drag local`,async t=>{
 const{page}=await fixture(t,{size,roam:false});
 await page.waitForFunction(()=>!['air','drag'].includes(document.querySelector('#pet').dataset.mode));
 const frame=page.frames().find(f=>f.url().includes('figure-frame.html'));
 await frame.evaluate(()=>{window.worlds=[];addEventListener('message',e=>{if(e.data?.state?.motionCommand?.type==='world')window.worlds.push(e.data.state.motionCommand);});});
 await page.waitForTimeout(300); // let the configured size reach the isolated body frame
 const move=async(x,y,cancel=false)=>{const p=await page.evaluate(()=>lifeLayout.hit.find(p=>p.x>lifeLayout.box.x&&p.y>lifeLayout.box.y&&p.x<lifeLayout.box.x+lifeLayout.box.w&&p.y<lifeLayout.box.y+lifeLayout.box.h));await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(x,y,{steps:12});await page.waitForSelector('#pet[data-mode=drag]');if(cancel)await page.locator('#pet').dispatchEvent('pointercancel',{pointerId:1,clientX:0,clientY:0});await page.mouse.up();await page.mouse.move(0,0);await page.waitForFunction(()=>window.lifeLayout?.mode==='idle');};
 await move(350,220);const placed=await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y}));
 assert.ok(placed.y<500);await page.waitForTimeout(900);
 assert.deepEqual(await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y})),placed);
 await page.screenshot({path:join(output,`plane-middle-${size}.png`)});
 const shadow=await frame.locator('.shadow').evaluate(n=>({x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),opacity:+n.getAttribute('opacity')}));
 assert.ok(Math.abs(shadow.x-placed.x)<1&&Math.abs(shadow.y-(placed.y-2))<1&&shadow.opacity===1);
 await page.evaluate(()=>document.querySelector('#body-layer iframe').contentWindow.postMessage({t:'do',word:'jump'},'*'));
 await page.waitForSelector('#pet[data-mode=air]');await page.waitForFunction(y=>window.lifeLayout.y<y-10,placed.y);
 await page.waitForFunction(()=>window.lifeLayout?.mode==='idle');assert.equal(await page.evaluate(()=>lifeLayout.y),placed.y);
 await page.evaluate(()=>document.querySelector('#body-layer iframe').contentWindow.postMessage({t:'do',word:'jump'},'*'));await page.waitForSelector('#pet[data-mode=air]');
 await page.setViewportSize({width:1000,height:700});await page.waitForFunction(()=>lifeLayout.mode==='idle');await page.waitForTimeout(200);
 assert.ok(Math.abs(await page.evaluate(()=>lifeLayout.y)-placed.y*700/800)<1);
 const world=await frame.evaluate(()=>worlds.at(-1));assert.ok(Math.abs(world.workTarget.y-placed.y*700/800)<1);
 await move(5,5,true);await page.waitForTimeout(500);
 const b=await page.locator('#pet').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1000&&b.y+b.height<=700);
 const final=await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y}));await page.mouse.move(900,600);await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>({x:lifeLayout.x,y:lifeLayout.y})),final);
 await page.screenshot({path:join(output,`plane-${size}.png`)});
});

test('planar placement survives both viewport and display-event orders without returning to the floor',async t=>{
 const{page,receive}=await fixture(t,{roam:false});await page.waitForTimeout(300);
 const geometry=(displayId,width,height,revision)=>({type:'display-changed',displayId,revision,scaleFactor:2,contentBounds:{x:0,y:0,width,height},workArea:{x:0,y:0,width,height}});
 await receive(geometry(1,1100,800,1));
 const b=await page.locator('#pet').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(400,250,{steps:12});await page.waitForSelector('#pet[data-mode=drag]');await page.mouse.up();await page.mouse.move(0,0);await page.waitForFunction(()=>lifeLayout.mode==='idle');
 const initial=await page.evaluate(()=>({x:lifeLayout.x/innerWidth,y:lifeLayout.y/innerHeight}));
 await receive(geometry(2,1000,700,2));await page.setViewportSize({width:1000,height:700});await page.waitForTimeout(400);
 let current=await page.evaluate(()=>({x:lifeLayout.x/innerWidth,y:lifeLayout.y/innerHeight}));assert.ok(Math.hypot(current.x-initial.x,current.y-initial.y)<.002);
 await page.setViewportSize({width:1200,height:900});await page.waitForTimeout(150);await receive(geometry(3,1200,900,3));await page.waitForTimeout(400);
 current=await page.evaluate(()=>({x:lifeLayout.x/innerWidth,y:lifeLayout.y/innerHeight}));assert.ok(Math.hypot(current.x-initial.x,current.y-initial.y)<.002);
});
