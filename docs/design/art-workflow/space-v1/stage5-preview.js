import {PERSONALITIES,personalityParameters,personalityGate} from '/web/upstream/kit/personality.js';
const reasons={'mode-off':'自主陪伴关闭','roam-off':'未许可移动', 'input-active':'正在输入','input-unknown':'输入状态未知','user-occupied':'阅读／草稿／发送或今天安静','reduced-motion':'减少动态：原地停留','no-navigation':'缺少二维移动能力','no-stand':'缺少起身动作','no-safe-target':'邻近目标均不可达','preference-explore':'探索采样低于本组探索偏好，选择可达邻近目标','preference-stay':'探索采样高于本组探索偏好，原地停留'};
export function mountStage5(command) {
 const panel=document.createElement('section');panel.className='work-panel personality-panel';panel.id='personality-panel';
 panel.innerHTML=`<p class="eyebrow">STAGE 05A · PERSONALITY V1</p><h2>同一小院，两种性情。</h2><p>模拟许可 · 无模型日常调用</p><label>人格 <select id="personality-id"><option value="quiet">安静</option><option value="lively">活泼</option></select></label><p id="personality-description"></p><div class="personality-fields"><label>随机种子 <input id="personality-seed" type="number" min="0" max="4294967295" value="7"></label><label>陪伴模式 <select id="personality-mode"><option value="off">off · 关闭</option><option value="quiet">quiet · 安静日常</option><option value="interactive">interactive · 预算不变</option></select></label><label>粗粒度输入 <select id="personality-input"><option value="unknown">unknown · 未知</option><option value="idle">idle · 空闲</option><option value="active">active · 输入中</option></select></label></div><label><input type="checkbox" id="personality-roam"> 许可移动</label><label><input type="checkbox" id="personality-occupied"> 阅读／草稿／发送／今天安静</label><div class="transport"><button class="primary" id="personality-start">开始人格日常</button><button id="personality-stop">停止日常</button></div><p id="personality-status" role="status">默认关闭，等待显式开启</p><p id="personality-choice"></p><details><summary>参数与选择依据</summary><label>停留下界（6–40 秒） <input id="personality-dwell" type="number" min="6" max="40" step="1"></label><label>探索概率（0–0.95） <input id="personality-explore" type="number" min="0" max="0.95" step="0.05"></label><div class="transport"><button id="personality-apply">应用本组参数</button><button id="personality-reset">恢复本组参数</button><button id="personality-fallback">模拟未知版本回退</button></div><p>切换保留两组修改、种子和选择序号。对照请各开新页：同地图、空事实、种子 7，许可 quiet／移动／idle 后开始。工作事实仍在下方。</p><pre id="personality-trace"></pre></details>`;
 const work=document.getElementById('work-panel'),facts=document.createElement('details');facts.id='work-facts-panel';facts.innerHTML='<summary>工作事实与占用（模拟）</summary>';work.before(facts);facts.append(work);
 document.querySelector('aside').prepend(panel);
 const $=id=>document.getElementById('personality-'+id);
 let lastKey='',renderedId=null;
 const configure=extra=>{lastKey='';command({type:'personality',...extra});};
 $('id').onchange=()=>configure({id:$('id').value,version:1});
 $('seed').onchange=()=>configure({seed:Number($('seed').value)});
 for(const id of ['mode','input','roam','occupied'])$(id).onchange=()=>configure({permissions:{mode:$('mode').value,input:$('input').value,roam:$('roam').checked,occupied:$('occupied').checked}});
 $('start').onclick=()=>command({type:'personality-start'});$('stop').onclick=()=>command({type:'personality-stop'});
 $('apply').onclick=()=>configure({parameters:{dwellMin:Number($('dwell').value),explore:Number($('explore').value)}});
 $('reset').onclick=()=>configure({reset:true});$('fallback').onclick=()=>configure({id:'unknown',version:99});
 return {render(frame){const c=frame.coordination,p=c?.personality;if(!p)return;
   const parameters=personalityParameters(p),key=JSON.stringify([p.id,parameters,p.seed]);
   if(key!==lastKey){lastKey=key;$('id').value=p.id;$('seed').value=p.seed;$('dwell').value=parameters.dwellMin;$('explore').value=parameters.explore;$('description').textContent=`${parameters.label} · 停留 ${parameters.dwellMin}–${parameters.dwellMax} 秒 · 探索 ${Math.round(parameters.explore*100)}%`;}
   const gate=personalityGate(p),active=c.phase.startsWith('personal-'),decision=p.decision;
   $('start').disabled=p.enabled;$('stop').disabled=!p.enabled;
   $('status').textContent=`${p.enabled?'已开启':'已停止'} · ${gate?reasons[gate]:c.phase==='paused'?'已暂停，核对后按继续':c.focus?'工作优先':active?c.phase==='personal-travel'?'正在探索':c.phase==='personal-dwell'?'停留观察':'从当前姿态准备':'等待身体安全交接'}${p.fallback?' · 未知配置已回退安静 v1':''}`;
   $('choice').textContent=decision?`第 ${decision.ordinal} 次：${decision.kind==='explore'?'探索邻近空地':'原地停留'} · ${reasons[decision.reason]} · ${decision.kind==='explore'?'到达后停留':'停留'} ${decision.duration.toFixed(1)} 秒`:'尚未选择：先许可模式、移动与输入空闲，再开始。';
   if(renderedId!==p.ordinal){renderedId=p.ordinal;$('trace').textContent=JSON.stringify(p.history,null,2);}
   if(active)document.getElementById('nav-bubble').textContent=c.phase==='personal-travel'?'去旁边看看':c.phase==='personal-dwell'?'在这里待一会儿':'慢慢起身';
 }};
}
