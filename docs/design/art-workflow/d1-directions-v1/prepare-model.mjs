import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url), regions=JSON.parse(await readFile(new URL('source/atlas-regions.json',root)));
const registration=JSON.parse(await readFile(new URL('source/design-registration-v1.json',root)));
const project=(id,[x,y])=>[128+(x-registration.references[id].feet[0])*registration.scale,256+(y-registration.references[id].feet[1])*registration.scale];
const projectBox=(id,[x,y,w,h])=>[...project(id,[x,y]),w*registration.scale,h*registration.scale];
// Explicit authoring calibration in the same (128,256) foot-origin rig space.
const boxes={
 front:{},
 back:{head:[41,20,174,180],dress:[78,151,106,75],armL:[83,159,33,55],armR:[149,159,33,55],legL:[104,211,25,46],legR:[136,211,25,46],tail:[127,187,85,44],bow:[111,194,48,36]},
 backRight:{}
};
for(const [id,ref]of Object.entries(registration.references))for(const [name,box]of Object.entries(ref.parts))boxes[id][name]=projectBox(id,box);
const z={hairBack:0,tail:1,legL:2,legR:2.1,dress:4,armL:3,armR:5,head:9,face:3.5,hairFront:10,bow:10.1};
const models={schema:1,status:'authoring-source',view:[-12,-8,268,272],origin:[128,256],directions:{}};
for(const[id,s]of Object.entries(regions)){
 const parts=Object.entries(s.parts).map(([name,p])=>{const[x,y,w,h]=p.crop;return{id:name,tex:'atlas',box:boxes[id][name],uvBox:[x/s.width,y/s.height,(x+w)/s.width,(y+h)/s.height],grid:name==='head'||name.includes('hair')?[8,12]:[5,7],parent:name==='face'?'head':name==='hairFront'?'hairFront':name==='hairBack'?'hairBack':name,z:name==='tail'&&id==='back'?8:z[name]};});
 const pivots={body:[128,256],upper:[128,177],head:[133,155],hairFront:[133,155],hairBack:[133,155],dress:[128,176],tail:id==='back'?[133,199]:[99,210],bow:[132,198],armL:[id==='backRight'?113:108,165],armR:[158,166],legL:[116,216],legR:[149,216]};
 if(registration.references[id])for(const [name,p]of Object.entries(registration.references[id].pivots))pivots[name]=project(id,p);
 const deformers={body:{kind:'rot',pivot:pivots.body},upper:{kind:'rot',pivot:pivots.upper,parent:'body'}};
 for(const name of Object.keys(s.parts)){if(name==='face')continue;const box=boxes[id][name],hair=['hairBack','hairFront','head','dress'].includes(name);deformers[name]=hair?{kind:'warp',rect:[box[0],box[1],box[0]+box[2],box[1]+box[3]],parent:name==='dress'?'body':'upper'}:{kind:'rot',pivot:pivots[name],parent:name.startsWith('arm')?'upper':'body'};}
 if(id==='front')deformers.head={kind:'rot',pivot:pivots.head,parent:'upper'};
 models.directions[id]={atlas:'source/'+s.file,parts,deformers,pivots,anchors:{ground:[128,256],gaze:[143,121],bubble:[128,18]},bounds:[20,19,215,258]};
}
// Selected C07 atlases already contain the cheek/tail correction; C05 stays historical.
const revision=JSON.parse(await readFile(new URL('source/faithful-revision-v1.json',root)));
for(const [id,file]of Object.entries(revision.selected))if(regions[id].file!==file)throw Error('Unselected atlas: '+id);
const rear=registration.references.backRight;
models.directions.backRight.headBow={box:projectBox('backRight',rear.headBow),farBox:projectBox('backRight',rear.farHeadBow),pivot:[128,256],parent:'upper',z:11};
for(const [id,ref]of Object.entries(registration.references)){models.directions[id].anchors.feet=ref.solePoints.map(p=>project(id,p));if(ref.restWarps)models.directions[id].restWarps=ref.restWarps;}
const f=registration.references.front.face,centres=f.centres.map(p=>project('front',p));
models.directions.front.faceCalibration={centres:centres.map(p=>p[0]),y:centres[0][1],scale:f.irisWidth*registration.scale/96,iris:[139,110.5],mouth:project('front',f.mouth),browY:project('front',[545,f.browY])[1]};
models.directions.front.anchors.gaze=[(centres[0][0]+centres[1][0])/2,centres[0][1]];
const text=JSON.stringify(models,null,2)+'\n',path=new URL('model.json',root);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==text)throw new Error('Authoring model is stale');}else await writeFile(path,text);
