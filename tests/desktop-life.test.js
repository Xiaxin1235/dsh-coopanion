import {it,expect} from 'vitest';
import {livingScene} from '../web/living-space.js';
import {initialLifeWork,stepLifeWork} from '../web/upstream/kit/life-work.js';
import {initialPersonality} from '../web/upstream/kit/personality.js';
import {initialLivingRoutine,stepLivingRoutine} from '../web/upstream/kit/living-routine.js';
const scene=livingScene({width:1100,height:800});
function input(patch={}){return {now:1,dt:.05,revision:1,objectRevision:1,model:scene.model,interests:scene.interests,words:['stand','look','nod'],personalityEnabled:true,directedLife:true,bodyX:850,bodyY:776,canNavigate:true,moving:false,standingReady:true,facingReady:true,gazeReady:true,action:{phase:'idle',owner:'ground',commits:{pickup:1,drop:1}},...patch};}
function ready(){const s=initialLifeWork();s.phase='personal-choose';s.personality={...initialPersonality(),enabled:true,permissions:{mode:'quiet',roam:true,input:'idle',occupied:false}};return s;}
it('the default desktop has no permanent furniture and has real geometry-based destinations',()=>{expect(scene.objects).toEqual([]);expect(scene.model.obstacles).toEqual([]);expect(scene.desktop.dock).toBe('desk-dock');expect(scene.interests.some(i=>i.kind==='edge')).toBe(true);});
it('a directed visit owns one actual route and cannot complete by a timer',()=>{let r=stepLifeWork(ready(),input({command:{type:'visit',id:'desk-outlook',token:7}}));expect(r.state.visit).toMatchObject({id:'desk-outlook',token:7,status:'pending'});expect(r.state.phase).toBe('personal-prepare');for(let n=0;n<25;n++)r=stepLifeWork(r.state,input({now:2+n*50}));expect(r.state.phase).toBe('personal-travel');expect(r.state.visit.status).toBe('pending');});
it('typing yields through the same handoff and waits without losing a life goal',()=>{const s=ready();s.life={objectId:'o03-shell',target:{x:900,y:760},pickup:0,drop:0};const a={phase:'carry',owner:'hand',commits:{pickup:1,drop:0}};let r=stepLifeWork(s,input({action:a,parking:{x:700,y:776},command:{type:'environment',busy:true,kind:'typing'}}));expect(r.state.phase).toBe('handoff');expect(r.effects).toContainEqual({type:'action',command:{type:'yield'}});expect(r.state.life.target.x).toBe(900);r=stepLifeWork(r.state,input({now:2}));expect(r.state.phase).toBe('environment-wait');r=stepLifeWork(r.state,input({now:3,command:{type:'environment',busy:false}}));expect(r.state.phase).toBe('return');});
it('a completed arrangement proceeds through exploration, return and rest only on matching actual observation',()=>{let state={...initialLivingRoutine(),arranged:true};const c={enabled:true,mode:'quiet',keyboard:'idle',personality:'lively',facts:[],desktop:scene.desktop};let coordination=ready();const tick=()=>{const r=stepLivingRoutine(state,{now:(state.lastAt??0)+50,dt:.05,context:c,coordination,action:{phase:'idle',owner:'ground'},moving:false});state=r.state;return r.commands;};let commands=tick();const visit=commands.find(v=>v.type==='visit');expect(visit.id).toBe('desk-outlook');coordination.visit={...visit,status:'done',revision:scene.model.revision};commands=tick();expect(commands).toContainEqual(expect.objectContaining({type:'visit',id:'desk-dock'}));const back=commands.find(v=>v.type==='visit');coordination.visit={...back,status:'done',revision:scene.model.revision};commands=tick();expect(commands).toContainEqual({type:'rest'});expect(state.cycles).toBe(1);});
it('typing cooldown uses current idle time rather than cumulative life time',()=>{let state={...initialLivingRoutine(),arranged:true,elapsed:100};const c={enabled:true,mode:'quiet',keyboard:'active',personality:'quiet',facts:[],desktop:scene.desktop};const r=stepLivingRoutine(state,{now:1,dt:.05,context:c,coordination:ready(),action:{phase:'idle',owner:'ground'}});expect(r.commands).toContainEqual({type:'environment',busy:true,kind:'typing'});c.keyboard='idle';const next=stepLivingRoutine(r.state,{now:51,dt:.05,context:c,coordination:{...ready(),environmentBusy:true},action:{phase:'idle',owner:'ground'}});expect(next.commands.some(v=>v.type==='visit')).toBe(false);});
it('a paused neutral executor is released before admitting a directed visit, without inventing an action failure',()=>{
 const r=stepLifeWork(ready(),input({action:{phase:'paused',suspended:'idle',owner:'ground',commits:{pickup:0,drop:0}}}));
 expect(r.state.phase).toBe('personal-choose');expect(r.effects).toContainEqual({type:'action',command:{type:'yield'}});
});
it('system resumption has its own bounded cue and cannot be replayed long after busy work',()=>{
 const c={enabled:true,mode:'quiet',keyboard:'idle',personality:'quiet',facts:[],desktop:scene.desktop,lifecycle:true};
 let state=initialLivingRoutine(),now=0;
 const tick=()=>{now+=50;const r=stepLivingRoutine(state,{now,dt:.05,context:c,coordination:ready(),action:{phase:'idle',owner:'ground'}});state=r.state;return r.commands;};
 tick();c.lifecycle=false;expect(tick()).toContainEqual({type:'environment',busy:true,kind:'recovering'});
 const cues=[];for(let i=0;i<200;i++)cues.push(...tick().filter(v=>v.type==='environment-cue'));
 expect(cues).toEqual([{type:'environment-cue',kind:'wake'}]);
 c.lifecycle=true;tick();c.lifecycle=false;c.keyboard='active';tick();now+=20000;tick();c.keyboard='idle';
 const late=[];for(let i=0;i<200;i++)late.push(...tick().filter(v=>v.type==='environment-cue'));expect(late).toEqual([]);
});
