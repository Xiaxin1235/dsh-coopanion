// Local, versioned preferences; no scheduler, model calls, persistence or invites.
import {planPath} from './navigation.js';
export const PERSONALITIES=Object.freeze({
  quiet:Object.freeze({id:'quiet',version:1,label:'安静',dwellMin:18,dwellMax:26,explore:.20}),
  lively:Object.freeze({id:'lively',version:1,label:'活泼',dwellMin:6,dwellMax:10,explore:.85}),
});
export const initialPersonality=()=>({id:'quiet',version:1,overrides:{},seed:7,ordinal:0,enabled:false,
  permissions:{mode:'off',roam:false,input:'unknown',occupied:false},decision:null,history:[],observations:[],clock:0,fallback:false});
export function configurePersonality(previous,command) {
  const next={...previous,overrides:{...previous.overrides}};
  if(command.id!==undefined || command.version!==undefined){next.fallback=!Object.hasOwn(PERSONALITIES,command.id??next.id) || (command.version??1)!==1;next.id=next.fallback?'quiet':command.id??next.id;next.version=1;}
  if(Number.isInteger(command.seed)&&command.seed>=0&&command.seed<=0xffffffff)next.seed=command.seed;
  if(command.reset===true)delete next.overrides[next.id];
  if(command.parameters){const o={...next.overrides[next.id]},p=command.parameters;
    if(Number.isFinite(p.dwellMin)) {o.dwellMin=Math.max(6,Math.min(40,p.dwellMin));o.dwellMax=o.dwellMin+8;}
    if(Number.isFinite(p.explore))o.explore=Math.max(0,Math.min(.95,p.explore));
    next.overrides[next.id]=o;
  }
  if(command.permissions){const p=command.permissions,o={...next.permissions};
    if(['off','quiet','interactive'].includes(p.mode))o.mode=p.mode;
    if(['idle','active','unknown'].includes(p.input))o.input=p.input;
    for(const k of ['roam','occupied'])if(typeof p[k]==='boolean')o[k]=p[k];
    next.permissions=o;
  }
  return next;
}
export const personalityParameters=p=>({...PERSONALITIES[p.id],...p.overrides[p.id]});
export function personalityGate(p) {
  if(p.permissions.mode==='off')return 'mode-off';
  if(!p.permissions.roam)return 'roam-off';
  if(p.permissions.input!=='idle')return 'input-'+p.permissions.input;
  if(p.permissions.occupied)return 'user-occupied';
  return null;
}
// Authored object affordances. These are observation positions, never contact claims.
export function shellInterest(point,floor=point.y) {
 return {id:'o03-shell',kind:'shell',label:'贝壳',focus:{x:point.x,y:floor-18},
   targets:{quiet:[{x:point.x-140,y:floor},{x:point.x+140,y:floor}],lively:[{x:point.x-100,y:floor},{x:point.x+100,y:floor}]}};
}
export const interestKey=i=>JSON.stringify([i.id,i.kind,i.focus.x,i.focus.y]);
export function choosePersonality(p,input) {
  const parameters=personalityParameters(p),ordinal=p.ordinal+1;
  let counter=p.ordinal>>>0;counter=Math.imul(counter^(counter>>>16),0x85ebca6b);counter=Math.imul(counter^(counter>>>13),0xc2b2ae35);
  let seed=(p.seed^(counter^(counter>>>16)))>>>0;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const samples=[random(),random(),random()],origin={x:input.bodyX,y:input.bodyY};
  const words=input.words??[],canMove=input.canNavigate&&words.includes('stand')&&!input.reduced;
  const affinities=p.id==='quiet'?{shell:5,plant:2,home:3,edge:3,place:1}:{plant:5,shell:3,home:1,edge:5,place:1};
  if(input.rememberedKind==='pet')affinities.shell+=2;
  if(input.rememberedKind==='play')affinities.plant+=2;
  const known=(input.interests??[]).slice(0,8).filter(i=>i && typeof i.id==='string' && Object.hasOwn(affinities,i.kind) && [i.focus?.x,i.focus?.y].every(Number.isFinite));
  const available=known.filter(i=>(!input.visitId||i.id===input.visitId)&&(!!input.visitId||!(p.observations??[]).some(o=>o.key===interestKey(i)&&(p.clock??0)-o.at<90))).map(i=>{
    const points=Array.isArray(i.targets?.[p.id])?i.targets[p.id]:i.target?[i.target]:[];
    const paths=canMove&&input.model?points.filter(t=>[t.x,t.y].every(Number.isFinite)).map(target=>({target,plan:planPath(input.model,origin,target)})).filter(p=>p.plan.passed):[];
    const route=paths.sort((a,b)=>(a.plan.length??Math.hypot(a.target.x-origin.x,a.target.y-origin.y))-(b.plan.length??Math.hypot(b.target.x-origin.x,b.target.y-origin.y)))[0];
    const distance=route?(route.plan.length??Math.hypot(route.target.x-origin.x,route.target.y-origin.y)):Math.hypot(i.focus.x-origin.x,i.focus.y-origin.y);
    return {...i,key:interestKey(i),route,score:affinities[i.kind]-distance*.002};
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  // Choose a named object or an explicit desktop affordance, never anonymous random ground.
  // Reconsider the object before giving up a route. With navigation available,
  // only a reachable observation position can authorize an object observation.
  const eligible=canMove?available.filter(i=>i.route):available;
  const interest=input.reduced?null:eligible[0]??null,wanted=!!input.visitId||samples[0]<parameters.explore;
  const target=wanted&&interest?.route&&Math.hypot(interest.route.target.x-origin.x,interest.route.target.y-origin.y)>12?interest.route.target:null;
  const kind=target?'explore':'stay';
  const reason=personalityGate(p)??(input.reduced?'reduced-motion':!input.canNavigate?'no-navigation':!words.includes('stand')?'no-stand':!known.length?'no-interest':!available.length?'observed-all':!interest?'no-safe-target':kind==='explore'?'inspect-object':'observe-here');
  const decision={ordinal,personality:p.id,version:1,strategy:2,parameters,samples,seed:p.seed,kind,reason,origin,revision:input.revision,
    attention:p.id==='quiet'?'consider':'investigate',interestId:interest?.id??null,interestKey:interest?.key??null,interestLabel:interest?.label??interest?.id??null,interestKind:interest?.kind??null,
    focus:interest?{...interest.focus}:null,result:'pending',
    duration:parameters.dwellMin+samples[1]*(parameters.dwellMax-parameters.dwellMin),
    candidates:available.flatMap(i=>i.route?[{...i.route.target}]:[]),target,
    alternatives:available.map(i=>({id:i.id,score:i.score,reachable:!!i.route}))};
  return {...p,ordinal,decision,history:[...p.history,decision].slice(-16)};
}
export function completeObservation(p) {
 const d={...p.decision,result:p.decision.interestId?'observed':'quiet-ended'};
 const observations=d.interestId?[...(p.observations??[]).filter(o=>o.id!==d.interestId),{id:d.interestId,key:d.interestKey,at:p.clock??0}].slice(-8):p.observations??[];
 return {...p,decision:d,observations,history:p.history.map(v=>v.ordinal===d.ordinal?d:v)};
}
