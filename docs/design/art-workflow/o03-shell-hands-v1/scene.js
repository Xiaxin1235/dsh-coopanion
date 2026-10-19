import { loadBody } from '/web/upstream/body-host.js';
import { drawComposite } from './composition.js';
const $ = id => document.getElementById(id), stage = $('stage');
const spec = await (await fetch('/web/props/shell/asset.json')).json(), b = spec.visibleBounds;
const shellImage = new Image(); shellImage.src='/web/props/shell/shell.png'; await shellImage.decode();
$('crop').setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
const names = { idle: '准备好了', approach: '接近贝壳', settle: '收步站稳', look: '先看向贝壳', reach: '俯身伸手', grasp: '接触后抓住', lift: '起身抬起', held: '保持持物姿势', carry: '携带行走', settleDrop: '收步站稳', lower: '俯身放低', touch: '接触地面', release: '松手', retract: '手离开贝壳', rise: '收势起身', paused: '暂停在当前动作', inspect: '关键姿势检查' };
let body, lastFrame, ready = false, drag = null, qaActive = false, qaReport = null, qaWaiter = null;
const command = cmd => body?.set({ motionCommand: cmd });
const bounds = () => ({ W: stage.clientWidth, H: 390, floorY: 320, S: 180 / 256 });
const group = phase => ['approach', 'settle'].includes(phase) ? 'approach' : ['look', 'reach', 'grasp'].includes(phase) ? 'pickup' : ['lift', 'held', 'carry'].includes(phase) ? 'carry' : ['settleDrop', 'lower', 'touch', 'release', 'retract', 'rise'].includes(phase) ? 'drop' : '';
let pendingPaint=null, painting=false, paintEpoch=0;
async function paintComposition(value,detail) {
  pendingPaint={value,detail,epoch:paintEpoch}; if(painting) return; painting=true;
  try {
    while(pendingPaint) {
      const job=pendingPaint; pendingPaint=null;
      const bodyImage=new Image(), frontImage=new Image(); bodyImage.src=job.detail.href; frontImage.src=job.detail.frontHref;
      await Promise.all([bodyImage.decode(),frontImage.decode()]);
      if(job.epoch!==paintEpoch || job.value.generation!==lastFrame.generation) continue;
      const canvas=$('composition'), W=stage.clientWidth;
      drawComposite(canvas,{frame:job.value,detail:job.detail,spec,shellImage,bodyImage,frontImage,width:W});
      canvas.style.display='block';$('body-layer').style.visibility='hidden';$('ground').style.visibility='hidden';
      // The inspector copies this exact complete composite, including the same
      // prop surface before and after ownership changes. No independent repaint.
      $('detail-pet').removeAttribute('transform');$('detail-ground').style.visibility='hidden';
      for(const [key,n] of Object.entries({x:0,y:0,width:W,height:390,href:canvas.toDataURL('image/png')})) $('detail-body').setAttribute(key,n);
      stage.dataset.paintedFrame=JSON.stringify({sequence:job.value.sequence,generation:job.value.generation,phase:job.value.phase,owner:job.value.owner,closure:job.value.handArt.closure,layers:['palm','shell','fingers']});
    }
  } catch(error) { $('status').textContent='画面合成失败：'+error.message;stage.dataset.paintError=error.message; }
  finally {painting=false;}
}
function frame(value) {
  if (!Object.hasOwn(names, value.phase) || !value.groundQuad?.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return;
  const detail = value.detail;
  value = { ...value }; delete value.detail;
  const before = lastFrame;
  lastFrame = value; ready = true; document.documentElement.dataset.ready = 'true'; stage.dataset.frame = JSON.stringify(value);
  $('current-label').textContent = names[value.phase] + (value.phase === 'paused' ? ` · ${names[value.suspended]}` : '');
  $('owner-label').textContent = value.owner === 'ground' ? '贝壳在地面' : '贝壳随手携带';
  $('phase').textContent = `${value.phase} · ${value.elapsed.toFixed(2)}s`;
  $('counts').textContent = `${value.commits.pickup} / ${value.commits.drop}`;
  $('distance').textContent = value.contact ? `${value.contact.distance.toFixed(2)} / ${value.contact.groundDistance.toFixed(2)} px` : '—';
  $('binding').textContent = value.bindingError?.toFixed(3) + ' px';
  const hands = value.handArt;
  $('hand-state').textContent = hands?.enabled ? hands.weights.grip > .5 ? '握持' : hands.weights.release > .5 ? '松开' : hands.weights.reach > .5 ? '伸手' : '放松手' : '原手型对照';
  const idle = value.phase === 'idle', held = value.phase === 'held', paused = value.phase === 'paused', inspection = value.phase === 'inspect';
  $('loop').disabled = qaActive || !idle; $('pickup').disabled = qaActive || !idle; $('drop').disabled = qaActive || !held;
  $('pause').disabled = qaActive || idle || paused || inspection; $('resume').disabled = qaActive || !paused;
  $('step').disabled = qaActive || !paused || ['approach', 'carry'].includes(value.suspended);
  $('reset').disabled = qaActive; $('destination').disabled = qaActive || !(idle || held); $('speed').disabled = qaActive;
  $('qa-run').disabled = qaActive; for (const button of document.querySelectorAll('[data-pose]')) { button.disabled = qaActive; button.setAttribute('aria-pressed', String(value.inspection === button.dataset.pose)); }
  $('hand-art').disabled = qaActive || !(idle || inspection); $('hand-art').checked = !!hands?.enabled;
  $('status').textContent = value.error ? `动作暂停：${value.error}。检查接触或重置场景。` : inspection ? '当前为不计次数的试摆姿势；重置后可实际操作。' : paused ? '姿势与拥有权已保留。可继续，或在非行走阶段前进一帧。' : idle ? '可拖动地面贝壳，点击“完整拿放”观看闭环，也可分开操作。' : held ? '持物姿势保持中；选择落点后可带走并放下。' : `${names[value.phase]} · ${Number($('speed').value)}×`;
  for (const el of document.querySelectorAll('[data-group]')) el.classList.toggle('active', el.dataset.group === group(paused ? value.suspended : value.phase));
  const [p0, p1, p2] = value.groundQuad, w = spec.displayWidth, h = w * b.height / b.width;
  $('crop').setAttribute('width', w); $('crop').setAttribute('height', h);
  $('ground-transform').setAttribute('transform', `matrix(${(p1.x - p0.x) / w} ${(p1.y - p0.y) / w} ${(p2.x - p0.x) / h} ${(p2.y - p0.y) / h} ${p0.x} ${p0.y})`);
  const external = !!value.handArt?.externalProp;
  if(external && detail?.frontHref) paintComposition(value,detail);
  else { paintEpoch++;pendingPaint=null;$('composition').style.display='none';$('body-layer').style.visibility='visible'; }
  if (detail && value.hand) {
    $('detail').setAttribute('viewBox', `${value.hand.x - 28} ${value.hand.y - 25} 70 70`);
    if(!external) {
    $('detail-pet').setAttribute('transform', detail.transform);
    const [x0, y0, x1, y1] = detail.view;
    for (const [name, n] of Object.entries({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, href: detail.href })) $('detail-body').setAttribute(name, n);
    $('detail-ground').setAttribute('transform', $('ground-transform').getAttribute('transform'));
    $('detail-crop').setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
    $('detail-crop').setAttribute('width', w); $('detail-crop').setAttribute('height', h);
    $('detail-ground').style.visibility = value.owner === 'ground' ? 'visible' : 'hidden';
    }
  }
  $('ground').style.visibility = !external && value.owner === 'ground' ? 'visible' : 'hidden';
  $('shell-hit').hidden = value.owner !== 'ground' || inspection; $('shell-hit').disabled = qaActive || !idle;
  const xs = [p0.x, p1.x, p2.x, p1.x + p2.x - p0.x], ys = [p0.y, p1.y, p2.y, p1.y + p2.y - p0.y];
  Object.assign($('shell-hit').style, { left: Math.min(...xs) - 6 + 'px', top: Math.min(...ys) - 6 + 'px', width: Math.max(...xs) - Math.min(...xs) + 12 + 'px', height: Math.max(...ys) - Math.min(...ys) + 12 + 'px' });
  if (value.hand) { $('hand-dot').setAttribute('cx', value.hand.x); $('hand-dot').setAttribute('cy', value.hand.y); }
  const grip = value.owner === 'ground' ? value.groundGrip : value.heldGrip;
  if (grip) { $('grip-dot').setAttribute('cx', grip.x); $('grip-dot').setAttribute('cy', grip.y); }
  $('target').style.left = value.destinationX - 34 + 'px';
  if (qaActive && qaReport?.collecting) {
    qaReport.frames++; qaReport.phases[value.phase] = (qaReport.phases[value.phase] ?? 0) + 1;
    if (value.owner !== value.renderedOwner) qaReport.ownershipMismatches++;
    if (value.owner === 'hand') qaReport.maxBindingError = Math.max(qaReport.maxBindingError, value.bindingError);
    if (value.pose?.plant && value.pose.plantWeight >= .999 && !value.inspection) for (const foot of value.feet ?? []) qaReport.maxPlantedFootError = Math.max(qaReport.maxPlantedFootError, Math.abs(foot.y - bounds().floorY));
    qaReport.maxSit = Math.max(qaReport.maxSit, value.sit ?? 0);
    if (!hands?.enabled) qaReport.missingHandFrames++;
    else {
      qaReport.maxWristError = Math.max(qaReport.maxWristError, hands.wristError);
      qaReport.maxArtContactError = Math.max(qaReport.maxArtContactError, hands.contactError);
      if(hands.renderMode!=='continuous-mesh' || hands.surfaceAlpha!==1 || !hands.externalProp) qaReport.badSurfaceFrames++;
      if (!(hands.layers.palm < hands.layers.prop && hands.layers.prop < hands.layers.fingers)) qaReport.badLayerFrames++;
      qaReport.maxCoverageError = Math.max(qaReport.maxCoverageError, Math.abs(Object.values(hands.weights).reduce((a, n) => a + n, 0) - 1));
    }
    if (before && before.generation === value.generation) {
      if (before.owner !== value.owner) {
        const oldQuad = before.owner === 'ground' ? before.groundQuad : before.heldQuad;
        const newQuad = value.owner === 'ground' ? value.groundQuad : value.heldQuad;
        for (let i = 0; i < 3; i++) qaReport.maxOwnerSwitchJump = Math.max(qaReport.maxOwnerSwitchJump, Math.hypot(oldQuad[i].x - newQuad[i].x, oldQuad[i].y - newQuad[i].y));
      }
      if (value.pose?.plantWeight === 1 && before.pose?.plantWeight === 1 && !value.moving && !before.moving && !['idle', 'paused'].includes(value.phase) && Math.abs(value.visualFacing - before.visualFacing) < .001) {
        qaReport.maxStationaryHandStep = Math.max(qaReport.maxStationaryHandStep, Math.hypot(value.hand.x - before.hand.x, value.hand.y - before.hand.y));
      }
    }
    if (value.phase !== qaReport.samples.at(-1)?.phase) qaReport.samples.push(value);
  }
  if (qaWaiter?.predicate(value)) { const waiter = qaWaiter; qaWaiter = null; clearTimeout(waiter.timer); waiter.resolve(value); }
}
for (const type of ['loop', 'pickup', 'drop', 'pause', 'resume', 'reset', 'step']) $(type).onclick = () => command({ type });
for (const button of document.querySelectorAll('[data-pose]')) button.onclick = () => command({ type: 'inspect', pose: button.dataset.pose });
$('speed').onchange = () => command({ type: 'speed', value: Number($('speed').value) });
$('destination').oninput = () => command({ type: 'destination', x: stage.clientWidth * Number($('destination').value) / 100 });
$('anchors').onchange = () => document.querySelector('.markers').style.visibility = $('anchors').checked ? 'visible' : 'hidden';
$('hand-art').onchange = () => command({ type: 'hand-art', enabled: $('hand-art').checked });
$('focus-view').onclick = () => { const focused = document.body.classList.toggle('focused'); $('focus-view').textContent = focused ? '返回全页' : '专注预览'; };
for (const button of document.querySelectorAll('[data-theme]')) button.onclick = () => { stage.classList.toggle('dark', button.dataset.theme === 'dark'); for (const el of document.querySelectorAll('[data-theme]')) el.setAttribute('aria-pressed', String(el === button)); };
$('shell-hit').onpointerdown = e => { if (qaActive || lastFrame?.phase !== 'idle') return; drag = { id: e.pointerId, start: e.clientX, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); };
$('shell-hit').onpointermove = e => { if (!drag || e.pointerId !== drag.id) return; if (Math.abs(e.clientX - drag.start) > 3) drag.moved = true; if (drag.moved) command({ type: 'relocate', x: e.clientX - stage.getBoundingClientRect().left }); };
const release = e => { if (!drag || drag.id !== e.pointerId) return; const moved = drag.moved; drag = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); if (!moved && e.type === 'pointerup') command({ type: 'pickup' }); };
$('shell-hit').onpointerup = $('shell-hit').onpointercancel = release;
$('shell-hit').onclick = e => { if (e.detail === 0) command({ type: 'pickup' }); };
try {
  const pack = await (await fetch('/web/upstream/whale/figure.json')).json();
  Object.assign(pack, { base: '/docs/design/art-workflow/o03-shell-hands-v1/', entry: 'figure.js', export: 'createMotionBody', model: 'scene-model.json' });
  body = await loadBody({ layer: $('body-layer'), pack, start: { x: stage.clientWidth * .22, facing: 1, scheme: 'deepseek' }, theme: 'dark', bounds: bounds(), onSound: () => {},
    onEvent(kind, value) {
      if (kind === 'motion-frame') frame(value);
      if (kind === 'motion-action') {
        if (qaActive) qaReport.events.push(value);
        const li = document.createElement('li'); li.textContent = `${value.activeTime.toFixed(2)}s · ${value.type}${value.phase ? ' → ' + value.phase : ''} · ${value.owner} · ${value.commits.pickup}/${value.commits.drop}`;
        $('trace').prepend(li); while ($('trace').children.length > 80) $('trace').lastChild.remove();
      }
    }, onError: error => $('status').textContent = error.message });
  let last = performance.now();
  function tick(now) { if (!document.hidden) body.tick(Math.min(.05, (now - last) / 1000)); last = now; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  let width = stage.clientWidth; new ResizeObserver(() => { if (width !== stage.clientWidth) { width = stage.clientWidth; body.set({ bounds: bounds() }); } }).observe(stage);
} catch (error) { $('status').textContent = '加载失败：' + error.message; document.documentElement.dataset.ready = 'error'; }
addEventListener('pagehide', () => body?.dispose()); document.addEventListener('visibilitychange', () => { if (document.hidden) command({ type: 'pause' }); });
function waitFrame(label, predicate) {
  $('qa-status').textContent = label;
  if (lastFrame && predicate(lastFrame)) return Promise.resolve(lastFrame);
  return new Promise((resolve, reject) => { qaWaiter = { predicate, resolve, timer: setTimeout(() => { qaWaiter = null; reject(new Error('超时：' + label)); }, lastFrame?.speed===.25 ? 60000 : 30000) }; });
}
function check(value, label) { if (!value) throw new Error(label); qaReport.checks.push(label); }
$('qa-run').onclick = async () => {
  if (!ready || qaActive) return; qaActive = true;
  qaReport = { passed: false, collecting: false, profile: 'o03-pick-place-hands-01', frames: 0, phases: {}, samples: [], events: [], checks: [], maxBindingError: 0, maxPlantedFootError: 0, maxOwnerSwitchJump: 0, maxStationaryHandStep: 0, maxSit: 0, ownershipMismatches: 0, maxWristError: 0, maxArtContactError: 0, maxCoverageError: 0, missingHandFrames: 0, badLayerFrames: 0, badSurfaceFrames:0, assetSha256: spec.sha256 };
  try {
    $('speed').value = '1'; command({ type: 'speed', value: 1 });
    const generation = lastFrame.generation; command({ type: 'reset' }); await waitFrame('重置场景', s => s.generation > generation && s.phase === 'idle');
    command({ type: 'hand-art', enabled: true });
    await waitFrame('确认连续手部网格已加载', s => s.handArt?.enabled);
    qaReport.collecting = true;
    for (let index = 0; index < 3; index++) {
      const destination = index === 1 ? .30 : .78; $('destination').value = String(destination * 100); command({ type: 'destination', x: stage.clientWidth * destination });
      if(index===2) { $('speed').value='0.25';command({type:'speed',value:.25}); }
      command({ type: 'loop' });
      if (index === 0) {
        await waitFrame('俯身时暂停', s => s.phase === 'reach' && s.elapsed > .35); command({ type: 'pause' });
        const paused = await waitFrame('保存中断姿势', s => s.phase === 'paused');
        check(paused.owner === 'ground' && paused.commits.pickup === 0, '接触前打断保持地面拥有权');
        command({ type: 'step' }); const stepped = await waitFrame('暂停中前进一帧', s => s.phase === 'paused' && s.activeTime > paused.activeTime);
        check(stepped.elapsed > paused.elapsed && stepped.elapsed - paused.elapsed < .018, '逐帧推进一次保持暂停');
        command({ type: 'resume' });
        const carry = await waitFrame('携带途中暂停', s => s.phase === 'carry' && s.elapsed > .3 && s.walkId);
        command({ type: 'pause' }); const heldPause = await waitFrame('暂停保留手中贝壳', s => s.phase === 'paused');
        check(heldPause.owner === 'hand' && heldPause.commits.drop === 0, '携带打断保留物件');
        command({ type: 'resume' }); const fresh = await waitFrame('携带恢复新身份', s => s.phase === 'carry' && s.walkId);
        check(fresh.walkId !== carry.walkId, '恢复携带使用新 walkId');
      }
      if (index === 1) {
        await waitFrame('指尖正在闭合', s => s.phase === 'grasp' && s.elapsed > .04);
        command({ type: 'pause' }); const halfGrasp = await waitFrame('闭合途中暂停', s => s.phase === 'paused');
        check(halfGrasp.owner === 'ground' && halfGrasp.handArt.weights.grip > 0 && halfGrasp.handArt.weights.grip < .98, '指尖未闭合时暂停不拿起');
        const frozenGrasp = await waitFrame('确认指尖姿势冻结', s => s.phase === 'paused' && s.sequence > halfGrasp.sequence + 2);
        check(JSON.stringify(frozenGrasp.handArt.weights) === JSON.stringify(halfGrasp.handArt.weights), '闭合中断保持同一手型混合');
        command({ type: 'resume' });
        await waitFrame('指尖正在松开', s => s.phase === 'release' && s.elapsed > .03);
        command({ type: 'pause' }); const halfRelease = await waitFrame('松手途中暂停', s => s.phase === 'paused');
        check(halfRelease.owner === 'hand' && halfRelease.commits.drop === 1 && halfRelease.handArt.weights.release > 0 && halfRelease.handArt.weights.release < .98, '张手未完成时保持手中拥有权');
        const frozenRelease = await waitFrame('确认松手姿势冻结', s => s.phase === 'paused' && s.sequence > halfRelease.sequence + 2);
        check(JSON.stringify(frozenRelease.handArt.weights) === JSON.stringify(halfRelease.handArt.weights), '松手中断保持同一手型混合');
        command({ type: 'resume' });
      }
      if(index===2) {
        await waitFrame('0.25× 闭合中帧',s=>s.phase==='grasp'&&s.elapsed>.07);command({type:'pause'});
        const paused=await waitFrame('慢放闭合途中暂停',s=>s.phase==='paused');
        check(paused.owner==='ground'&&paused.speed===.25&&paused.handArt.closure>0&&paused.handArt.closure<.98,'0.25× 闭合中帧保持不透明手型与地面拥有权');
        const frozen=await waitFrame('慢放暂停冻结网格',s=>s.phase==='paused'&&s.sequence>paused.sequence+2);
        check(frozen.handArt.closure===paused.handArt.closure&&frozen.handArt.surfaceAlpha===1,'慢放暂停保持相同网格形状与透明度');
        command({type:'step'});const stepped=await waitFrame('慢放前进一步',s=>s.phase==='paused'&&s.activeTime>paused.activeTime);
        check(stepped.handArt.closure>paused.handArt.closure&&stepped.elapsed-paused.elapsed<.018,'慢放逐帧只前进一个动作帧');
        qaReport.slowSamples={paused,stepped};command({type:'resume'});
        await waitFrame('0.25× 松手中帧',s=>s.phase==='release'&&s.elapsed>.055);command({type:'pause'});
        const releasing=await waitFrame('慢放松手途中暂停',s=>s.phase==='paused');
        check(releasing.owner==='hand'&&releasing.commits.drop===2&&releasing.handArt.closure>0&&releasing.handArt.closure<1,'0.25× 松手中帧保持持有至手指张开');
        qaReport.slowSamples.releasing=releasing;command({type:'resume'});
      }
      const done = await waitFrame(`第 ${index + 1} 轮拿放完成`, s => s.phase === 'idle' && s.commits.drop === index + 1);
      check(done.commits.pickup === index + 1 && done.owner === 'ground', `第 ${index + 1} 轮恰好拿放一次`);
      const placed = done.groundQuad[2].x + (done.groundQuad[1].x - done.groundQuad[0].x) * .5;
      check(Math.abs(placed - stage.clientWidth * destination) < 2, `第 ${index + 1} 轮实际物件落在指定位置`);
    }
    const events = qaReport.events, picked = events.filter(e => e.type === 'pickup'), dropped = events.filter(e => e.type === 'drop');
    check(picked.length === 3 && picked.every(e => e.contact.distance <= 1.5), '三次拿起均经过真实稳定接触');
    check(dropped.length === 3 && dropped.every(e => e.contact.groundDistance <= 1.5), '三次放下均先接触地面');
    check(picked.every(e => e.handArt?.enabled && e.handArt.weights.grip >= .98), '实际绘制握持手型后才提交拿起');
    check(dropped.every(e => e.handArt?.enabled && e.handArt.weights.release >= .98), '实际绘制张手手型后才提交释放');
    for (const phase of ['settle', 'look', 'reach', 'grasp', 'lift', 'held', 'carry', 'settleDrop', 'lower', 'touch', 'release', 'retract', 'rise']) check(qaReport.phases[phase] > 0, `实际经过 ${names[phase]}`);
    check(qaReport.maxSit < .001, '全过程未切换坐地模型');
    check(qaReport.maxPlantedFootError < .1, '俯身与起身期间脚底不滑离地面');
    check(qaReport.maxBindingError < .01 && qaReport.ownershipMismatches === 0, '持物绑定与显示拥有权一致');
    check(qaReport.maxOwnerSwitchJump < 1.5, '拿起和松手切换时物件跳变小于1.5px');
    check(qaReport.maxStationaryHandStep < 3, '站定动作的手部逐帧位移小于3px');
    check(qaReport.maxWristError < .01 && qaReport.maxArtContactError < .01, '连续手部网格保持实际腕部与抓握锚点');
    check(qaReport.maxCoverageError < .001 && qaReport.missingHandFrames === 0, '姿势权重连续且手部能力始终可用');
    check(qaReport.badSurfaceFrames===0 && !stage.dataset.paintError,'全过程使用不透明连续网格与统一物件合成层');
    check(qaReport.badLayerFrames === 0, '手掌与指尖始终分处贝壳前后');
    qaReport.passed = true; $('qa-status').textContent = `通过 ${qaReport.checks.length} 项 · 三轮拿放`;
  } catch (error) { qaReport.error = error.message; $('qa-status').textContent = '未通过：' + error.message; }
  finally { $('speed').value='1';command({type:'speed',value:1});qaActive = false; $('qa-report').textContent = JSON.stringify(qaReport, null, 2); }
};
