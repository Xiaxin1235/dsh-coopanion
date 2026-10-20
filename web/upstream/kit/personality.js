// Local, versioned preferences; no scheduler, model calls, persistence or invites.
import {planPath} from './navigation.js';
export const PERSONALITIES=Object.freeze({
  quiet:Object.freeze({id:'quiet',version:1,label:'安静',dwellMin:18,dwellMax:26,explore:.20}),
  lively:Object.freeze({id:'lively',version:1,label:'活泼',dwellMin:6,dwellMax:10,explore:.85}),
});
export const initialPersonality=()=>({id:'quiet',version:1,overrides:{},seed:7,ordinal:0,enabled:false,
  permissions:{mode:'off',roam:false,input:'unknown',occupied:false},decision:null,history:[],fallback:false});
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
export function choosePersonality(p,input) {
  const parameters=personalityParameters(p),ordinal=p.ordinal+1;
  // Constant-size deterministic sampling; resuming never replays a random stream.
  let counter=p.ordinal>>>0;counter=Math.imul(counter^(counter>>>16),0x85ebca6b);counter=Math.imul(counter^(counter>>>13),0xc2b2ae35);
  let seed=(p.seed^(counter^(counter>>>16)))>>>0;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const samples=[random(),random(),random()],origin={x:input.bodyX,y:input.bodyY};
  const words=input.words??[],canMove=input.canNavigate&&words.includes('stand')&&!input.reduced;
  const candidates=canMove&&input.model ? [[140,0],[-140,0],[0,65],[0,-65],[140,65],[-140,65],[140,-65],[-140,-65]].map(([x,y])=>({x:origin.x+x,y:origin.y+y})).filter(target=>planPath(input.model,origin,target).passed):[];
  const wanted=samples[0]<parameters.explore;
  const kind=wanted&&candidates.length?'explore':'stay';
  const reason=personalityGate(p)??(input.reduced?'reduced-motion':!input.canNavigate?'no-navigation':!words.includes('stand')?'no-stand':wanted&&!candidates.length?'no-safe-target':kind==='explore'?'preference-explore':'preference-stay');
  const decision={ordinal,personality:p.id,version:1,parameters,samples,seed:p.seed,kind,reason,origin,revision:input.revision,
    duration:parameters.dwellMin+samples[1]*(parameters.dwellMax-parameters.dwellMin),candidates,
    target:kind==='explore'?candidates[Math.min(candidates.length-1,Math.floor(samples[2]*candidates.length))]:null};
  return {...p,ordinal,decision,history:[...p.history,decision].slice(-16)};
}
