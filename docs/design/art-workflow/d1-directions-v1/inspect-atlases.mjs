import {readFile,writeFile}from'node:fs/promises';import{readRgbaPng}from'../../../../scripts/lib/rgba-png.mjs';
const path=new URL('source/atlas-regions.json',import.meta.url),source=JSON.parse(await readFile(path,'utf8'));
for(const set of Object.values(source)){
 const{pixels,width,height}=readRgbaPng(await readFile(new URL('source/'+set.file,import.meta.url)));set.width=width;set.height=height;
 for(const p of Object.values(set.parts)){const[x,y,w,h]=p.region;let a=width,b=height,c=0,d=0,count=0;for(let j=y;j<Math.min(y+h,height);j++)for(let i=x;i<Math.min(x+w,width);i++)if(pixels[(j*width+i)*4+3]>=16){a=Math.min(a,i);b=Math.min(b,j);c=Math.max(c,i);d=Math.max(d,j);count++;}if(!count)throw Error('Empty region');p.crop=[a-2,b-2,c-a+5,d-b+5];p.visiblePixels=count;}
}
const text=JSON.stringify(source,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==text)throw Error('Atlas region metadata stale');}else await writeFile(path,text);
