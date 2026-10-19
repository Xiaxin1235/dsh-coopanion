import { loadBody } from '/web/upstream/body-host.js';
const $=id=>document.getElementById(id),stage=$('stage');
const spec=await(await fetch('/web/props/shell/asset.json')).json(),bounds=spec.visibleBounds;
$('crop').setAttribute('viewBox',`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
let body=null,lastFrame=null,drag=null,ready=false,qaActive=false,qaWaiter=null,qaReport=null;
const labels={idle:'可以点击贝壳，或拖动它后再让角色拿起。',approach:'正在走近贝壳，等待真实抵达。',reach:'正在对齐手部，接触稳定后才提交拿起。',lift:'已经拿起，正在起身。',held:'贝壳由手部持有，可以选择落点并放下。',carry:'正在携带，贝壳跟随实际手臂变形。',lower:'正在放低手臂，接近地面后才释放。',release:'已经放下，正在收手起身。',paused:'动作已打断，物件拥有权和目标仍保留。'};
function command(value){body?.set({propCommand:value});}
function frame(value){
  if(!['idle','approach','reach','lift','held','carry','lower','release','paused'].includes(value.phase)||!['ground','hand'].includes(value.owner))return;
  if(!value.groundQuad?.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return;
  lastFrame=value;ready=true;document.documentElement.dataset.ready='true';stage.dataset.phase=value.phase;stage.dataset.owner=value.owner;stage.dataset.frame=JSON.stringify(value);
  $('phase').textContent=value.phase;$('owner').textContent=value.owner;$('counts').textContent=`${value.commits.pickup} / ${value.commits.drop}`;
  $('distance-label').textContent=value.owner==='hand'?'持物手部绑定误差':'拿起前对齐误差';
  $('distance').textContent=value.contact?(value.owner==='hand'?value.bindingError:value.contact.distance).toFixed(2)+' px':'—';
  const quadGroundY=value.groundQuad[2].y+(value.groundQuad[1].y-value.groundQuad[0].y)*spec.ground.x;
  $('ground-distance').textContent=value.contact?(value.owner==='hand'?value.contact.groundDistance:Math.abs(quadGroundY-310)).toFixed(2)+' px':'—';
  $('identity').textContent=`${value.generation} / ${value.walkId??'—'}`;$('status').textContent=value.error?`无法继续：${value.error}。可重置或重新摆放。`:labels[value.phase];
  $('pickup').disabled=qaActive||value.phase!=='idle';$('drop').disabled=qaActive||value.phase!=='held';$('pause').disabled=qaActive||['idle','paused'].includes(value.phase);$('resume').disabled=qaActive||value.phase!=='paused';$('reset').disabled=qaActive;$('destination').disabled=qaActive||!['idle','held'].includes(value.phase);
  const [p0,p1,p2]=value.groundQuad,w=spec.displayWidth,h=w*bounds.height/bounds.width;
  $('crop').setAttribute('width',w);$('crop').setAttribute('height',h);
  $('ground-transform').setAttribute('transform',`matrix(${(p1.x-p0.x)/w} ${(p1.y-p0.y)/w} ${(p2.x-p0.x)/h} ${(p2.y-p0.y)/h} ${p0.x} ${p0.y})`);
  $('ground').style.visibility=value.owner==='ground'?'visible':'hidden';$('shell-hit').hidden=value.owner!=='ground';$('shell-hit').disabled=qaActive;
  const xs=[p0.x,p1.x,p2.x,p1.x+p2.x-p0.x],ys=[p0.y,p1.y,p2.y,p1.y+p2.y-p0.y];
  Object.assign($('shell-hit').style,{left:Math.min(...xs)-4+'px',top:Math.min(...ys)-4+'px',width:Math.max(...xs)-Math.min(...xs)+8+'px',height:Math.max(...ys)-Math.min(...ys)+8+'px'});
  if(value.grip){$('hand-dot').setAttribute('cx',value.grip.x);$('hand-dot').setAttribute('cy',value.grip.y);}
  const shownGrip=value.owner==='hand'?value.heldGrip:value.groundGrip;
  $('grip-dot').setAttribute('cx',shownGrip.x);$('grip-dot').setAttribute('cy',shownGrip.y);
  $('target').style.left=value.destinationX-37+'px';
  $('qa-run').disabled=qaActive;
  if(qaActive&&qaReport){
    qaReport.frames++;
    if(value.owner==='hand')qaReport.maxBindingError=Math.max(qaReport.maxBindingError,value.bindingError);
    if(value.owner!==value.renderedOwner)qaReport.ownershipFrameMismatches++;
  }
  if(qaWaiter&&qaWaiter.predicate(value)){const w=qaWaiter;qaWaiter=null;clearTimeout(w.timer);w.resolve(value);}
}
for(const type of ['pickup','drop','pause','resume','reset'])$(type).onclick=()=>command({type});
$('destination').oninput=()=>command({type:'destination',x:stage.clientWidth*Number($('destination').value)/100});
$('anchors').onchange=()=>document.querySelector('.markers').style.visibility=$('anchors').checked?'visible':'hidden';
for(const button of document.querySelectorAll('[data-theme]'))button.onclick=()=>{stage.classList.toggle('dark',button.dataset.theme==='dark');for(const b of document.querySelectorAll('[data-theme]'))b.setAttribute('aria-pressed',String(b===button));};
$('shell-hit').addEventListener('pointerdown',e=>{if(qaActive||!ready||lastFrame.owner!=='ground')return;drag={id:e.pointerId,start:e.clientX,moved:false};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();});
$('shell-hit').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.abs(e.clientX-drag.start)>3)drag.moved=true;if(drag.moved)command({type:'relocate',x:e.clientX-stage.getBoundingClientRect().left});});
function release(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!moved&&e.type==='pointerup')command({type:'pickup'});}
$('shell-hit').addEventListener('pointerup',release);$('shell-hit').addEventListener('pointercancel',release);$('shell-hit').addEventListener('click',e=>{if(e.detail===0)command({type:'pickup'});});
const stageBounds=()=>({W:stage.clientWidth,H:380,floorY:310,S:180/256});
try{
  const pack=await(await fetch('/web/upstream/whale/figure.json')).json();Object.assign(pack,{base:'/docs/design/art-workflow/o03-shell-interaction-v1/',entry:'figure.js',export:'createShellBody',model:'scene-model.json'});
  body=await loadBody({layer:$('body-layer'),pack,start:{x:stage.clientWidth*.2,facing:1,scheme:'deepseek'},theme:'light',bounds:stageBounds(),onSound:()=>{},
    onEvent:(kind,value)=>{if(kind==='prop-frame')frame(value);if(kind==='prop-action'){if(qaActive&&qaReport)qaReport.events.push(value);const li=document.createElement('li');li.dataset.event=JSON.stringify(value);li.textContent=`${value.generation} · ${value.action} · ${value.owner} · ${value.pickups}/${value.drops}`+(value.action==='pickup'?` · 对齐 ${value.contactDistance.toFixed(2)}px`:value.action==='drop'?` · 离地 ${value.groundDistance.toFixed(2)}px`:'');$('trace').prepend(li);while($('trace').children.length>30)$('trace').lastChild.remove();}},onError:error=>{$('status').textContent=error.message;}});
  let last=performance.now();function tick(now){if(!document.hidden){body.tick(Math.min(.05,(now-last)/1000));}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  new ResizeObserver(()=>body.set({bounds:stageBounds()})).observe(stage);
}catch(error){$('status').textContent='加载失败：'+error.message;document.documentElement.dataset.ready='error';}
addEventListener('pagehide',()=>body?.dispose());document.addEventListener('visibilitychange',()=>{if(document.hidden)command({type:'pause'});});

function waitFrame(label,predicate){
  $('qa-status').textContent=label;
  if(lastFrame&&predicate(lastFrame))return Promise.resolve(lastFrame);
  return new Promise((resolve,reject)=>{qaWaiter={predicate,resolve,timer:setTimeout(()=>{qaWaiter=null;reject(new Error('超时：'+label));},20000)};});
}
function check(condition,label){if(!condition)throw new Error(label);qaReport.checks.push(label);}
$('qa-run').onclick=async()=>{
  if(!ready||qaActive)return;qaActive=true;$('qa-run').disabled=true;
  qaReport={passed:false,frames:0,maxBindingError:0,ownershipFrameMismatches:0,checks:[],events:[],assetSha256:spec.sha256};
  try{
    const old=lastFrame.generation;command({type:'reset'});await waitFrame('重置并建立新代次',s=>s.generation>old&&s.phase==='idle');
    command({type:'pickup'});const approach=await waitFrame('走近后打断',s=>s.phase==='approach'&&!!s.walkId);
    command({type:'pause'});const stopped=await waitFrame('确认地面拥有权',s=>s.phase==='paused');check(stopped.owner==='ground'&&stopped.commits.pickup===0,'到达前打断不拿起');
    command({type:'resume'});const resumed=await waitFrame('恢复使用新移动身份',s=>s.phase==='approach'&&!!s.walkId);check(resumed.walkId!==approach.walkId,'恢复使用新 walkId');
    let held=await waitFrame('等待真实接触与拿起',s=>s.phase==='held');check(held.owner==='hand'&&held.commits.pickup===1,'稳定接触后恰好拿起一次');
    command({type:'drop'});const carrying=await waitFrame('实际携带移动后打断',s=>s.phase==='carry'&&Math.abs(s.bodyX-held.bodyX)>8);
    command({type:'pause'});const paused=await waitFrame('确认持物不脱离',s=>s.phase==='paused');check(paused.owner==='hand'&&paused.commits.drop===0,'携带中打断保留物件');
    command({type:'resume'});const fresh=await waitFrame('继续原放置目标',s=>s.phase==='carry'&&!!s.walkId);check(fresh.walkId!==carrying.walkId,'携带恢复拒绝旧移动身份');
    let ground=await waitFrame('等待真实落地后释放',s=>s.phase==='idle'&&s.commits.drop===1);check(ground.owner==='ground'&&ground.commits.pickup===1,'第一次放下只结算一次');
    command({type:'pickup'});held=await waitFrame('从实际放下的姿态再次拿起',s=>s.phase==='held'&&s.commits.pickup===2);check(held.owner==='hand','旋转后的地面物件可以再次拿起');
    $('destination').value='60';command({type:'destination',x:stage.clientWidth*.6});command({type:'drop'});ground=await waitFrame('第二次放回不同落点',s=>s.phase==='idle'&&s.commits.drop===2);
    check(ground.commits.pickup===2&&ground.owner==='ground','两次拿放各结算两次');
    command({type:'relocate',x:stage.clientWidth*.44});await waitFrame('重定位保持单一地面物件',s=>s.phase==='idle'&&Math.abs((s.groundQuad[0].x+s.groundQuad[1].x)/2-stage.clientWidth*.44)<2);
    check(lastFrame.commits.pickup===2&&lastFrame.commits.drop===2,'摆放物件不增加拿放次数');
    check(qaReport.events.filter(e=>e.action==='pickup').every(e=>e.contactDistance<=2),'每次提交拿起的接触误差 ≤2px');
    check(qaReport.events.filter(e=>e.action==='drop').every(e=>e.groundDistance<=2),'每次提交放下的距地误差 ≤2px');
    check(qaReport.maxBindingError<.01,'整个携带期间手部绑定误差 <0.01px');check(qaReport.ownershipFrameMismatches===0,'拥有权与绘制层始终一致');
    qaReport.passed=true;$('qa-status').textContent=`通过 ${qaReport.checks.length} 项检查 · ${qaReport.frames} 个实际身体帧`;
  }catch(error){qaReport.error=error.message;$('qa-status').textContent='未通过：'+error.message;}
  finally{qaActive=false;$('qa-report').textContent=JSON.stringify(qaReport,null,2);$('qa-run').disabled=false;}
};
