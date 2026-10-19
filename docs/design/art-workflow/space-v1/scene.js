import { planPath, checkPath } from '/web/upstream/kit/navigation.js';
import { loadBody } from '/web/upstream/body-host.js';
import { drawComposite } from '../o03-shell-hands-v1/composition.js';
import { WORLD, BODY, freshLayout, footprint, expanded, checkRoute, actionRoute, occlusionOrder, navigationModel } from './geometry.js';
const $ = id => document.getElementById(id), world = $('world');
const spec = await (await fetch('/web/props/shell/asset.json')).json();
const shellImage = new Image(); shellImage.src = '/web/props/shell/shell.png'; await shellImage.decode();
let layout = freshLayout(), body, current, painted, selected = 'actor', busyEdit = true, drag, blockedBackup, pending, painting = false, epoch = 0;
let navId=0, navGeneration=1, navTarget=null, navPlan=null, navActive=false, navPaused=false;
const rootPosition=()=>({x:current?.bodyX??layout.actor.x,y:current?.bodyY??layout.actor.y});
let desktopOverlay=false;
const history = [], measurements = { frames: 0, left: 0, right: 0, top: 0, bottom: 0, binding: 0, wrongLayers: 0, ownerMismatches: 0, ownerSwitchJump: 0 };
const phases = { idle:'站稳待机', approach:'接近贝壳', settle:'收步站稳', look:'先看向贝壳', reach:'俯身伸手', grasp:'指尖闭合', lift:'起身抬起', held:'保持持物', carry:'携带行走', settleDrop:'收步站稳', lower:'俯身放低', touch:'接触地面', release:'张手放开', retract:'收手', rise:'起身', paused:'暂停', inspect:'试摆' };
const navigationBusy=()=>navActive || current?.navigation?.id!=null;
const actionSafe=()=>Math.abs(rootPosition().y-layout.actor.y)<.5 && actionRoute({...layout,actor:rootPosition()}).passed;
const command = c => body?.set({ motionCommand: c });
const bounds = () => ({ W:WORLD.width, H:WORLD.height, floorY:layout.actor.y, S:BODY.size/256, navigation:true });
const svgRect = (r, attrs='') => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${attrs}/>`;
function geometry() {
  const legacy=checkRoute(layout), model=navigationModel(layout), route=navPlan??planPath(model,rootPosition(),navTarget??{x:850,y:600}), action = actionRoute(layout);
  const routePoints=route.points?.length?route.points:[rootPosition(),navTarget??{x:850,y:600}];
  const north=layout.objects.find(o=>o.id==='gate-north'),south=layout.objects.find(o=>o.id==='gate-south');
  const gateTop={x:north.x+north.w/2,y:north.y+north.h},gateBottom={x:south.x+south.w/2,y:south.y};
  $('threshold-label').innerHTML=`门槛 <span>${Math.max(0,Math.round(gateBottom.y-gateTop.y))}px 纵向间隙</span>`;
  Object.assign($('threshold-label').style,{left:gateTop.x-30+'px',top:gateTop.y+13+'px'});
  world.dataset.geometry = JSON.stringify({ route, legacy, action });
  $('route-card').classList.toggle('blocked', !route.passed);
  $('route-result').textContent = route.passed ? route.alternative?'找到替代路线 · 完整身体绕障':'可通过 · 完整身体直达' : '当前模型内不可达';
  const conflicts=route.direct?.violations??[];
  $('route-detail').textContent = `${route.reason??(route.alternative?'当前直线路线冲突，已搜索绕路':'直线路线无冲突')}。${conflicts.map(v=>`第 ${v.segment} 段 / ${layout.objects.find(o=>o.id===v.obstacle)?.label??v.obstacle} / ${v.envelope}`).join('；')}。完整身体 200×213px + 12px 余量；实体扣除透明留边与阴影，禁区保留全矩形；可见图顶点精度 0.5px。`;
  const points = routePoints.map(p=>`${p.x},${p.y}`).join(' ');
  $('route-layer').innerHTML = `<path d="M${gateTop.x} ${gateTop.y}L${gateBottom.x} ${gateBottom.y}" stroke="#b6bca0" stroke-width="25" opacity=".2"/><path d="M${gateTop.x} ${gateTop.y}L${gateBottom.x} ${gateBottom.y}" stroke="#b3b99a" stroke-dasharray="4 7"/>${routePoints.map(p=>svgRect(footprint(p,BODY,BODY.turn),'rx="10" fill="#abc5bb" fill-opacity=".07" stroke="#9bb8aa" stroke-dasharray="3 6" stroke-opacity=".5"')).join('')}<polyline points="${points}" fill="none" stroke="${route.passed?'#8caba1':'#c49a71'}" stroke-width="3" stroke-linejoin="round" stroke-dasharray="4 9"/>${routePoints.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i===0||i===routePoints.length-1?6:3}" fill="#f6f7ed" stroke="#8eada2"/><text x="${p.x+10}" y="${p.y+20}" fill="#8fa89d" font-size="9">${i===0?'生活锚点':i===routePoints.length-1?'岗位锚点':i}</text>`).join('')}<ellipse cx="${layout.destination}" cy="${layout.actor.y}" rx="24" ry="6" fill="none" stroke="#b4a27a" stroke-dasharray="3 3"/><text x="${layout.destination-18}" y="${layout.actor.y+25}" font-size="9" fill="#a89879">放置点</text>`;
  $('zones').innerHTML = layout.zones.map(z=>`<div class="zone ${z.id==='work'?'work':''}" style="left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px"></div>`).join('');
  const order = occlusionOrder(layout.objects,rootPosition().y), ranks = new Map(order.map((id,i)=>[id,10+i]));
  for (const object of layout.objects) {
    let el = document.querySelector(`[data-object="${object.id}"]`);
    if (!el) {
      el = document.createElement('button'); el.className = 'object'+(object.layer==='restricted'?' restricted':''); el.dataset.object=object.id; el.setAttribute('aria-label',`选择${object.label}`);
      el.innerHTML = object.asset ? `<img src="./assets/${object.asset}" alt="${object.label}">` : '手动内容禁区<small>明确矩形 · 不读取应用内容</small>';
      el.onpointerdown=e=>startDrag(e,object.id);el.onpointermove=moveDrag;el.onpointerup=el.onpointercancel=endDrag;
      el.onclick=e=>{if(e.detail===0)select(object.id);}; $('objects').append(el);
    }
    Object.assign(el.style,{left:object.x+'px',top:object.y+'px',width:object.w+'px',height:object.h+'px',zIndex:ranks.get(object.id)??3});
    el.disabled = busyEdit || (current && current.phase!=='idle');
  }
  for(const id of ['composition','actor-hit','shell-hit'])$(id).style.zIndex = ranks.get('body-shell-fingers');
  const home=layout.objects.find(o=>o.id==='home'), station=layout.objects.find(o=>o.id==='station');
  Object.assign(document.querySelector('.home-label').style,{left:home.x+'px',top:Math.max(35,home.y-70)+'px'});
  Object.assign(document.querySelector('.work-label').style,{left:station.x+'px',top:Math.max(250,station.y+station.h+20)+'px'});
  $('report').textContent = JSON.stringify(exportState(),null,2); updateSelection(); updateControls();
}
function exportState() { return { schema:2, scope:'stage-2-body-navigation', world:WORLD, bodyEnvelope:BODY, layout, route:navPlan??planPath(navigationModel(layout),rootPosition(),navTarget??{x:850,y:600}), legacyRoute:checkRoute(layout), navigationModel:navigationModel(layout), navigation:{id:navId,generation:navGeneration,target:navTarget,active:navActive,paused:navPaused}, horizontalAction:actionRoute(layout), measuredRaster:measurements, occlusion:occlusionOrder(layout.objects,current?.feet?.[0]?.y??layout.actor.y), asset:'/web/props/shell/asset.json', navigationImplemented:true }; }
function selectedRect() {
  if(selected==='actor')return footprint({x:current?.bodyX??layout.actor.x,y:current?.bodyY??layout.actor.y});
  if(selected==='shell') { const q=current?.owner==='ground'?current.groundQuad:current?.heldQuad;if(q){const xs=q.map(p=>p.x),ys=q.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:40,h:Math.max(...ys)-Math.min(...ys)};}return{x:layout.shell.x-20,y:layout.actor.y-33,w:40,h:33}; }
  if(selected==='destination')return{x:layout.destination-24,y:layout.actor.y-6,w:48,h:12};
  return layout.objects.find(o=>o.id===selected);
}
function updateSelection() {
  const r=selectedRect();if(!r)return;
  Object.assign($('selection').style,{display:'block',left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  $('selection').dataset.label = selected==='actor'?'180px 身体包络':selected==='shell'?'O03 · 40px':selected==='destination'?'贝壳落点':layout.objects.find(o=>o.id===selected).label;
}
function select(id) {
  selected=id;$('object-select').value=id;
  const r=layout.objects.find(o=>o.id===id),p=id==='actor'?rootPosition():id==='shell'?{x:layout.shell.x,y:layout.actor.y}:id==='destination'?{x:layout.destination,y:layout.actor.y}:r;
  $('edit-x').value=Math.round(p.x);$('edit-y').value=Math.round(p.y);$('edit-y').disabled=['shell','destination'].includes(id);
  $('edit-note').textContent=id==='actor'?'X / Y 编辑会复位动作，贝壳同属此水平平面。即时试摆不代表 x/y 导航。':id==='shell'||id==='destination'?'贝壳与落点沿当前操作平面摆放。离开待机后锁定编辑。':'拖动实体或输入左上角坐标；几何检查实时更新，实体隐藏后仍参与碰撞。';
  updateSelection();
}
const waitFor = (predicate, ms=12000) => new Promise((resolve,reject)=>{const start=performance.now();function check(){if(predicate())return resolve(current);if(performance.now()-start>ms)return reject(Error('等待真实动作帧超时'));setTimeout(check,30);}check();});
async function applyActor(x,y) {
  cancelNavigation('placement');navPlan=null;
  busyEdit=true;epoch++;pending=null;updateControls();
  try {
    layout.actor={x,y};const previous=current?.generation??0;
    body.set({bounds:bounds()});command({type:'reset',x});
    await waitFor(()=>current?.generation>previous&&current.phase==='idle');
    body.place(x,1);command({type:'relocate',x:layout.shell.x});
    await waitFor(()=>Math.abs(current?.bodyX-x)<1&&Math.abs(current.groundQuad[2].y-y)<1&&Math.abs(current.groundGrip.x-layout.shell.x)<1);
    command({type:'destination',x:layout.destination});
  } finally {busyEdit=false;geometry();select(selected);if(current)document.documentElement.dataset.ready='true';}
}
async function place(id,x,y) {
  if(busyEdit||!current||current.phase!=='idle')return;
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  if(id==='actor') {x=Math.max(112,Math.min(968,x));y=Math.max(217,Math.min(640,y));await applyActor(x,y);}
  else if(id==='shell'){layout.shell.x=Math.max(125,Math.min(980,x));command({type:'relocate',x:layout.shell.x});}
  else if(id==='destination'){layout.destination=Math.max(125,Math.min(980,x));command({type:'destination',x:layout.destination});}
  else {const o=layout.objects.find(o=>o.id===id),before={x:o.x,y:o.y};o.x=Math.max(0,Math.min(WORLD.width-o.w,x));o.y=Math.max(0,Math.min(WORLD.height-o.h,y));
    if(navigationBusy()&&!checkPath(navigationModel(layout),[rootPosition(),rootPosition()]).passed){Object.assign(o,before);$('nav-bubble').textContent='摆放与当前身体重叠，已拒绝';geometry();return;}}

  layout.revision++;navPlan=null;if(navActive&&navTarget)navigateTo(navTarget);geometry();select(id);
}
function startDrag(e,id) {
  if(busyEdit||current?.phase!=='idle')return;if(id==='actor')cancelNavigation('drag');select(id);
  const obj=layout.objects.find(o=>o.id===id),p=id==='actor'?rootPosition():id==='shell'?{x:layout.shell.x,y:layout.actor.y}:obj;
  drag={id,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
}
function moveDrag(e) {
  if(!drag||e.pointerId!==drag.pointer)return;
  const scale=world.getBoundingClientRect().width/WORLD.width;
  if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<3&&!drag.moved)return;
  drag.moved=true;
  const x=Math.round(drag.x+(e.clientX-drag.startX)/scale), y=Math.round(drag.y+(e.clientY-drag.startY)/scale);
  $('edit-x').value=x;$('edit-y').value=drag.id==='shell'?layout.actor.y:y;
  if(drag.id==='actor'){
    const p={x:Math.max(112,Math.min(968,x)),y:Math.max(217,Math.min(640,y))};
    if(checkPath(navigationModel(layout),[rootPosition(),p]).passed){drag.lastValid=p;body.place2d(p);}else $('nav-bubble').textContent='拖动路径与完整身体冲突';
  }else void place(drag.id,x,y);
}
function endDrag(e) {if(!drag||drag.pointer!==e.pointerId)return;const {id,moved,lastValid}=drag;drag=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(e.type==='pointerup'&&moved)void place(id,id==='actor'?(lastValid?.x??rootPosition().x):Number($('edit-x').value),id==='actor'?(lastValid?.y??rootPosition().y):Number($('edit-y').value)).catch(fail);else select(id);}
function fail(error){$('action-status').textContent=error.message;world.dataset.error=error.message;}
function updateControls() {
  const idle=current?.phase==='idle', held=current?.phase==='held', paused=current?.phase==='paused', safe=actionSafe();
  for(const [id,enabled] of Object.entries({loop:idle&&safe&&!navigationBusy(),pickup:idle&&safe&&!navigationBusy(),drop:held&&safe,pause:current&&!idle&&!paused,resume:paused&&safe,step:paused&&!navActive&&!['approach','carry'].includes(current?.suspended),'reset-action':!!current,'apply-placement':idle,'reset-layout':idle,'object-select':idle,'edit-x':idle,'speed':!!current,'block-route':idle,'restore-route':idle}))$(id).disabled=busyEdit||!enabled;
  $('nav-cancel').disabled=busyEdit||!navActive;
  $('nav-pause').disabled=busyEdit||!navActive;
  $('nav-resume').disabled=busyEdit||!navPaused;
  $('nav-work').disabled=busyEdit||!idle;
  $('edit-y').disabled=busyEdit||!idle||['shell','destination'].includes(selected);
  for(const o of layout.objects){const el=document.querySelector(`[data-object="${o.id}"]`);if(el)el.disabled=busyEdit||!idle;}
  $('actor-hit').disabled=$('shell-hit').disabled=busyEdit||!idle;
}
function anchorSvg(v) {
  const dot=(p,label,color='#739c9b')=>p?`<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" stroke="#fff"/><text x="${p.x+7}" y="${p.y-5}" font-size="9" fill="${color}">${label}</text>`:'';
  return `${dot({x:v.bodyX,y:v.bodyY??layout.actor.y},'身体根 / feet')}${dot(v.hand,'手 / palm','#ae8d63')}${dot(v.owner==='ground'?v.groundGrip:v.heldGrip,'壳缘 / grip','#688cb4')}${(v.feet??[]).map((p,i)=>dot(p,`脚 ${i+1}`)).join('')}${BODY?svgRect(footprint({x:v.bodyX,y:v.bodyY??layout.actor.y}),'fill="none" stroke="#739c9b" stroke-dasharray="3 4"'):''}`;
}
async function paint(v,detail) {
  pending={v,detail,epoch};if(painting)return;painting=true;
  try {while(pending){const job=pending;pending=null;const bodyImage=new Image(),frontImage=new Image();bodyImage.src=job.detail.href;frontImage.src=job.detail.frontHref;await Promise.all([bodyImage.decode(),frontImage.decode()]);if(job.epoch!==epoch||job.v.generation!==current.generation)continue;
    drawComposite($('composition'),{frame:job.v,detail:job.detail,spec,shellImage,bodyImage,frontImage,width:WORLD.width,height:WORLD.height,floorY:job.v.bodyY??layout.actor.y,scale:2});
    const v=job.v;painted=v;world.dataset.painted=JSON.stringify({sequence:v.sequence,phase:v.phase,owner:v.owner,generation:v.generation,layers:['palm','shell','fingers']});
    // Measure actual decoded body/hand alpha in world coordinates, excluding the
    // ground prop and decorative shadow; require every tested frame to fit BODY.
    if(v.sequence%8===0){const cv=document.createElement('canvas');cv.width=WORLD.width;cv.height=WORLD.height;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.transform(...job.detail.matrix);const[x,y,x1,y1]=job.detail.view;for(const im of[bodyImage,frontImage])ctx.drawImage(im,x,y,x1-x,y1-y);const data=ctx.getImageData(0,0,cv.width,cv.height).data;let minX=cv.width,minY=cv.height,maxX=0,maxY=0;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(data[(y*cv.width+x)*4+3]>8){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(minX<=maxX){measurements.frames++;measurements.left=Math.max(measurements.left,v.bodyX-minX);measurements.right=Math.max(measurements.right,maxX-v.bodyX);measurements.top=Math.max(measurements.top,(v.bodyY??layout.actor.y)-minY);measurements.bottom=Math.max(measurements.bottom,maxY-(v.bodyY??layout.actor.y));}}
  }}catch(error){fail(error);}finally{painting=false;}
}
function onFrame(v) {
  const detail=v.detail;v={...v};delete v.detail;
  if(!v.handArt||!detail?.frontHref)return;
  if(v.navigation?.id===navId && v.navigation.revision===layout.revision && v.navigation.plan && JSON.stringify(v.navigation.plan.points)!==JSON.stringify(navPlan?.points)){navPlan=v.navigation.plan;geometry();}
  const before=current;current=v;if(!busyEdit)document.documentElement.dataset.ready='true';world.dataset.frame=JSON.stringify(v);
  if(v.owner==='hand')for(const p of v.heldQuad){measurements.left=Math.max(measurements.left,v.bodyX-p.x);measurements.right=Math.max(measurements.right,p.x-v.bodyX);measurements.top=Math.max(measurements.top,(v.bodyY??layout.actor.y)-p.y);measurements.bottom=Math.max(measurements.bottom,p.y-(v.bodyY??layout.actor.y));}
  if(v.owner==='ground'&&!busyEdit) layout.shell.x=v.groundGrip.x;
  measurements.binding=Math.max(measurements.binding,v.bindingError??0);if(v.owner!==v.renderedOwner)measurements.ownerMismatches++;
  if(!(v.handArt.layers.palm<v.handArt.layers.prop&&v.handArt.layers.prop<v.handArt.layers.fingers)||v.handArt.surfaceAlpha!==1)measurements.wrongLayers++;
  if(before&&before.generation===v.generation&&before.owner!==v.owner){const a=before.owner==='ground'?before.groundQuad:before.heldQuad,b=v.owner==='ground'?v.groundQuad:v.heldQuad;for(let i=0;i<3;i++)measurements.ownerSwitchJump=Math.max(measurements.ownerSwitchJump,Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y));}
  $('counts').textContent=`${v.commits.pickup} / ${v.commits.drop}`;$('binding').textContent=`${v.bindingError.toFixed(3)} px`;$('owner').textContent=v.owner==='ground'?'地面':'手中';
  $('phase-label').textContent=`${phases[v.phase]??v.phase} · ${Number($('speed').value)}×`;
  $('action-status').textContent=v.error?`接触暂停：${v.error}`:busyEdit?'编辑试摆中…':v.phase==='idle'?navigationBusy()?'正在沿完整身体路径行走；拿放在停稳并返回水平平面后可用。':!actionSafe()?'离开操作平面或实体冲突，请复位动作后拿放。':actionRoute(layout).passed?'点击“重复拿放”执行一次完整闭环，可继续重复；编辑对象后检查布局。':'操作平面与实体冲突，拿放已锁定。先移动对象或恢复样板。':v.phase==='paused'?'动作时钟与物件拥有权已冻结，可继续或在非行走阶段逐帧检查。':`${phases[v.phase]??v.phase} · 真实水平拿放，未执行二维导航`;
  const r=footprint({x:v.bodyX,y:current?.bodyY??layout.actor.y});Object.assign($('actor-hit').style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  const q=v.owner==='ground'?v.groundQuad:v.heldQuad;Object.assign($('shell-hit').style,{left:Math.min(...q.map(p=>p.x))-5+'px',top:Math.min(...q.map(p=>p.y))-5+'px',width:'50px',height:'42px'});
  $('anchors-layer').innerHTML=anchorSvg(v)+(document.getElementById('show-occlusion').checked?navigationModel(layout).obstacles.map(o=>svgRect(o,'fill="none" stroke="#b08e77" stroke-dasharray="4 3"')+svgRect(expanded(o),'fill="none" stroke="#b08e77" opacity=".22"')).join(''):'');
  $('occlusion-readout').textContent=$('show-occlusion').checked?occlusionOrder(layout.objects,rootPosition().y).join(' → '):'身体 / 掌部 → 贝壳 → 指尖\n场景实体按底缘深度排序';
  if(before?.phase!==v.phase&&v.phase==='idle')$('report').textContent=JSON.stringify(exportState(),null,2);
  const rank=new Map(occlusionOrder(layout.objects,v.bodyY??layout.actor.y).map((id,i)=>[id,10+i]));for(const o of layout.objects)document.querySelector(`[data-object="${o.id}"]`).style.zIndex=rank.get(o.id)??3;for(const id of ['composition','actor-hit','shell-hit'])$(id).style.zIndex=rank.get('body-shell-fingers');
  const bubble=body?.layout?.bubble;if(bubble){Object.assign($('nav-bubble').style,{left:bubble.x+'px',top:bubble.y+'px'});}
  $('nav-status').textContent=`${navPaused?'暂停 · 可从当前位置继续':navActive?`二维运动 · ${v.navigation?.phase??'规划'} · 操作 ${navId}`:'点选地面目标，或前往岗位'} · (${v.bodyX.toFixed(1)}, ${(v.bodyY??layout.actor.y).toFixed(1)})`;
  updateControls();updateSelection();if(!busyEdit)void paint(v,detail);
}
for(const o of layout.objects){const opt=document.createElement('option');opt.value=o.id;opt.textContent=o.label;$('object-select').append(opt);}
$('object-select').onchange=()=>select($('object-select').value);
$('apply-placement').onclick=()=>void place(selected,Number($('edit-x').value),Number($('edit-y').value)).catch(fail);
$('actor-hit').onpointerdown=e=>startDrag(e,'actor');$('shell-hit').onpointerdown=e=>startDrag(e,'shell');for(const id of['actor-hit','shell-hit']){$(id).onpointermove=moveDrag;$(id).onpointerup=$(id).onpointercancel=endDrag;$(id).onclick=e=>{if(e.detail===0)select(id==='actor-hit'?'actor':'shell');};}
for(const id of['loop','pickup','drop','pause','resume','step'])$(id).onclick=()=>command({type:id});
$('speed').onchange=()=>command({type:'speed',value:Number($('speed').value)});
$('reset-action').onclick=()=>void applyActor(layout.actor.x,layout.actor.y).catch(fail);
$('reset-layout').onclick=async()=>{layout=freshLayout();navTarget=null;navPlan=null;blockedBackup=null;$('block-route').hidden=false;$('restore-route').hidden=true;await applyActor(layout.actor.x,layout.actor.y);geometry();};
$('show-zones').onchange=()=>$('zones').hidden=!$('show-zones').checked;
$('show-route').onchange=()=>$('route-layer').style.display=$('show-route').checked?'block':'none';
const showAnchors=()=>world.classList.toggle('anchors',$('show-anchors').checked||$('show-occlusion').checked);$('show-anchors').onchange=$('show-occlusion').onchange=showAnchors;
$('block-route').onclick=()=>{const o=layout.objects.find(o=>o.id==='planter');blockedBackup={x:o.x,y:o.y};void place('planter',600,450);$('block-route').hidden=true;$('restore-route').hidden=false;};
$('restore-route').onclick=()=>{if(blockedBackup)void place('planter',blockedBackup.x,blockedBackup.y);blockedBackup=null;$('block-route').hidden=false;$('restore-route').hidden=true;};
$('download').onclick=e=>{e.preventDefault();const url=URL.createObjectURL(new Blob([JSON.stringify(exportState(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='coopanion-space-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

function cancelNavigation(by){body?.cancelNavigation(by);navActive=false;navPaused=false;navGeneration++;}
function pauseNavigation(by='pause'){if(!navActive)return;body?.cancelNavigation(by);navActive=false;navPaused=true;navGeneration++;updateControls();}
function navigateTo(target){
  if(busyEdit||current?.phase!=='idle')return;
  if(!body?.capabilities.includes('navigation-2d-v1')){$('nav-status').textContent='当前角色仅支持 API 2 水平行走';return;}
  navTarget={...target};navPaused=false;navPlan=planPath(navigationModel(layout),rootPosition(),target);
  const id=++navId;navActive=navPlan.passed;
  body.navigate({id,generation:navGeneration,model:navigationModel(layout),target});geometry();
}
function onNavigationEvent(kind,value){
  history.push({kind,...value});if(history.length>400)history.shift();
  if(value.id!==navId||value.generation!==navGeneration||value.revision!==layout.revision)return;
  if(kind==='navigation-arrived'){navActive=false;$('nav-bubble').textContent='到啦';}
  else if(value.by!=='replaced'){navActive=false;$('nav-bubble').textContent=value.by==='lifecycle-gap'?'已暂停':`中断：${value.by}`;}
  updateControls();
}
$('nav-work').onclick=()=>navigateTo({x:850,y:600});
$('nav-cancel').onclick=()=>{cancelNavigation('cancel');updateControls();};
$('nav-pause').onclick=()=>pauseNavigation();
$('nav-resume').onclick=async()=>{command({type:'resume'});await waitFor(()=>current?.phase==='idle');if(navTarget)navigateTo(navTarget);};
world.addEventListener('click',e=>{if(e.target.closest('button,input,select'))return;const r=world.getBoundingClientRect(),scale=r.width/WORLD.width;navigateTo({x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale});});
function fit(){world.style.transform=`scale(${document.querySelector('.stage-wrap').clientWidth/WORLD.width})`;}
new ResizeObserver(fit).observe(document.querySelector('.stage-wrap'));fit();geometry();select('actor');
document.querySelector('details').ontoggle=e=>{if(e.target.open)$('report').textContent=JSON.stringify(exportState(),null,2);};
// Start the only clock before awaiting edit initialization. A reset is an
// explicit fresh setup, so the existing long-gap guard preserves this command.
let last=performance.now();function tick(now){if(body&&!document.hidden)body.tick(Math.min(.05,(now-last)/1000));last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
try {
  const pack=await(await fetch('/web/upstream/whale/figure.json')).json();Object.assign(pack,{base:'/docs/design/art-workflow/o03-shell-hands-v1/',entry:'figure.js',export:'createMotionBody',model:'scene-model.json'});
  body=await loadBody({layer:$('body-layer'),pack,start:{x:layout.actor.x,facing:1,scheme:'deepseek'},theme:'light',bounds:bounds(),onSound:()=>{},onError:fail,onEvent(kind,value){if(kind==='motion-frame')onFrame(value);if(kind.startsWith('navigation-'))onNavigationEvent(kind,value);if(kind==='motion-action'){history.push(value);if(history.length>400)history.shift();}}});
  await applyActor(layout.actor.x,layout.actor.y);
} catch(error){fail(error);document.documentElement.dataset.ready='error';}
addEventListener('pagehide',()=>body?.dispose());document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseNavigation('lifecycle');command({type:'pause'});}});
// Read-only inspection for reproducible browser evidence. No alternate motion API.
$('desktop-overlay').onclick=()=>{desktopOverlay=!desktopOverlay;$('desktop-overlay').textContent=`桌面穿透：${desktopOverlay?'开（角色可拖动）':'关'}`;};
addEventListener('keydown',e=>{if(e.key==='Escape'){desktopOverlay=false;$('desktop-overlay').textContent='桌面穿透：关';cancelNavigation('escape');}});
addEventListener('space-suspend',()=>{pauseNavigation('lifecycle');command({type:'pause'});});
window.spacePreview={nativeHit(p){if(!desktopOverlay||drag)return true;const r=world.getBoundingClientRect(),scale=r.width/WORLD.width;return body?.hit({x:(p.x-r.left)/scale,y:(p.y-r.top)/scale})??false;},snapshot:()=>structuredClone({...exportState(),frame:current,painted,events:history,bodyLayout:body?.layout,capabilities:body?.capabilities})};
