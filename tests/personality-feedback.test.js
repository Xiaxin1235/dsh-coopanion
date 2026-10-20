import {it,expect} from 'vitest';
import {initialPersonality,configurePersonality,choosePersonality} from '../web/upstream/kit/personality.js';
import {initialLifeWork,stepLifeWork} from '../web/upstream/kit/life-work.js';
import {freshLayout,actionNavigationModel} from '../docs/design/art-workflow/space-v1/geometry.js';
const preset=id=>({...configurePersonality(initialPersonality(),{id,permissions:{mode:'quiet',input:'idle',roam:true}}),enabled:true});
const inputs=()=>({now:50,dt:.05,personalityEnabled:true,action:{phase:'idle',owner:'ground',commits:{pickup:0,drop:0}},revision:1,model:actionNavigationModel(freshLayout()),bodyX:240,bodyY:555,words:['stand','sit','thinking','surprised','curious','happy','look','tilt','nod'],canNavigate:true,moving:false,speed:0,standingReady:true,interests:[]});
it('ordinary quiet observation away from home does not automatically sit down',()=>{
 const state={...initialLifeWork(),phase:'personal-choose',revision:1,personality:preset('quiet')};
 const r=stepLifeWork(state,inputs());expect(r.effects).not.toContainEqual({type:'action',command:{type:'sit'}});
});
it('an empty courtyard supplies no object to explore and cannot be replaced by random waypoints',()=>{
 const p=choosePersonality(preset('lively'),inputs());expect(p.decision.kind).toBe('stay');expect(p.decision.target).toBeNull();
});
it('equal timing and movement probability still leave different ways of attending to the same object',()=>{
 const input={...inputs(),interests:[{id:'planter',kind:'plant',focus:{x:541,y:285},target:{x:400,y:440}}]};
 const q=choosePersonality(configurePersonality(preset('quiet'),{parameters:{dwellMin:12,explore:.95}}),input).decision;
 const l=choosePersonality(configurePersonality(preset('lively'),{parameters:{dwellMin:12,explore:.95}}),input).decision;
 expect(q.interestId).toBe('planter');expect(l.interestId).toBe('planter');expect(q.attention).not.toBe(l.attention);
});

it('rising from a seated yield never passes through the prop-reaching bend',async()=>{
 const {readFileSync}=await import('node:fs');
 const {initialSpaceAction,stepSpaceAction,sampleSpaceAction}=await import('../web/upstream/kit/space-action.js');
 const profile=JSON.parse(readFileSync(new URL('../docs/design/art-workflow/o03-shell-hands-v1/scene-model.json',import.meta.url))).motion;
 let state={...initialSpaceAction(profile),phase:'rest'},maxBend=0;
 for(let n=0;n<35;n++){
  state=stepSpaceAction(state,{...inputs(),now:n*50,command:n===0?{type:'yield'}:null,standingReady:n>24},profile).state;
  maxBend=Math.max(maxBend,sampleSpaceAction(state,profile).waist);
 }
 expect(maxBend).toBeLessThan(1);expect(state.phase).toBe('idle');
});

it('arrival alone and time with gaze misaligned do not record an observation',()=>{
 const input={...inputs(),interests:[{id:'plant',kind:'plant',focus:{x:350,y:260},target:{x:350,y:440}}]};
 let p=choosePersonality(preset('lively'),input),state={...initialLifeWork(),phase:'personal-dwell',revision:1,personality:p};
 for(let n=0;n<60;n++)state=stepLifeWork(state,{...input,now:n*50,gazeReady:false}).state;
 expect(state.personality.decision.result).toBe('pending');expect(state.personality.observations).toEqual([]);
 let gestures=0;
 for(let n=60;n<120;n++){const r=stepLifeWork(state,{...input,now:n*50,gazeReady:true});state=r.state;gestures+=r.effects.filter(e=>e.type==='gesture').length;}
 expect(state.personality.decision.result).toBe('observed');expect(gestures).toBe(1);expect(state.personality.observations).toHaveLength(1);
});
it('recently observed objects do not produce another route, and moving an object invalidates the current intent',async()=>{
 const {completeObservation}=await import('../web/upstream/kit/personality.js');
 const input={...inputs(),interests:[{id:'plant',kind:'plant',focus:{x:350,y:260},target:{x:350,y:440}}]};
 const selected=choosePersonality(preset('lively'),input),done=completeObservation(selected);
 expect(choosePersonality(done,input).decision).toMatchObject({kind:'stay',interestId:null,reason:'observed-all'});
 const state={...initialLifeWork(),phase:'personal-travel',revision:1,personality:selected,navigation:{id:1}};
 const r=stepLifeWork(state,{...input,interests:[{...input.interests[0],focus:{x:380,y:260}}]});expect(r.state.phase).toBe('handoff');expect(r.effects).toContainEqual({type:'cancel-navigation'});expect(r.state.personality.observations).toEqual([]);
});
it('existing expression vocabulary and object-directed gaze differ even with the same timing',async()=>{
 const {personalityPerformance}=await import('../web/upstream/kit/personality-performance.js');
 const i={...inputs(),bodyY:400,interests:[{id:'plant',kind:'plant',focus:{x:350,y:260},target:{x:350,y:440}}]};
 const view=id=>personalityPerformance({...initialLifeWork(),phase:'personal-dwell',elapsed:1,personality:choosePersonality(preset(id),i)},i);
 expect(view('quiet').expression).toBe('thinking');expect(view('lively').expression).toBe('surprised');expect(view('quiet').look).not.toEqual(view('lively').look);
 expect(personalityPerformance({...initialLifeWork(),phase:'personal-dwell',personality:choosePersonality(preset('lively'),i)},{...i,words:[]}).expression).toBe('neutral');
 expect(personalityPerformance({...initialLifeWork(),phase:'personal-dwell',personality:choosePersonality(preset('lively'),i)},i,{reduced:true}).look).toEqual([0,0]);
 expect(personalityPerformance({...initialLifeWork(),phase:'personal-dwell',personality:choosePersonality(preset('quiet'),i)},{...i,gazeOrigin:{x:350,y:260}}).look).toEqual([0,0]);
});
