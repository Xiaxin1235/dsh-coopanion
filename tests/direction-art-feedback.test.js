import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRgbaPng} from '../scripts/lib/rgba-png.mjs';
import model from '../web/upstream/whale/directions/model.js';
const source='docs/design/art-workflow/d1-directions-v1/source/';
const old=readRgbaPng(readFileSync(source+'back-head-no-bow-v1.png'));
const part=name=>model.directions.backRight.parts.find(p=>p.id===name);
const selected=name=>readRgbaPng(readFileSync('web/upstream/whale/directions/'+part(name).atlas));
function count(p,[x,y,w,h],match){let n=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const k=(j*p.width+i)*4;if(match(...p.pixels.subarray(k,k+4)))n++;}return n;}
it('rear-quarter head covers the cheek; the rejected source demonstrably fails this check',()=>{
 const skin=(r,g,b,a)=>a>200&&r>180&&g>100&&r>g*1.06&&g>b*1.02;
 expect(count(old,[0,0,475,560],skin)).toBeGreaterThan(500);
 expect(count(selected('head'),[0,0,475,560],skin)).toBe(0);
});
it('rear-quarter tail has no dangling root hook; the rejected source fails',()=>{
 const opaque=(r,g,b,a)=>a>200;
 expect(count(old,[380,1200,140,54],opaque)).toBeGreaterThan(1000);
 expect(count(selected('tail'),[380,1200,140,54],opaque)).toBe(0);
 // Tightening the crop must not stretch the corrected tail back to the old height.
 const regions=JSON.parse(readFileSync(source+'atlas-regions.json'));
 const p=part('tail'),png=selected('tail'),cropHeight=(p.uvBox[3]-p.uvBox[1])*png.height;
 const registration=JSON.parse(readFileSync(source+'design-registration-v1.json'));
 expect(p.box[3]/cropHeight).toBeCloseTo(registration.references.backRight.parts.tail[3]*registration.scale/regions.backRight.parts.tail.crop[3],10);
});
