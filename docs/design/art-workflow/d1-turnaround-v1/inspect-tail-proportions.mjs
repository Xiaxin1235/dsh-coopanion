// Read-only comparison of painted spans. This does not certify 3D perspective or identity.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readRgbaPng} from '../../../../scripts/lib/rgba-png.mjs';
const regions={frontTail:[40,647,440,723],backTail:[1350,655,1730,725],frontHem:[40,550,430,639],backHem:[1360,550,1735,639]};
export function measureTail(bytes){
 const image=readRgbaPng(bytes);
 if(image.width!==1774||image.height!==887)throw Error('Review regions are registered only to the 1774 x 887 sheet; register a new canvas before measuring.');
 const spans={};
 for(const[name,[x0,y0,x1,y1]]of Object.entries(regions)){
  const columns=[];
  for(let x=x0;x<x1;x++){
   let count=0;
   for(let y=y0;y<y1;y++){
    const i=(y*image.width+x)*4,[r,g,b,a]=image.pixels.subarray(i,i+4);
    if(a>192&&(!name.endsWith('Tail')||(b>g*1.15&&r<b*.7&&b>70)))count++;
   }
   if(count>=5)columns.push(x);
  }
  if(!columns.length)throw Error(`No painted span detected in ${name}; inspect the image and review regions.`);
  spans[name]={xMin:columns[0],xMax:columns.at(-1),width:columns.at(-1)-columns[0]+1};
 }
 return{sha256:createHash('sha256').update(bytes).digest('hex'),canvas:[image.width,image.height],method:'manually registered ROIs; alpha > 192; tail blue b > 1.15*g, r < .7*b, b > 70; at least 5 pixels per column; approximate painted extents, not physical dimensions',regions,spans,ratios:{front:spans.frontTail.width/spans.frontHem.width,back:spans.backTail.width/spans.backHem.width},limitations:['finite ROI and colour thresholds omit faint tips and antialias edges','does not test rear-quarter projection, body identity or shared anatomical pose']};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 if(!process.argv[2])throw Error('Usage: node inspect-tail-proportions.mjs <1774x887 candidate.png>');
 console.log(JSON.stringify(measureTail(await readFile(process.argv[2])),null,2));
}
