// One body clock. Confirmed physical progress and public environment enums are
// inputs; this module issues intentions, never ownership or completion receipts.
export const initialLivingRoutine = () => ({
  configured:false,permissions:null,work:null,memory:null,personality:null,
  elapsed:0,arranged:false,rested:false,lastAt:null,stage:'tidy',stageTime:0,
  goal:null,token:0,cycles:0,quietFor:8,pointerQuiet:2,environment:null,lifecycle:null,wake:false,wakeAt:null,
});
export function stepLivingRoutine(previous,input) {
  const state={...previous,lastAt:input.now},commands=[],c=input.context;
  const result=()=>({state,commands});
  if(!c||!Number.isFinite(input.now))return result();
  const dt=Math.max(0,Math.min(.05,input.dt??0)),desktop=c.desktop;
  if(state.lifecycle===true&&!c.lifecycle){state.wake=true;state.wakeAt=input.now;state.quietFor=0;}
  state.lifecycle=!!c.lifecycle;
  if(state.wakeAt!==null&&input.now-state.wakeAt>15000)state.wake=false;
  if(c.keyboard==='active')state.quietFor=0;else if(c.keyboard==='idle')state.quietFor+=dt;
  if(desktop?.pointerNear)state.pointerQuiet=0;else state.pointerQuiet+=dt;
  const environment=desktop&&c.enabled&&!c.lifecycle?(c.keyboard==='active'?'typing':state.quietFor<8?(state.wake?'recovering':'typing'):desktop.pointerNear||state.pointerQuiet<1.2?'pointer':null):null;
  if(desktop && state.environment!==environment){state.environment=environment;commands.push({type:'environment',busy:!!environment,...(environment?{kind:environment}:{})});}
  const occupied=c.occupied||c.lifecycle||!c.enabled;
  const permissions={mode:c.enabled?c.mode:'off',roam:c.enabled,input:desktop&&c.keyboard==='active'?'idle':c.keyboard,occupied};
  const key=JSON.stringify(permissions);
  if(!state.configured){state.configured=true;commands.push({type:'personality-start'});}
  if(state.permissions!==key||state.personality!==c.personality){state.permissions=key;state.personality=c.personality;commands.push({type:'personality',id:c.personality??'quiet',version:1,permissions});}
  const work=JSON.stringify(c.facts??[]);
  if(state.work!==work){state.work=work;commands.push({type:'facts',facts:c.facts??[],replace:true});}
  const memory=JSON.stringify(c.memory??null);
  if(state.memory!==memory){state.memory=memory;commands.push({type:'personality'});}
  if(!!input.coordination.social!==!!c.social)commands.push({type:'social',occupied:!!c.social});
  if(['life-complete','target-already-reached'].includes(input.coordination.reason))state.arranged=true;
  const demand=input.coordination.sessions.some(f=>f.running||f.requests.length||f.needsAttention||f.driver==='unknown');
  if(occupied||c.keyboard!=='idle'||c.social||demand||c.reduced||environment)return result();
  state.elapsed+=dt;state.stageTime+=dt;
  if(input.coordination.phase==='paused' && /^(personality:|lifecycle|world-changed|drag|user-occupied|source-unavailable|explicit-reset)/.test(input.coordination.reason??''))commands.push({type:'resume'});
  const available=input.action.owner==='ground'&&input.action.phase==='idle'&&!input.moving&&!input.coordination.life;
  const personal=input.coordination.phase.startsWith('personal-');
  const observed=input.coordination.personality?.decision?.result==='observed';
  if(state.wake&&available){commands.push({type:'environment-cue',kind:'wake'});state.wake=false;}
  const visit=id=>{
    if(state.goal!==id){state.goal=id;state.token++;}
    const v=input.coordination.visit;
    if(v?.token===state.token&&v.id===id && v.revision===desktop.revision){return v.status==='done';}
    if(available && (personal||['idle','ended'].includes(input.coordination.phase)))commands.push({type:'visit',id,token:state.token});
    return false;
  };
  const readyAfter=c.memory?.kind==='pet'?10:c.memory?.kind==='play'?4:6;
  if(!state.arranged){
    if(desktop)visit(desktop.shell);
    if(state.elapsed>=readyAfter&&available&&personal&&observed&&(!desktop||input.coordination.personality?.decision?.interestId===desktop.shell))commands.push({type:'start'});
    return result();
  }
  if(!desktop){if(!state.rested&&state.elapsed>=65&&available&&personal&&observed){state.rested=true;commands.push({type:'rest'});}return result();}
  if(state.stage==='tidy'){state.stage='outbound';state.stageTime=0;state.goal=null;}
  if(state.stage==='outbound' && visit(desktop.outlook)){state.stage='return';state.stageTime=0;state.goal=null;}
  if(state.stage==='return' && visit(desktop.dock) && available && personal){
    commands.push({type:'rest'});state.rested=true;state.cycles++;state.stage='rest';state.stageTime=0;state.goal=null;
  }
  if(state.stage==='rest' && state.stageTime>=(c.personality==='lively'?24:48) && available && personal){state.stage='outbound';state.stageTime=0;state.goal=null;}
  return result();
}
