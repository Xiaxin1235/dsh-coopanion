import {createRig} from '/web/upstream/kit/rig.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const image=url=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>bad(new Error('Cannot decode '+url));im.src=url;});
/** Production renderer reused for authoring; no autonomous policy or product capability. */
export async function createDirectionSample(canvas,definition,base){
 const atlas=await image(new URL(definition.atlas,base));
 const front=definition.parts.some(p=>p.id==='face');
 let faceCanvas,faceCtx,faceParts;
 if(front){
  faceCanvas=document.createElement('canvas');faceCanvas.width=280*3;faceCanvas.height=280*3;faceCtx=faceCanvas.getContext('2d');
  const names=['eyeL_ball','eyeL_iris','eyeL_lash','neutral_mouth'];
  faceParts=Object.fromEntries(await Promise.all(names.map(async n=>[n,await image('/web/upstream/whale/feat/'+n+'.png')])));
  faceParts.brows=await image('/web/upstream/whale/tex/brows.png');
  // A separate skin-aligned face surface, with hair drawn in front of it.
 }
 // Same rig, extra dynamic face layer only in the frontal sample.
 const active=createRig(canvas,{view:[-12,-8,268,272],parts:[...definition.parts,...(front?[{id:'features',tex:'features',box:[-12,-8,280,280],parent:'head',z:8,grid:[8,8]}]:[])],deformers:definition.deformers});
 active.upload('atlas',atlas);
 function face(blink,look){
  const g=faceCtx;g.setTransform(3,0,0,3,36,24);g.clearRect(-12,-8,280,280);
  for(const [i,cx]of [111,155].entries()){
   g.save();g.translate(cx,133);if(i)g.scale(-1,1);
   const closed=clamp(blink,0,1),open=1-closed;
   g.save();g.beginPath();g.rect(-16,-13+24*closed,32,29);g.clip();
   g.drawImage(faceParts.eyeL_ball,-12,-12,25,24);
   g.drawImage(faceParts.eyeL_iris,-7+clamp(look[0],-2,2)*(i?-1:1),-12+clamp(look[1],-2,2),19,24);g.restore();
   g.drawImage(faceParts.eyeL_lash,-19,-17+closed*23,33,21*(.35+.65*open));g.restore();
  }
  // Reuse the near eyebrow for both sides; retain the source as an independent surface.
  for(const [i,cx] of [111,155].entries()){g.save();g.translate(cx,116);if(i)g.scale(-1,1);g.drawImage(faceParts.brows,0,0,70,faceParts.brows.height,-15,0,27,6);g.restore();}
  g.drawImage(faceParts.neutral_mouth,131,144,3,2.2);
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
   active.render(st);latest={feet:[active.point('legL',st,116,256),active.point('legR',st,149,256)],root:active.point('body',st,128,256),states:st};return latest;
  },get state(){return latest;},dispose(){active.dispose();}
 };
}
