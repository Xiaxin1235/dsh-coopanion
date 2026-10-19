import { loadBody } from '/web/upstream/body-host.js';
const $ = id => document.getElementById(id), stage = $('stage');
const spec = await (await fetch('/web/props/shell/asset.json')).json(), b = spec.visibleBounds;
$('crop').setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
const names = { idle: '准备好了', approach: '接近贝壳', settle: '收步站稳', look: '先看向贝壳', reach: '俯身伸手', grasp: '接触后抓住', lift: '起身抬起', held: '保持持物姿势', carry: '携带行走', settleDrop: '收步站稳', lower: '俯身放低', touch: '接触地面', release: '松手', retract: '手离开贝壳', rise: '收势起身', paused: '暂停在当前动作', inspect: '关键姿势检查' };
let body, lastFrame, ready = false, drag = null, qaActive = false, qaReport = null, qaWaiter = null;
const command = cmd => body?.set({ motionCommand: cmd });
const bounds = () => ({ W: stage.clientWidth, H: 390, floorY: 320, S: 180 / 256 });
const group = phase => ['approach', 'settle'].includes(phase) ? 'approach' : ['look', 'reach', 'grasp'].includes(phase) ? 'pickup' : ['lift', 'held', 'carry'].includes(phase) ? 'carry' : ['settleDrop', 'lower', 'touch', 'release', 'retract', 'rise'].includes(phase) ? 'drop' : '';
function frame(value) {
  if (!Object.hasOwn(names, value.phase) || !value.groundQuad?.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return;
  const before = lastFrame;
  lastFrame = value; ready = true; document.documentElement.dataset.ready = 'true'; stage.dataset.frame = JSON.stringify(value);
  $('current-label').textContent = names[value.phase] + (value.phase === 'paused' ? ` · ${names[value.suspended]}` : '');
  $('owner-label').textContent = value.owner === 'ground' ? '贝壳在地面' : '贝壳随手携带';
  $('phase').textContent = `${value.phase} · ${value.elapsed.toFixed(2)}s`;
  $('counts').textContent = `${value.commits.pickup} / ${value.commits.drop}`;
  $('distance').textContent = value.contact ? `${value.contact.distance.toFixed(2)} / ${value.contact.groundDistance.toFixed(2)} px` : '—';
  $('binding').textContent = value.bindingError?.toFixed(3) + ' px';
  const idle = value.phase === 'idle', held = value.phase === 'held', paused = value.phase === 'paused', inspection = value.phase === 'inspect';
  $('loop').disabled = qaActive || !idle; $('pickup').disabled = qaActive || !idle; $('drop').disabled = qaActive || !held;
  $('pause').disabled = qaActive || idle || paused || inspection; $('resume').disabled = qaActive || !paused;
  $('step').disabled = qaActive || !paused || ['approach', 'carry'].includes(value.suspended);
  $('reset').disabled = qaActive; $('destination').disabled = qaActive || !(idle || held); $('speed').disabled = qaActive;
  $('qa-run').disabled = qaActive; for (const button of document.querySelectorAll('[data-pose]')) { button.disabled = qaActive; button.setAttribute('aria-pressed', String(value.inspection === button.dataset.pose)); }
  $('status').textContent = value.error ? `动作暂停：${value.error}。检查接触或重置场景。` : inspection ? '当前为不计次数的试摆姿势；重置后可实际操作。' : paused ? '姿势与拥有权已保留。可继续，或在非行走阶段前进一帧。' : idle ? '可拖动地面贝壳，点击“完整拿放”观看闭环，也可分开操作。' : held ? '持物姿势保持中；选择落点后可带走并放下。' : `${names[value.phase]} · ${Number($('speed').value)}×`;
  for (const el of document.querySelectorAll('[data-group]')) el.classList.toggle('active', el.dataset.group === group(paused ? value.suspended : value.phase));
  const [p0, p1, p2] = value.groundQuad, w = spec.displayWidth, h = w * b.height / b.width;
  $('crop').setAttribute('width', w); $('crop').setAttribute('height', h);
  $('ground-transform').setAttribute('transform', `matrix(${(p1.x - p0.x) / w} ${(p1.y - p0.y) / w} ${(p2.x - p0.x) / h} ${(p2.y - p0.y) / h} ${p0.x} ${p0.y})`);
  $('ground').style.visibility = value.owner === 'ground' ? 'visible' : 'hidden';
  $('shell-hit').hidden = value.owner !== 'ground' || inspection; $('shell-hit').disabled = qaActive || !idle;
  const xs = [p0.x, p1.x, p2.x, p1.x + p2.x - p0.x], ys = [p0.y, p1.y, p2.y, p1.y + p2.y - p0.y];
  Object.assign($('shell-hit').style, { left: Math.min(...xs) - 6 + 'px', top: Math.min(...ys) - 6 + 'px', width: Math.max(...xs) - Math.min(...xs) + 12 + 'px', height: Math.max(...ys) - Math.min(...ys) + 12 + 'px' });
  if (value.hand) { $('hand-dot').setAttribute('cx', value.hand.x); $('hand-dot').setAttribute('cy', value.hand.y); }
  const grip = value.owner === 'ground' ? value.groundGrip : value.heldGrip;
  if (grip) { $('grip-dot').setAttribute('cx', grip.x); $('grip-dot').setAttribute('cy', grip.y); }
  $('target').style.left = value.destinationX - 34 + 'px';
  if (qaActive && qaReport) {
    qaReport.frames++; qaReport.phases[value.phase] = (qaReport.phases[value.phase] ?? 0) + 1;
    if (value.owner !== value.renderedOwner) qaReport.ownershipMismatches++;
    if (value.owner === 'hand') qaReport.maxBindingError = Math.max(qaReport.maxBindingError, value.bindingError);
    if (value.pose?.plant && value.pose.plantWeight >= .999 && !value.inspection) for (const foot of value.feet ?? []) qaReport.maxPlantedFootError = Math.max(qaReport.maxPlantedFootError, Math.abs(foot.y - bounds().floorY));
    qaReport.maxSit = Math.max(qaReport.maxSit, value.sit ?? 0);
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
for (const button of document.querySelectorAll('[data-theme]')) button.onclick = () => { stage.classList.toggle('dark', button.dataset.theme === 'dark'); for (const el of document.querySelectorAll('[data-theme]')) el.setAttribute('aria-pressed', String(el === button)); };
$('shell-hit').onpointerdown = e => { if (qaActive || lastFrame?.phase !== 'idle') return; drag = { id: e.pointerId, start: e.clientX, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); };
$('shell-hit').onpointermove = e => { if (!drag || e.pointerId !== drag.id) return; if (Math.abs(e.clientX - drag.start) > 3) drag.moved = true; if (drag.moved) command({ type: 'relocate', x: e.clientX - stage.getBoundingClientRect().left }); };
const release = e => { if (!drag || drag.id !== e.pointerId) return; const moved = drag.moved; drag = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); if (!moved && e.type === 'pointerup') command({ type: 'pickup' }); };
$('shell-hit').onpointerup = $('shell-hit').onpointercancel = release;
$('shell-hit').onclick = e => { if (e.detail === 0) command({ type: 'pickup' }); };
try {
  const pack = await (await fetch('/web/upstream/whale/figure.json')).json();
  Object.assign(pack, { base: '/docs/design/art-workflow/o03-shell-motion-v1/', entry: 'figure.js', export: 'createMotionBody', model: 'scene-model.json' });
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
  return new Promise((resolve, reject) => { qaWaiter = { predicate, resolve, timer: setTimeout(() => { qaWaiter = null; reject(new Error('超时：' + label)); }, 30000) }; });
}
function check(value, label) { if (!value) throw new Error(label); qaReport.checks.push(label); }
$('qa-run').onclick = async () => {
  if (!ready || qaActive) return; qaActive = true;
  qaReport = { passed: false, profile: 'o03-pick-place-01', frames: 0, phases: {}, samples: [], events: [], checks: [], maxBindingError: 0, maxPlantedFootError: 0, maxOwnerSwitchJump: 0, maxStationaryHandStep: 0, maxSit: 0, ownershipMismatches: 0, assetSha256: spec.sha256 };
  try {
    $('speed').value = '1'; command({ type: 'speed', value: 1 });
    const generation = lastFrame.generation; command({ type: 'reset' }); await waitFrame('重置场景', s => s.generation > generation && s.phase === 'idle');
    for (let index = 0; index < 3; index++) {
      const destination = index === 1 ? .30 : .78; $('destination').value = String(destination * 100); command({ type: 'destination', x: stage.clientWidth * destination });
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
      const done = await waitFrame(`第 ${index + 1} 轮拿放完成`, s => s.phase === 'idle' && s.commits.drop === index + 1);
      check(done.commits.pickup === index + 1 && done.owner === 'ground', `第 ${index + 1} 轮恰好拿放一次`);
      const placed = done.groundQuad[2].x + (done.groundQuad[1].x - done.groundQuad[0].x) * .5;
      check(Math.abs(placed - stage.clientWidth * destination) < 2, `第 ${index + 1} 轮实际物件落在指定位置`);
    }
    const events = qaReport.events, picked = events.filter(e => e.type === 'pickup'), dropped = events.filter(e => e.type === 'drop');
    check(picked.length === 3 && picked.every(e => e.contact.distance <= 1.5), '三次拿起均经过真实稳定接触');
    check(dropped.length === 3 && dropped.every(e => e.contact.groundDistance <= 1.5), '三次放下均先接触地面');
    for (const phase of ['settle', 'look', 'reach', 'grasp', 'lift', 'held', 'carry', 'settleDrop', 'lower', 'touch', 'release', 'retract', 'rise']) check(qaReport.phases[phase] > 0, `实际经过 ${names[phase]}`);
    check(qaReport.maxSit < .001, '全过程未切换坐地模型');
    check(qaReport.maxPlantedFootError < .1, '俯身与起身期间脚底不滑离地面');
    check(qaReport.maxBindingError < .01 && qaReport.ownershipMismatches === 0, '持物绑定与显示拥有权一致');
    check(qaReport.maxOwnerSwitchJump < 1.5, '拿起和松手切换时物件跳变小于1.5px');
    check(qaReport.maxStationaryHandStep < 3, '站定动作的手部逐帧位移小于3px');
    qaReport.passed = true; $('qa-status').textContent = `通过 ${qaReport.checks.length} 项 · 三轮拿放`;
  } catch (error) { qaReport.error = error.message; $('qa-status').textContent = '未通过：' + error.message; }
  finally { qaActive = false; $('qa-report').textContent = JSON.stringify(qaReport, null, 2); }
};
