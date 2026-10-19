import { createRig } from '/web/upstream/kit/rig.js';
import { planHandArt, handWeights } from '/web/upstream/whale/hand-art.js';
const spec = await (await fetch('/web/props/shell/hands/asset.json')).json();
const profile = await (await fetch('/web/props/shell/motion-with-hands.json')).json();
const plan = planHandArt(spec), canvas = document.querySelector('canvas');
const parts = [], deformers = {}, textures = {};
for (const [name,p] of Object.entries(plan)) {
  const image = new Image(); image.src = '/web/props/shell/hands/' + p.asset.image; await image.decode(); textures[name] = image;
  deformers[name] = { kind:'rot', pivot:p.pivot };
  parts.push({id:name,tex:name,parent:name,z:name==='grip'?5.02:5.2,...p.full,grid:[1,1]});
  if(p.front) parts.push({id:'front',tex:name,parent:name,z:5.2,...p.front,grid:[1,1]});
}
const view = [150,180,180,210], rig = createRig(canvas,{parts,deformers,view});
for(const [name,image] of Object.entries(textures)) rig.upload(name,image);
document.querySelector('#run').onclick = () => {
  const samples = [];
  for(const fraction of [0,.25,.5,.75,1]) {
    const w = handWeights({phase:'grasp',elapsed:profile.seconds.grasp*fraction},profile);
    const state = {alpha:{...w,front:w.grip}};
    for(const [name,p] of Object.entries(plan)) state[name]={a:p.angle};
    rig.render(state);
    const x = Math.round((spec.wrist[0]-view[0])*canvas.width/(view[2]-view[0]));
    const y = Math.round((spec.wrist[1]-view[1])*canvas.height/(view[3]-view[1]));
    const pixel = new Uint8Array(4); rig.gl.readPixels(x,canvas.height-1-y,1,1,rig.gl.RGBA,rig.gl.UNSIGNED_BYTE,pixel);
    samples.push({fraction,alpha:pixel[3],weights:w});
  }
  const minimum = Math.min(...samples.map(s=>s.alpha));
  document.querySelector('#report').textContent=JSON.stringify({passed:minimum>=248,minimumOpaqueWristAlpha:minimum,required:248,samples},null,2);
};
