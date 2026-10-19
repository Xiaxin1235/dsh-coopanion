import { createRig } from '/web/upstream/kit/rig.js';
import { handSurfaceModel, handSurfaceState, splitHandRgba, handWeights } from '/web/upstream/whale/hand-art.js';
import { drawComposite } from './composition.js';
const spec = await (await fetch('/web/props/shell/hands/asset.json')).json();
const profile = await (await fetch('/web/props/shell/motion-with-hands.json')).json();
const surface=handSurfaceModel(spec), canvas=document.querySelector('canvas');
const image=new Image();image.src='/web/props/shell/hands/'+surface.plan.asset.image;await image.decode();
const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
const sourceCtx=source.getContext('2d');sourceCtx.drawImage(image,0,0);
const pixels=sourceCtx.getImageData(0,0,image.width,image.height).data;
const split=splitHandRgba(pixels,image.width,image.height,surface.frontBoundary);
const view=surface.view, rig=createRig(canvas,{parts:surface.parts,deformers:{armFar:{kind:'rot',pivot:spec.wrist},...surface.deformers},view});
for(const [name,data] of Object.entries(split)) {const cv=document.createElement('canvas');cv.width=image.width;cv.height=image.height;cv.getContext('2d').putImageData(new ImageData(data,image.width,image.height),0,0);rig.upload('__hand_'+name,cv);}
document.querySelector('#run').onclick = async () => {
  const samples = [];
  let openPixels,closedPixels;
  for(const fraction of [0,.25,.5,.75,1]) {
    const w = handWeights({phase:'grasp',elapsed:profile.seconds.grasp*fraction},profile);
    const state = handSurfaceState(surface,w);
    rig.render(state);
    const x = Math.round((spec.wrist[0]-view[0])*canvas.width/(view[2]-view[0]));
    const y = Math.round((spec.wrist[1]-view[1])*canvas.height/(view[3]-view[1]));
    const pixel = new Uint8Array(4); rig.gl.readPixels(x,canvas.height-1-y,1,1,rig.gl.RGBA,rig.gl.UNSIGNED_BYTE,pixel);
    samples.push({fraction,alpha:pixel[3],weights:w});
    if(fraction===0 || fraction===1) {
      const bytes=new Uint8Array(canvas.width*canvas.height*4);rig.gl.readPixels(0,0,canvas.width,canvas.height,rig.gl.RGBA,rig.gl.UNSIGNED_BYTE,bytes);
      if(fraction===0)openPixels=bytes;else closedPixels=bytes;
    }
  }
  const phaseMinimums={};
  let cuffReference, cuffChangedPixels=0;
  for(const phase of ['reach','grasp','release','rise']) {
    phaseMinimums[phase]=255;
    for(let i=0;i<=24;i++) {
      const state=handSurfaceState(surface,handWeights({phase,elapsed:profile.seconds[phase]*i/24},profile));rig.render(state);
      const pixel=new Uint8Array(4), x=Math.round((spec.wrist[0]-view[0])*canvas.width/(view[2]-view[0])),y=Math.round((spec.wrist[1]-view[1])*canvas.height/(view[3]-view[1]));
      rig.gl.readPixels(x,canvas.height-1-y,1,1,rig.gl.RGBA,rig.gl.UNSIGNED_BYTE,pixel);
      phaseMinimums[phase]=Math.min(phaseMinimums[phase],pixel[3]);
      const cuff=new Uint8Array(canvas.width*100*4);rig.gl.readPixels(0,canvas.height-100,canvas.width,100,rig.gl.RGBA,rig.gl.UNSIGNED_BYTE,cuff);
      if(!cuffReference)cuffReference=cuff;
      else for(let k=0;k<cuff.length;k++)if(cuff[k]!==cuffReference[k])cuffChangedPixels++;
    }
  }
  // Use the same compositor as the workbench with real palm/finger rasters.
  const state=handSurfaceState(surface,{grip:1});rig.render(state,{hidden:{__hand_fingers:true}});
  const bodyImage=new Image();bodyImage.src=canvas.toDataURL();await bodyImage.decode();
  rig.render(state,{hidden:{__hand_palm:true}});
  const frontImage=new Image();frontImage.src=canvas.toDataURL();await frontImage.decode();
  const shellSpec=await(await fetch('/web/props/shell/asset.json')).json(),shellImage=new Image();shellImage.src='/web/props/shell/shell.png';await shellImage.decode();
  const composite=document.createElement('canvas');
  // This scratch surface is read after every paint. Request the readback path
  // up front: recent Chrome GPU readback can quantize identical successive
  // composites differently. The hand rasters above still come from real WebGL.
  composite.getContext('2d',{willReadFrequently:true});
  const quad=[{x:166-20,y:199-1.6},{x:166+20,y:199-1.6},{x:166-20,y:199+31.4}];
  const frame={bodyX:160,groundQuad:quad,heldQuad:quad},detail={matrix:[1,0,0,1,0,0],view};
  const capture=owner=>{drawComposite(composite,{frame:{...frame,owner},detail,spec:shellSpec,shellImage,bodyImage,frontImage,width:320,scale:1});return composite.getContext('2d').getImageData(0,0,320,390).data;};
  const ground=capture('ground'),held=capture('hand');let ownerChangedPixels=0;
  for(let i=0;i<ground.length;i++)if(ground[i]!==held[i])ownerChangedPixels++;
  let handChangedPixels=0;
  for(let i=0;i<openPixels.length;i+=4)if(openPixels.subarray(i,i+4).some((v,k)=>v!==closedPixels[i+k]))handChangedPixels++;
  const empty=document.createElement('canvas');empty.width=canvas.width;empty.height=canvas.height;
  drawComposite(composite,{frame:{...frame,owner:'hand'},detail,spec:shellSpec,shellImage,bodyImage,frontImage:empty,width:320,scale:1});
  const noFingers=composite.getContext('2d').getImageData(0,0,320,390).data;let frontVisiblePixels=0;
  for(let i=0;i<held.length;i+=4)if(held.subarray(i,i+4).some((v,k)=>v!==noFingers[i+k]))frontVisiblePixels++;
  const minimum = Math.min(...samples.map(s=>s.alpha),...Object.values(phaseMinimums));
  document.querySelector('#report').textContent=JSON.stringify({passed:minimum>=248 && cuffChangedPixels===0 && ownerChangedPixels===0 && handChangedPixels>50 && frontVisiblePixels>20,minimumOpaqueWristAlpha:minimum,required:248,phaseMinimums,cuffChangedPixels,ownerChangedPixels,handChangedPixels,frontVisiblePixels,samples},null,2);
};
