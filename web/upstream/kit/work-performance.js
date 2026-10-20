// Metadata-only performance sampled on the body's existing active clock.
// Never schedules movement, owns props, reads text, or interprets tool success.
export const initialWorkPerformance=()=>({key:null,age:0,time:0,seen:[],cue:null,cueAge:0});
const styles={
 idle:{expression:'neutral',label:'歇一会儿',look:[0,0],arm:4},
 preparing:{expression:'determined',label:'收心，准备工作',look:[3,0],arm:0},
 requesting:{expression:'listening',label:'在等模型回应',look:[3,-2],arm:5},
 reasoning:{expression:'thinking',label:'正在思考',look:[-3,-3],arm:-24},
 generating:{expression:'determined',label:'正在组织回复',look:[4,1],arm:-12},
 'tool-arguments':{expression:'thinking',label:'正在准备工具参数',look:[3,3],arm:-16},
 tools:{expression:'determined',label:'等待调用结果',look:[4,2],arm:0},
 recovering:{expression:'worried',label:'请求遇到问题，等待后续决定',look:[1,2],arm:3},
 unknown:{expression:'confused',label:'暂时看不到驱动状态',look:[0,-1],arm:4},
 approval:{expression:'listening',label:'这一步需要你的许可',look:[-4,-2],arm:-30},
 question:{expression:'confused',label:'有个问题想听听你',look:[-3,-1],arm:-19},
 continued:{expression:'listening',label:'问题保留着，等你方便再答',look:[-3,-1],arm:-14},
 'plan-review':{expression:'thinking',label:'等你审阅方案',look:[-2,0],arm:-22},
 error:{expression:'sad',label:'遇到终止问题，一起看看',look:[-2,2],arm:8},
};
export function stepWorkPerformance(previous,coordination,dt,{reduced=false}={}) {
 const quiet=coordination.phase==='paused'||coordination.occupied;
 const step=quiet?0:Math.max(0,Math.min(.05,dt));
 const focused=coordination.sessions.find(f=>f.sessionId===coordination.focus),request=focused?.requests[0];
 const kind=request?.kind==='approval'?'approval':request?request.intent==='plan-review'?'plan-review':request.state==='continued'?'continued':'question':focused?.needsAttention?'error':focused?.activity??'idle';
 const key=JSON.stringify([focused?.sessionId??null,kind]);
 const seen=new Map(previous.seen),fresh=coordination.sessions.filter(f=>f.cue&&seen.get(f.sessionId)!==f.cue.id);
 for(const f of fresh)seen.set(f.sessionId,f.cue.id);
 const urgent=coordination.sessions.some(f=>f.requests.length||f.needsAttention);
 // Consume even suppressed/quiet cues: occupation release must not replay a backlog.
 const event=quiet?null:fresh.find(f=>f.sessionId===coordination.focus)??(!urgent?fresh.find(f=>f.cue.kind==='completed'||f.cue.kind==='stopped'||f.cue.kind==='reply'):null);
 const state={key,age:previous.key===key?previous.age+step:0,time:previous.time+step,seen:[...seen],
  cue:quiet?null:event?.cue??previous.cue,cueAge:event?0:previous.cueAge+step};
 const style=styles[kind]??styles.unknown;
 let expression=style.expression, label=style.label;
 const pulse=state.cueAge<1.3?state.cue?.kind:null;
 if(!quiet && !urgent && state.cue?.kind==='completed' && state.cueAge<2.5){expression='happy';label='这个目标完成了';}
 else if(!quiet && pulse==='tool-error'){expression='worried';label='一次调用失败，工作仍在继续';}
 else if(!quiet && pulse==='retry'){expression='determined';label='已开始新的尝试';}
 else if(!quiet && pulse==='stopped'){expression='content';label='收到，先收住';}
 else if(!quiet && pulse?.startsWith('approval-')){expression=pulse==='approval-allowed-once'?'content':'neutral';label=pulse==='approval-allowed-once'?'收到许可，继续核对':'这次许可已结算';}
 const wave=quiet||reduced?0:Math.sin(state.age*(kind==='generating'?3.2:.65));
 // Four-second glance every eleven active seconds, no route or new timer.
 const glance=!quiet&&!reduced&&state.age%11>7?Math.sin((state.age%11-7)*Math.PI/4):0;
 return {state,view:{kind,expression:quiet?'neutral':expression,label,age:state.age,cue:pulse,
  look:quiet||reduced?[0,0]:[style.look[0]+wave*.7-glance*4,style.look[1]+wave*.4],
  armNear:quiet||reduced?4:style.arm+wave*(kind==='generating'?5:2),armFar:quiet||reduced?-2:-2+glance*7}};
}
