import {chromium} from '../../../scripts/lib/playwright.mjs';
import {previewServer} from '../../../scripts/preview.mjs';
import {once} from 'node:events';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'dsh-front-review-')),server=previewServer({dataDir:profile});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1100,height:800}});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('#pet[data-mode]');
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

const png=await page.evaluate(()=>{directionActor.set({expression:'neutral'});advance(20);return document.querySelector('#direction-product canvas').toDataURL();});await writeFile(new URL('./production-neutral.png',import.meta.url),Buffer.from(png.split(',')[1],'base64'));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
