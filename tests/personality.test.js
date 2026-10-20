import {it,expect} from 'vitest';
import {initialPersonality,configurePersonality,choosePersonality,personalityParameters,personalityGate} from '../web/upstream/kit/personality.js';
import {initialLifeWork,stepLifeWork} from '../web/upstream/kit/life-work.js';
import {freshLayout,actionNavigationModel,personalityInterests} from '../docs/design/art-workflow/space-v1/geometry.js';
import {checkPath} from '../web/upstream/kit/navigation.js';
const input=()=>({now:0,dt:.05,personalityEnabled:true,action:{phase:'idle',owner:'ground',commits:{pickup:0,drop:0}},model:actionNavigationModel(freshLayout()),interests:personalityInterests(freshLayout()),revision:1,words:['sit','stand'],canNavigate:true,standingReady:true,bodyX:240,bodyY:555,moving:false,speed:0,station:{x:850,y:600}});
const configured=(id='quiet')=>configurePersonality(initialPersonality(),{id,permissions:{mode:'quiet',roam:true,input:'idle'}});
function fixture(id='lively'){let state={...initialLifeWork(),personality:{...configured(id),enabled:true}},i=input();return {get state(){return state;},i,tick(command=null,extra={}){i.now+=50;const r=stepLifeWork(state,{...i,...extra,command});state=r.state;return r;},until(phase){for(let n=0;n<200&&state.phase!==phase;n++)this.tick();expect(state.phase).toBe(phase);}};}
it('same map, facts and seed select quiet stay vs lively real exploration, with reproducible reasons',()=>{
 const i=input(),q=choosePersonality(configured(),i),l=choosePersonality(configured('lively'),i);
 expect(q.decision.kind).toBe('stay');expect(l.decision.kind).toBe('explore');expect(q.decision.samples).toEqual(l.decision.samples);
 expect(q.decision.duration).toBeGreaterThan(l.decision.duration);expect(choosePersonality(configured(),i)).toEqual(q);
 expect(l.decision.candidates.every(target=>checkPath(i.model,[target,target]).passed)).toBe(true);
});
it('bounded overrides survive profile switches and unknown-version fallback; reset only clears selected profile',()=>{
 let p=configurePersonality(configured(),{parameters:{dwellMin:200,explore:-8}});expect(personalityParameters(p)).toMatchObject({dwellMin:40,dwellMax:48,explore:0});
 p=configurePersonality(p,{id:'lively',parameters:{dwellMin:2,explore:2}});expect(personalityParameters(p)).toMatchObject({dwellMin:6,dwellMax:14,explore:.95});
 p={...p,ordinal:8};p=configurePersonality(p,{id:'missing',version:9,seed:-1});expect(p).toMatchObject({id:'quiet',fallback:true,seed:7,ordinal:8});expect(personalityParameters(p).dwellMin).toBe(40);
 p=configurePersonality(p,{reset:true});expect(personalityParameters(p).dwellMin).toBe(18);expect(p.overrides.lively.dwellMax).toBe(14);
});
it.each([{reduced:true,reason:'reduced-motion'},{canNavigate:false,reason:'no-navigation'},{words:[],reason:'no-stand'},{model:null,reason:'no-safe-target'}])('falls back to stationary behavior: %o',extra=>{
 const p=choosePersonality(configured('lively'),{...input(),...extra});expect(p.decision.kind).toBe('stay');expect(p.decision.reason).toBe(extra.reason);
});
it.each([{mode:'off'},{roam:false},{input:'active'},{input:'unknown'},{occupied:true}])('permission blocks optional behavior without consuming choices %o',permissions=>{
 const f=fixture();f.tick({type:'personality',permissions});expect(f.state.phase).toBe('paused');expect(f.state.personality.ordinal).toBe(0);expect(personalityGate(f.state.personality)).toBeTruthy();
 for(let n=0;n<10;n++)expect(f.tick().effects).toEqual([]);
});
it('live geometry removes blocked candidates and never forces a route',()=>{
 const i=input(),p=configured('lively'),first=choosePersonality(p,i).decision;
 i.model={...i.model,revision:2,obstacles:[...i.model.obstacles,{id:'new',kind:'full-body-restricted',x:first.target.x-2,y:first.target.y-2,w:4,h:4}]};i.revision=2;
 const next=choosePersonality(p,i).decision;expect(next.candidates).not.toContainEqual(first.target);expect(next.revision).toBe(2);
});
it('switching in travel cancels navigation, preserves progress and re-evaluates the actual root with a fresh identity',()=>{
 const f=fixture();f.until('personal-travel');const old=f.state.navigation,ordinal=f.state.personality.ordinal;
 f.i.bodyX=280;const r=f.tick({type:'personality',id:'quiet'});expect(r.effects).toContainEqual({type:'cancel-navigation'});expect(f.state.phase).toBe('handoff');expect(f.state.personality.ordinal).toBe(ordinal);
 f.until('personal-dwell');expect(f.state.personality.decision.origin.x).toBe(280);expect(f.state.personality.ordinal).toBe(ordinal+1);
 f.tick({type:'personality',id:'lively',parameters:{explore:.95}});f.until('personal-travel');expect(f.state.navigation.id).toBeGreaterThan(old.id);
 f.tick(null,{event:{kind:'navigation-arrived',...old}});expect(f.state.phase).toBe('personal-travel');
});
it.each([{bodyX:1},{speed:1},{moving:true}])('does not infer arrival from a timer or mismatched physical state %o',extra=>{
 const f=fixture();f.until('personal-travel');const n=f.state.navigation;
 f.tick(null,{bodyX:n.target.x,bodyY:n.target.y,event:{kind:'navigation-arrived',...n},...extra});expect(f.state.phase).toBe('paused');
});
it('arrival, dwell, missing sit and interruption use the existing executor; history stays bounded',()=>{
 const f=fixture();f.i.words=['stand'];f.until('personal-travel');const n=f.state.navigation;
 f.i.bodyX=n.target.x;f.i.bodyY=n.target.y;const r=f.tick(null,{bodyX:n.target.x,bodyY:n.target.y,event:{kind:'navigation-arrived',...n}});expect(f.state.phase).toBe('personal-align');expect(r.effects).not.toContainEqual({type:'action',command:{type:'sit'}});
 f.tick(null,{revision:2});expect(f.state.reason).toBe('world-changed');f.i.revision=2;f.tick({type:'resume'});f.until('personal-dwell');expect(f.state.personality.decision.revision).toBe(2);
 let p=configured();for(let n=0;n<40;n++)p=choosePersonality(p,input());expect(p.history).toHaveLength(16);expect(p.ordinal).toBe(40);
});
it('work preempts personal travel and is independent of off mode; acceptance cannot complete work',()=>{
 const f=fixture();f.until('personal-travel');f.tick({type:'fact',fact:{sessionId:'A',epoch:1,revision:1,category:'approval',requests:[{id:'a',kind:'approval'}],running:false,needsAttention:false}});
 expect(f.state.phase).toBe('handoff');f.tick({type:'personality',permissions:{mode:'off'}});f.until('work-travel');expect(f.state.focus).toBe('A');expect(f.state.personality.ordinal).toBe(1);
});
it('permission release cannot overwrite drag/lifecycle pause; stop does not reset ownership or target',()=>{
 const f=fixture();f.until('personal-travel');f.tick({type:'pause',reason:'drag'});f.tick({type:'personality',permissions:{input:'active'}});f.tick({type:'personality',permissions:{input:'idle'}});
 expect(f.state.reason).toBe('drag');expect(f.state.phase).toBe('paused');f.tick({type:'personality-stop'});expect(f.state.phase).toBe('paused');f.tick({type:'resume'});f.until('idle');expect(f.state.personality.enabled).toBe(false);
});

it('a new explicit lifecycle/drag pause supersedes an earlier permission pause',()=>{
 const f=fixture();f.tick({type:'personality',permissions:{mode:'off'}});expect(f.state.reason).toBe('personality:mode-off');
 f.tick({type:'pause',reason:'drag'});f.tick({type:'personality',permissions:{mode:'quiet'}});expect(f.state.phase).toBe('paused');expect(f.state.reason).toBe('drag');
});
it('completed explicit life yields back to an enabled personal loop, without repeating contact',()=>{
 const f=fixture();f.i.objectId='shell';f.tick({type:'start'},{destination:{x:390,y:600}});expect(f.state.phase).toBe('life');
 f.i.action={phase:'idle',owner:'ground',commits:{pickup:1,drop:1}};f.tick();expect(f.state.phase).toBe('ended');f.until('personal-travel');expect(f.state.life).toBeNull();
});

it.each(['__proto__','constructor','toString'])('unknown prototype name %s uses the safe preset',id=>{
 expect(configurePersonality(configured('lively'),{id})).toMatchObject({id:'quiet',fallback:true});
});

it.each([{input:'active'},{input:'unknown'},{occupied:true}])('occupation freezes work travel but still accepts facts %o',permissions=>{
 const f=fixture();f.until('personal-travel');f.tick({type:'personality',permissions});
 f.tick({type:'fact',fact:{sessionId:'A',epoch:1,revision:1,category:'working',requests:[],running:true,needsAttention:false}});
 expect(f.state.phase).toBe('paused');expect(f.state.focus).toBe('A');expect(f.state.sessions[0].running).toBe(true);
 f.tick({type:'personality',permissions:{input:'idle',occupied:false}});f.until('work-travel');
});
