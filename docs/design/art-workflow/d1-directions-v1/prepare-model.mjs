import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url), regions=JSON.parse(await readFile(new URL('source/atlas-regions.json',root)));
// Explicit authoring calibration in the same (128,256) foot-origin rig space.
const boxes={
 front:{hairBack:[48,52,155,160],face:[91,76,86,89],hairFront:[41,19,174,177],dress:[81,151,105,75],armL:[78,159,39,53],armR:[151,159,39,53],legL:[102,211,26,46],legR:[135,211,26,46],tail:[26,174,78,40]},
 back:{head:[41,20,174,180],dress:[78,151,106,75],armL:[83,159,33,55],armR:[149,159,33,55],legL:[104,211,25,46],legR:[136,211,25,46],tail:[127,187,85,44],bow:[111,194,48,36]},
 backRight:{head:[45,20,168,181],dress:[80,151,110,75],armL:[106,157,35,53],armR:[151,162,38,53],legL:[106,211,33,46],legR:[137,211,35,46],tail:[20,190,88,56],bow:[100,194,52,49]}
};
const z={hairBack:0,tail:1,legL:2,legR:2.1,dress:4,armL:3,armR:5,head:9,face:3.5,hairFront:10,bow:10.1};
const models={schema:1,status:'authoring-prototype-not-product',view:[-12,-8,268,272],origin:[128,256],directions:{}};
for(const[id,s]of Object.entries(regions)){
 const parts=Object.entries(s.parts).map(([name,p])=>{const[x,y,w,h]=p.crop;return{id:name,tex:'atlas',box:boxes[id][name],uvBox:[x/s.width,y/s.height,(x+w)/s.width,(y+h)/s.height],grid:name==='head'||name.includes('hair')?[8,12]:[5,7],parent:name==='face'?'head':name==='hairFront'?'hairFront':name==='hairBack'?'hairBack':name,z:name==='tail'&&id==='back'?8:z[name]};});
 const pivots={body:[128,256],upper:[128,177],head:[133,155],hairFront:[133,155],hairBack:[133,155],dress:[128,176],tail:id==='back'?[133,199]:[99,210],bow:[132,198],armL:[id==='backRight'?113:108,165],armR:[158,166],legL:[116,216],legR:[149,216]};
 const deformers={body:{kind:'rot',pivot:pivots.body},upper:{kind:'rot',pivot:pivots.upper,parent:'body'}};
 for(const name of Object.keys(s.parts)){if(name==='face')continue;const box=boxes[id][name],hair=['hairBack','hairFront','head','dress'].includes(name);deformers[name]=hair?{kind:'warp',rect:[box[0],box[1],box[0]+box[2],box[1]+box[3]],parent:name==='dress'?'body':'upper'}:{kind:'rot',pivot:pivots[name],parent:name.startsWith('arm')?'upper':'body'};}
 if(id==='front')deformers.head={kind:'rot',pivot:pivots.head,parent:'upper'};
 models.directions[id]={atlas:'source/'+s.file,parts,deformers,pivots,anchors:{ground:[128,256],gaze:id==='front'?[133,135]:[143,121],bubble:[128,18]},bounds:[20,19,215,258]};
}
const text=JSON.stringify(models,null,2)+'\n',path=new URL('model.json',root);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==text)throw new Error('Authoring model is stale');}else await writeFile(path,text);
