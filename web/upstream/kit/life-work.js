// Local opt-in courtyard coordinator. One body, one tick, one navigator.
// Work facts are metadata projected by the trusted owner, never inferred here.
export const initialLifeWork = () => ({ phase:'idle', suspended:null, reason:null, life:null, sessions:[], focus:null,
  interaction:null, occupied:false, admission:0, navigation:null, serial:0, elapsed:0, lastAt:null, revision:null });
// A bounded last-result ledger per source survives metadata changes and restarts.
export function workCelebration(previous, sessions) {
  const old=new Map(previous.map(entry=>[entry.sessionId,entry.id]));
  const fresh=sessions.filter(f=>f.category==='completed' && f.resultId && f.cue?.kind==='completed' && old.get(f.sessionId)!==f.resultId);
  return {identities:sessions.map(f=>({sessionId:f.sessionId,id:f.resultId??old.get(f.sessionId)??null})),
    celebrate:fresh.length>0 && !sessions.some(f=>f.requests.length || f.needsAttention)};
}
export const workDemand = f => f.running || f.requests.length > 0 || f.needsAttention;
const priority = f => f.requests.length ? 3 : f.needsAttention ? 2 : f.running ? 1 : 0;
export function acceptWorkFact(state, fact) {
  if (!fact || typeof fact.sessionId !== 'string' || !fact.sessionId || !Number.isSafeInteger(fact.epoch) || fact.epoch<1 || !Number.isSafeInteger(fact.revision) || fact.revision < 0 ||
    typeof fact.running !== 'boolean' || typeof fact.needsAttention !== 'boolean' || !Array.isArray(fact.requests) || fact.requests.length>128 ||
    !['working','reply','goal-progress','completed','approval','question','error','stopped','interrupted','blocked','max-tokens','unknown'].includes(fact.category) ||
    fact.requests.some(r=>!r || typeof r.id!=='string' || !['approval','question'].includes(r.kind))) return state;
  const previous=state.sessions.find(s=>s.sessionId===fact.sessionId);
  if (previous && (previous.epoch>fact.epoch || previous.epoch===fact.epoch && previous.revision>=fact.revision) || !previous && state.sessions.length>=32) return state;
  const admission=state.admission+(!previous || priority(previous)!==priority(fact)?1:0);
  const accepted={...fact,attentionOrder:!previous || priority(previous)!==priority(fact)?admission:previous.attentionOrder,requests:fact.requests.map(r=>({...r}))};
  const sessions=previous?state.sessions.map(s=>s.sessionId===fact.sessionId?accepted:s):state.sessions.concat(accepted);
  const candidates=sessions.filter(workDemand).sort((a,b)=>priority(b)-priority(a)||a.attentionOrder-b.attentionOrder);
  const old=candidates.find(s=>s.sessionId===state.focus), explicit=candidates.find(s=>s.sessionId===state.interaction && s.requests.length);
  const focus=explicit?.sessionId??(old && priority(old)===priority(candidates[0]) ? old.sessionId : candidates[0]?.sessionId??null);
  return {...state,sessions,focus,admission};
}
export function stepLifeWork(state, input) {
  let next={...state,lastAt:input.now}, effects=[];
  const out=()=>({state:next,effects});
  const action=command=>effects.push({type:'action',command});
  const stop=()=>{if(next.navigation||input.moving||input.physicalNavigation?.id!=null)effects.push({type:'cancel-navigation'});next.navigation=null;};
  const enter=phase=>{next.phase=phase;next.elapsed=0;next.revision=input.revision;next.reason=null;};
  const pause=reason=>{if(next.phase!=='paused'){next.suspended=next.phase;enter('paused');stop();action({type:'pause'});}next.reason=reason;};
  const demand=()=>next.sessions.some(workDemand);
  const handoff=()=>{
    stop();enter('handoff');
    // Parking changes only the executor target, not the saved life destination.
    if(input.action.owner==='hand' && !['lower','touch','release'].includes(input.action.phase)) {
      effects.push({type:'destination',...input.parking});
    }
    action({type:'yield'});
  };
  const cmd=input.command;
  if(cmd?.type==='fact')next=acceptWorkFact(next,cmd.fact);
  if(cmd?.type==='facts' && Array.isArray(cmd.facts))for(const fact of cmd.facts)next=acceptWorkFact(next,fact);
  if(cmd?.type==='interaction')next.interaction=cmd.sessionId??null;
  if(cmd?.type==='occupancy') {
    next.occupied=cmd.occupied===true;
    if(next.occupied){if(next.phase!=='paused')pause('user-occupied');return out();}
    if(next.phase==='paused' && next.reason==='user-occupied'){next.suspended=null;handoff();return out();}
  }
  if(next.occupied){if(next.phase!=='paused')pause('user-occupied');return out();}
  if(next.sessions.some(f=>f.driver==='unknown')){if(next.phase!=='paused')pause('source-unavailable');return out();}
  if(next.phase==='paused' && next.reason==='source-unavailable' && !input.blocked && cmd?.type!=='pause') {next.suspended=null;handoff();return out();}
  if(cmd?.type==='start' && ['idle','ended'].includes(next.phase) && ['idle','rest'].includes(input.action.phase) && !input.moving && input.physicalNavigation?.id==null) {
    next.life={objectId:input.objectId,target:{...input.destination},pickup:input.action.commits.pickup,drop:input.action.commits.drop};
    if(demand())handoff();else {enter('life');action({type:'loop'});}return out();
  }
  if(cmd?.type==='cancel') {
    next.life=null;
    if(next.phase==='paused'){next.suspended='handoff';next.reason='life-cancelled';return out();}
    handoff();return out();
  }
  if(cmd?.type==='reset') {stop();next.life=null;if(demand()){next.suspended='handoff';enter('paused');next.reason='explicit-reset';}else{next.suspended=null;enter('idle');}return out();}
  if(cmd?.type==='target' && next.life && Number.isFinite(cmd.x)&&Number.isFinite(cmd.y))next.life={...next.life,target:{x:cmd.x,y:cmd.y}};
  if(cmd?.type==='pause' || input.blocked || state.lastAt!==null && (input.now<state.lastAt||input.now-state.lastAt>1000)) {pause(cmd?.reason??'lifecycle');return out();}
  if(cmd?.type==='resume' && next.phase==='paused' && !input.blocked) {
    const suspended=next.suspended;next.suspended=null;
    if(suspended==='life' && !demand() && next.life) {enter('life');action({type:'resume'});}
    else handoff();
    return out();
  }
  if(next.phase==='paused')return out();
  if(!['idle','ended'].includes(next.phase) && next.revision!==input.revision) {pause('world-changed');return out();}
  if(demand() && ['idle','ended','life','return'].includes(next.phase)) {handoff();return out();}
  const dt=Number.isFinite(input.dt)?Math.max(0,Math.min(.05,input.dt)):0;next.elapsed+=dt;
  if(input.action.phase==='paused' && !['idle','ended'].includes(next.phase)) {pause(input.action.error??'action-paused');return out();}
  if(next.phase==='life') {
    if(!next.life || input.objectId!==next.life.objectId){next.life=null;handoff();next.reason='object-unavailable';return out();}
    if(input.action.phase==='idle' && input.action.commits.drop>next.life.drop){enter('ended');next.reason='life-complete';}
  } else if(next.phase==='handoff') {
    if(input.action.phase==='idle' && input.action.owner==='ground') {
      if(demand()){enter('work-prepare');effects.push({type:'stand'});}
      else enter('return');
    } else if(next.elapsed>15)pause('handoff-timeout');
  } else if(['work-prepare','work-travel','work-wait'].includes(next.phase)) {
    if(!demand()){stop();enter('return');return out();}
    if(next.phase==='work-prepare') {
      if(next.elapsed>=.8 && input.standingReady && !input.moving){
        if(!input.station || ![input.station.x,input.station.y].every(Number.isFinite) || !Number.isSafeInteger(8e12+next.serial+1)){pause('invalid-station');return out();}
        next.serial++;next.navigation={id:8e12+next.serial,generation:1,revision:input.revision,target:{...input.station}};
        enter('work-travel');effects.push({type:'navigate',...next.navigation});
      }else if(next.elapsed>6)pause('stance-timeout');
    } else if(next.phase==='work-travel') {
      const e=input.event,n=next.navigation;
      if(e && n && e.id===n.id && e.generation===n.generation && e.revision===n.revision) {
        if(e.kind==='navigation-arrived' && Math.hypot(input.bodyX-n.target.x,input.bodyY-n.target.y)<=.5 && input.speed<=.001 && !input.moving){
          next.navigation=null;enter('work-wait');effects.push({type:'at-work'});
        }else pause(e.by??'arrival-mismatch');
      }else if(next.elapsed>30)pause('work-arrival-timeout');
    } else if(next.phase==='work-wait') {
      const focused=next.sessions.find(f=>f.sessionId===next.focus);
      const stand=!!focused?.requests.length || !input.reduced && Math.floor(next.elapsed/12)%2===1;
      if(stand && input.action.phase==='rest')action({type:'yield'});
      else if(!stand && next.elapsed>=2.5 && input.action.phase==='idle')action({type:'sit'});
    }
  } else if(next.phase==='return') {
    if(!next.life){enter('idle');return out();}
    if(input.objectId!==next.life.objectId || !input.object || ![input.object.x,input.object.y,next.life.target.x,next.life.target.y].every(Number.isFinite)) {
      enter('ended');next.reason='object-unavailable';next.life=null;return out();
    }
    if(input.action.owner==='ground' && Math.hypot(input.object.x-next.life.target.x,input.object.y-next.life.target.y)<=1.5){enter('ended');next.reason='target-already-reached';return out();}
    effects.push({type:'destination',...next.life.target});action({type:'loop'});enter('life');
  }
  return out();
}
