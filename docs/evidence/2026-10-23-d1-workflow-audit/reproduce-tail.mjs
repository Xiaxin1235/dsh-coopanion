// Diagnostic only. Exit 1 means the currently rendered tail is still hidden by the skirt.
import {chromium} from '../../../scripts/lib/playwright.mjs';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const output=resolve(process.argv[2]??'artifacts/runs/d1-tail-'+Date.now());
await mkdir(output,{recursive:false});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4189/docs/design/art-workflow/d1-directions-v1/index.html');
 await page.waitForFunction(()=>window.directionPreview?.state.frames>0);
 const result=await page.evaluate(async()=>{
  const {createRig}=await import('/web/upstream/kit/rig.js');directionPreview.pose({t:0});
  const def=directionPreview.model.directions.backRight,b=def.headBow;
  const cv=document.createElement('canvas');cv.width=cv.height=840;
  const rig=createRig(cv,{view:directionPreview.model.view,parts:[...def.parts,{id:'headBow',tex:'headBow',box:b.box,parent:'headBow',z:b.z,grid:[3,3]}],deformers:{...def.deformers,headBow:{kind:'rot',pivot:b.pivot,parent:b.parent}}});
  const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
  rig.upload('atlas',await load('./'+def.atlas));rig.upload('headBow',await load('/web/upstream/whale/tex/bow.png'));
  const states=directionPreview.samples.backRight.state.states;
  const ref=directionPreview.registration.references.backRight,scale=directionPreview.registration.scale;
  // This area is visibly blue tail in the supplied design, away from the removed cheek/hook.
  const landmark=[400,1150],pixel=[128+(landmark[0]-ref.feet[0])*scale,256+(landmark[1]-ref.feet[1])*scale].map((v,i)=>Math.round((v+(i?8:12))*3));
  const sample=canvas=>{const c=document.createElement('canvas');c.width=c.height=840;const g=c.getContext('2d');g.drawImage(canvas,0,0);return [...g.getImageData(...pixel,1,1).data];};
  const frames={},colors={};
  for(const [name,st]of Object.entries({current:states,tailInFront:{...states,z:{tail:8}},noAnimation:{}})){rig.render(st);frames[name]=cv.toDataURL();colors[name]=sample(cv);}
  frames.reference=directionPreview.references.backRight.toDataURL();colors.reference=sample(directionPreview.references.backRight);
  for(const id of ['front','back'])frames[id]=document.getElementById(id).toDataURL();
  rig.dispose();return {frames,colors,landmark,pixel};
 });
 for(const [name,data]of Object.entries(result.frames))await writeFile(join(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
 delete result.frames;
 const files=['web/upstream/kit/rig.js','docs/design/art-workflow/d1-directions-v1/figure.js','docs/design/art-workflow/d1-directions-v1/model.json','docs/design/art-workflow/d1-directions-v1/source/back-right-faithful-v6.png','docs/design/art-workflow/d1-directions-v1/source/design-back-right-20261023.png'];
 result.source=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
 result.head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();result.browser=browser.version();result.time=new Date().toISOString();result.kind='diagnosis, not acceptance';
 const blue=([r,g,b,a])=>a>200&&b>150&&b>r*1.7&&b>g*1.2;
 result.verdict={reference:blue(result.colors.reference),current:blue(result.colors.current),noAnimation:blue(result.colors.noAnimation),onlyLayerChanged:blue(result.colors.tailInFront)};
 await writeFile(join(output,'diagnosis.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,colors:result.colors,verdict:result.verdict}));
 assert.ok(result.verdict.reference,'the independent reference must contain tail here');
 assert.ok(result.verdict.onlyLayerChanged,'the single-variable draw-order probe must restore visible tail here');
 assert.ok(result.verdict.current,'rear-quarter tail stem is hidden by the skirt at design landmark (400,1150)');
}finally{await browser.close();}
