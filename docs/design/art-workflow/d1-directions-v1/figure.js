import {createRig} from '/web/upstream/kit/rig.js';
import {composeFrontFace} from '/web/upstream/whale/front-face.js';
import {applyDirectionRestShape} from '/web/upstream/whale/direction-shape.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const image=url=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>bad(new Error('Cannot decode '+url));im.src=url;});
/** Production renderer reused for authoring; no autonomous policy or product capability. */
export async function createDirectionSample(canvas,definition,base){
 const atlas=await image(new URL(definition.atlas,base));
 const front=definition.parts.some(p=>p.id==='face');
 let faceCanvas,faceCtx,faceParts,eyeCanvas,eyeCtx;
 if(front){
  faceCanvas=document.createElement('canvas');faceCanvas.width=280*3;faceCanvas.height=280*3;faceCtx=faceCanvas.getContext('2d');
  const names=['eyeL_ball','eyeL_iris','eyeL_lash','neutral_mouth'];
  faceParts=Object.fromEntries(await Promise.all(names.map(async n=>[n,await image('/web/upstream/whale/feat/'+n+'.png')])));
  faceParts.brows=await image('/web/upstream/whale/tex/brows.png');
  eyeCanvas=document.createElement('canvas');eyeCanvas.width=390;eyeCanvas.height=252;eyeCtx=eyeCanvas.getContext('2d');
  // A separate skin-aligned face surface, with hair drawn in front of it.
 }
 // Same rig, extra dynamic face layer only in the frontal sample.
 const parts=definition.parts.map(p=>({...p,tex:p.atlas?p.id+'Atlas':p.tex})),deformers={...definition.deformers};
 if(definition.headBow){const b=definition.headBow;parts.push({id:'headBow',tex:'headBow',box:b.box,parent:'headBow',z:b.z,grid:[3,3]});deformers.headBow={kind:'rot',pivot:b.pivot,parent:b.parent};}
 const active=createRig(canvas,{view:[-12,-8,268,272],parts:[...parts,...(front?[{id:'features',tex:'features',box:[-12,-8,280,280],parent:'head',z:8,grid:[8,8]}]:[])],deformers});
 active.upload('atlas',atlas);
 for(const p of definition.parts)if(p.atlas)active.upload(p.id+'Atlas',await image(new URL(p.atlas,base)));
 if(definition.headBow)active.upload('headBow',await image('/web/upstream/whale/tex/bow.png'));
 function face(blink,look){
  const closed=clamp(blink,0,1),g=eyeCtx;
  composeFrontFace(faceCtx,{brows:faceParts.brows,calibration:definition.faceCalibration,
   eye(i){
    g.clearRect(0,0,390,252);g.save();g.beginPath();g.rect(45,48+118*closed,165,125);g.clip();
    g.drawImage(faceParts.eyeL_ball,65,52,125,118);g.globalCompositeOperation='source-atop';
    g.drawImage(faceParts.eyeL_iris,91+clamp(look[0],-2,2)*5*(i?-1:1),51+clamp(look[1],-2,2)*5,96,119);g.restore();
    g.drawImage(faceParts.eyeL_lash,29,31+closed*115,165,106*(.35+.65*(1-closed)));return eyeCanvas;
   },mouth(){g.clearRect(0,0,390,252);g.drawImage(faceParts.neutral_mouth,238,186,15,11);return eyeCanvas;}});
  active.upload('features',faceCanvas);
 }
 let latest=null;
 return{
  draw({t=0,walk=0,phase=t*10,blink=0,look=[0,0],stress=0}={}){
   if(front)face(blink,look);
   const stride=Math.sin(phase)*walk,other=-stride;
   const st={alpha:{},body:{sy:1-.004*Math.sin(t*2.4)},upper:{a:Math.sin(t*.8)*.6},
    legL:{a:stride*4,ty:-Math.max(0,stride)*4},legR:{a:other*4,ty:-Math.max(0,other)*4},
    armL:{a:-stride*10-stress*18},armR:{a:-other*10+stress*18},tail:{a:Math.sin(t*2.2)*5},bow:{a:Math.sin(t*2)*1.5},
    dress:{fn:(u,v)=>[Math.sin(t*2+u)*v*1.1,Math.abs(stride)*v*.6]},
    head:{fn:(u,v)=>[Math.sin(t*1.8+v*2)*Math.max(0,(v-.45))*1.8,0],a:look[0]*.3},
    hairBack:{fn:(u,v)=>[Math.sin(t*1.8+v*2)*v*v*1.6,0]},hairFront:{fn:(u,v)=>[Math.sin(t*1.8+v*2)*v*v*.8,0]}};
   applyDirectionRestShape(st,definition);
   const feet=definition.anchors.feet??[[116,256],[149,256]];
   active.render(st);latest={feet:feet.map((p,i)=>active.point(i?'legR':'legL',st,...p)),root:active.point('body',st,128,256),states:st};return latest;
  },get state(){return latest;},dispose(){active.dispose();}
 };
}
