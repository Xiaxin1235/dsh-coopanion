import { loadBody } from '/web/upstream/body-host.js';

const $ = id => document.getElementById(id);
const reports = await Promise.all([1,2].map(async v => (await fetch(`./inspection-v${v}.json`)).json()));
let version = 2;
const report = () => reports[version-1];
const imageURL = v => new URL(`./shell-v${v}.png`,location.href).href;
function fitImage(img,visibleWidth,r) {
  const b=r.visibleBounds, scale=visibleWidth/b.width;
  Object.assign(img.style,{position:'absolute',width:r.png.width*scale+'px',height:r.png.height*scale+'px',left:-b.x*scale+'px',top:-b.y*scale+'px',maxWidth:'none'});
  return scale;
}
function imageSample(v,size,w,h) {
  const r=reports[v-1], surface=document.createElement('div');surface.className='sample-surface';Object.assign(surface.style,{width:w+'px',height:h+'px'});
  const wrap=document.createElement('div');Object.assign(wrap.style,{position:'absolute',left:(w-size)/2+'px',top:(h-size*r.visibleBounds.height/r.visibleBounds.width)/2+'px'});
  const img=new Image();img.src=imageURL(v);img.alt=`V${v} 贝壳，可见宽度 ${size} 像素`;fitImage(img,size,r);wrap.append(img);surface.append(wrap);return surface;
}
function renderInspection() {
  const r=report(),b=r.visibleBounds;$('facts').replaceChildren();$('checks').replaceChildren();$('samples').replaceChildren();
  const facts=[['当前候选',`V${version} · ${version===2?'哑光简化':'初次生成'}`],['文件格式','PNG · RGBA'],['原图尺寸',`${r.png.width} × ${r.png.height}`],['可见范围',`${b.width} × ${b.height}`],['透明像素',`${(r.alpha.transparentFraction*100).toFixed(1)}%`],['主体连通区域',String(r.silhouette.significantComponents)],['原图 SHA-256',r.sha256.slice(0,12)+'…']];
  for(const [label,value] of facts){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('facts').append(row);}
  for(const [key,label] of [['realTransparency','真实 alpha 透明'],['clearCanvasEdge','主体未碰画布边缘'],['oneMainSilhouette','单一主要轮廓']]){const p=document.createElement('div');p.className='check'+(r.gates[key]?'':' fail');p.textContent=label;$('checks').append(p);}
  $('gate-copy').textContent=Object.values(r.gates).every(Boolean)?'3 项结构检查通过':'需要返修';$('prompt-link').href=`./prompt-v${version}.txt`;$('report-link').href=`./inspection-v${version}.json`;
  $('prop').querySelector('img').src=imageURL(version);
  for(const size of [24,40,64]){const card=document.createElement('div');card.className='sample';const label=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=size+' px';small.textContent=size===40?'推荐试用尺寸':'对照尺寸';label.append(b,small);card.append(imageSample(version,size,74,58),label);$('samples').append(card);}
  updateProp();
}
for(const v of [1,2]){const card=document.createElement('div');card.className='version';card.append(imageSample(v,150,190,145));const title=document.createElement('b');title.textContent=`V${v} · ${v===1?'初次生成':'哑光简化'}`;card.append(title);$('versions').append(card);}
function updateProp(){
  const r=report(),b=r.visibleBounds,size=Number($('size').value),scale=fitImage($('prop').querySelector('img'),size,r),ground=r.candidateAnchors.ground;
  Object.assign($('prop').style,{left:($('scene').clientWidth*.46-(ground.x*r.png.width-b.x)*scale)+'px',top:(270-(ground.y*r.png.height-b.y)*scale)+'px',width:size+'px',height:b.height*scale+'px'});
  for(const key of ['ground','grip']){const a=r.candidateAnchors[key],dot=$('prop').querySelector('.'+key);dot.style.left=(a.x*r.png.width-b.x)*scale+'px';dot.style.top=(a.y*r.png.height-b.y)*scale+'px';}
  $('display-width').textContent=$('size-value').textContent=size+' px';
}
$('variant').addEventListener('change',()=>{version=Number($('variant').value);renderInspection();});
$('size').addEventListener('input',updateProp);$('anchors').addEventListener('change',()=>{$('scene').classList.toggle('hide-anchors',!$('anchors').checked);});
for(const button of document.querySelectorAll('button[data-bg]'))button.addEventListener('click',()=>{$('scene').dataset.bg=button.dataset.bg;for(const sibling of document.querySelectorAll('button[data-bg]'))sibling.setAttribute('aria-pressed',String(sibling===button));});
renderInspection();
let body;
const stageBounds=()=>({W:$('scene').clientWidth,H:340,floorY:270,S:180/256});
try{
  const pack=await(await fetch('/web/upstream/whale/figure.json')).json();Object.assign(pack,{base:'/docs/design/art-workflow/o03-shell-v1/',entry:'reference-whale.js',export:'createReferenceBody',model:'../../../../web/upstream/whale/model.json'});
  body=await loadBody({layer:$('body-layer'),pack,start:{x:$('scene').clientWidth*.28,facing:1,scheme:'deepseek'},theme:'light',bounds:stageBounds(),onSound:()=>{},onError:error=>{$('body-status').textContent='角色参照不可用：'+error.message;}});
  body.set({roam:'off'});body.place($('scene').clientWidth*.28,1);
  let last=performance.now(),ready=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now){if(!document.hidden&&now-last>=1000/30){body.tick(Math.min(.05,(now-last)/1000));last=now;if(body.layout&&!ready){ready=true;$('body-status').textContent='真实 API 2 角色已就绪 · 仅作比例参照';document.documentElement.dataset.ready='true';}}if(!reduced||!ready)requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
}catch(error){$('body-status').textContent='角色参照加载失败：'+error.message;document.documentElement.dataset.ready='error';}
new ResizeObserver(()=>{updateProp();if(body){body.set({bounds:stageBounds()});body.place($('scene').clientWidth*.28,1);}}).observe($('scene'));
addEventListener('pagehide',()=>body?.dispose());
