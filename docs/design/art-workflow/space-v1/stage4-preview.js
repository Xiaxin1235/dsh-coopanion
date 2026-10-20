// Explicit authoring-only source. No Harness connection and no model calls.
import { WorkPreview } from './work-facts.generated.js';
const labels={working:'工作进行中',reply:'本轮已回复','goal-progress':'目标仍在进行',completed:'目标已完成',error:'异常需关注',blocked:'目标受阻',stopped:'已停止',interrupted:'历史中断','max-tokens':'输出 token 达到上限',unknown:'状态未知'};
const activities={idle:'驱动空闲',preparing:'准备与收尾',requesting:'等待模型',reasoning:'出现思考活动',generating:'组织回复','tool-arguments':'准备工具参数',tools:'等待调用结果',recovering:'请求遇到问题',unknown:'来源不可观测'};
const reasons={'source-unavailable':'工作来源暂不可观测，先停稳','user-occupied':'保留你的阅读与输入','world-changed':'布局已改变，请核对后继续',lifecycle:'生命周期中断',drag:'拖动已暂停','life-complete':'原目标已完成','target-already-reached':'贝壳已在目标处','object-unavailable':'原物件已失效','handoff-timeout':'交接超时，物件状态已保留','explicit-reset':'已复位，请核对后继续'};
const phases={'personal-choose':'核对小院对象','personal-align':'转向并注视对象','personal-prepare':'从当前姿态起身','personal-travel':'人格日常 · 探索','personal-dwell':'人格日常 · 停留',idle:'待机',life:'整理贝壳',handoff:'安全交接物件与身体','work-prepare':'准备到岗','work-travel':'前往岗位','work-wait':'已实际到岗 · 守候',return:'核对原生活目标',paused:'暂停 · 等待继续',ended:'本次整理结束'};
const buttons={disconnect:'来源不可观测',reconnect:'重新核对驱动',start:'工作开始',accepted:'发送已接受',reasoning:'思考活动',generating:'组织回复','tool-arguments':'准备工具参数',tool:'提出工具调用','tool-done':'单个调用返回','tool-error':'单个调用失败',retry:'失败后新尝试',progress:'回合结束 · 目标未完成',reply:'普通回复',complete:'目标完成',approval:'请求审批',approved:'结算一条审批',question:'提出问题',continued:'转为 continued',answered:'结算一条问题',error:'终止异常',limit:'输出达到上限',cancel:'用户取消',ack:'确认异常',repeat:'重复上一事件'};
export function mountStage4(command){
  const panel=document.createElement('section');panel.className='work-panel';panel.id='work-panel';
  panel.innerHTML=`<p class="eyebrow">STAGE 04 · SIMULATED FACTS</p><h2>生活有续，工作有应。</h2><p>模拟 Harness 事实 · 未连接真实宿主</p><div class="transport"><button id="story-start" class="primary">开始整理</button><button id="story-cancel">取消生活目标</button></div><p id="coord-status" role="status">待机</p><p id="life-status">生活目标：尚未开始</p><label>交互会话 <select id="work-session">${['A','B','C'].map(id=>`<option value="${id}">会话 ${id}</option>`).join('')}</select></label><label>审批结算 <select id="approval-outcome"><option value="allowed-once">允许一次</option><option value="rejected">拒绝</option><option value="cancelled">撤回</option><option value="unavailable">不可用</option></select></label><div class="fact-buttons">${Object.entries(buttons).map(([id,label])=>`<button id="work-${id}">${label}</button>`).join('')}</div><details><summary>多会话组合故事</summary><div class="fact-buttons"><button id="scenario-attention">A 工具 / B 审批 / C 完成</button><button id="scenario-streams">A、B 同时输出</button><button id="scenario-continued">A 目标未完成 / B continued</button></div><p>组合故事显式重建三个模拟来源；不改生活目标。</p></details><label>模拟会话草稿（聚焦时暂停身体）<textarea id="work-draft" rows="2" placeholder="后台事件不会改写这份草稿"></textarea></label><label><input type="checkbox" id="work-reduced"> 减少动态</label><p id="work-status" role="status" aria-live="polite">暂无工作事实</p><p id="work-sessions"></p>`;
  const aside=document.querySelector('aside'),inspector=document.createElement('details');inspector.className='space-inspector';inspector.innerHTML='<summary>布局与接触检查</summary>';while(aside.firstChild)inspector.append(aside.firstChild);aside.append(inspector);aside.prepend(panel);
  document.querySelector('.footer span:nth-child(2)').textContent='工作意图：模拟事实驱动关注与交接';
  const $=id=>document.getElementById(id),sources=new Map(),drafts=new Map();let lastNotice='暂无工作事实',epoch=1,batch=null;
  const send=fact=>{if(fact){if(batch)batch.set(fact.sessionId,fact);else command({type:'work-fact',fact});}};
  function source(id=$('work-session').value){if(!sources.has(id))sources.set(id,new WorkPreview(id,send,epoch));return sources.get(id);}
  function act(id,kind){const f=source(id).act(kind,$('approval-outcome').value);lastNotice=kind==='accepted'?'发送已接受：不代表执行或完成':`${f.sessionId} · ${f.requests.length?'等待'+f.requests.map(r=>r.kind==='approval'?'审批':r.state==='continued'?'后续答复':'答复').join('、'):activities[f.activity]+' · '+labels[f.category]}`;return f;}
  $('story-start').onclick=()=>command({type:'story-start'});$('story-cancel').onclick=()=>command({type:'story-cancel'});
  for(const kind of Object.keys(buttons))$('work-'+kind).onclick=()=>act($('work-session').value,kind);
  $('work-session').onchange=()=>{$('work-draft').value=drafts.get($('work-session').value)??'';};
  $('work-draft').oninput=()=>drafts.set($('work-session').value,$('work-draft').value);
  $('work-draft').onfocus=()=>command({type:'work-occupancy',occupied:true});
  $('work-draft').onblur=()=>command({type:'work-occupancy',occupied:false});
  $('work-reduced').onchange=()=>command({type:'work-reduced',reduced:$('work-reduced').checked});
  for(const kind of ['attention','streams','continued'])$('scenario-'+kind).onclick=()=>{
    batch=new Map();epoch++;sources.clear();for(const id of ['A','B','C'])send(source(id).adapter.snapshot());
    if(kind==='attention'){act('A','tool');act('B','approval');act('C','complete');}
    if(kind==='streams'){act('A','generating');act('B','generating');}
    if(kind==='continued'){act('A','progress');act('B','question');act('B','continued');}
    command({type:'work-facts',facts:[...batch.values()]});batch=null;
  };
  return {render(frame){const c=frame.coordination;if(!c)return;
    $('coord-status').textContent=`${phases[c.phase]??c.phase}${c.reason?' · '+(reasons[c.reason]??c.reason):''}`;
    const focus=c.sessions.find(s=>s.sessionId===c.focus),p=frame.performance;
    document.getElementById('nav-bubble').textContent=c.phase==='paused'?'先停稳，等你继续':focus?`${focus.sessionId} · ${p?.label??activities[focus.activity]}`:c.phase==='life'?'接着整理贝壳':c.phase==='ended'?'整理好了':'歇一会儿';
    $('story-start').disabled=!['idle','ended'].includes(c.phase)||!['idle','rest'].includes(frame.phase)||frame.navigation?.id!=null;$('story-cancel').disabled=!c.life;
    $('life-status').textContent=c.life?`生活目标：贝壳 → (${Math.round(c.life.target.x)}, ${Math.round(c.life.target.y)}) · 实际拿/放 ${frame.commits.pickup}/${frame.commits.drop}`:'生活目标：未保留';
    const running=c.sessions.filter(s=>s.running).length,requests=c.sessions.reduce((n,s)=>n+s.requests.length,0);
    $('work-sessions').textContent=`运行 ${running} 个会话 · 待处理 ${requests} 条请求 ｜ `+c.sessions.map(s=>`${s.sessionId===c.focus?'身体关注 ':''}${s.sessionId}：${activities[s.activity]??s.activity} · ${labels[s.category]??s.category}${s.goal?.goal?' · 目标 '+s.goal.goal.phase:''}${s.requests.length?' · 未决 '+s.requests.length:''}`).join(' ｜ ');
    $('work-status').textContent=lastNotice;
  }};
}
