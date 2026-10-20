import {it,expect} from 'vitest';
import {initialLifeWork,stepLifeWork,acceptWorkFact,workCelebration} from '../web/upstream/kit/life-work.js';
const fact=(sessionId='A',revision=1,extra={})=>({sessionId,epoch:1,revision,running:true,category:'working',requests:[],needsAttention:false,...extra});
function fixture(){let state=initialLifeWork(),now=0;
 const input={dt:.05,action:{phase:'idle',owner:'ground',commits:{pickup:0,drop:0}},revision:1,objectId:'shell',object:{x:350,y:555},destination:{x:450,y:600},parking:{x:370,y:555},station:{x:850,y:600},standingReady:true,moving:false,bodyX:240,bodyY:555,speed:0};
 return {input,get state(){return state;},set state(v){state=v;},tick(p={}){now+=50;const r=stepLifeWork(state,{...input,now,...p});state=r.state;return r;},until(phase,p={}){for(let i=0;i<1000&&state.phase!==phase;i++)this.tick(p);expect(state.phase).toBe(phase);},work(){return this.tick({command:{type:'fact',fact:fact()}});},start(){this.tick({command:{type:'start'}});},atWork(){this.work();this.until('work-travel');this.tick({bodyX:850,bodyY:600,event:{kind:'navigation-arrived',...state.navigation}});expect(state.phase).toBe('work-wait');}};
}
it('keeps independent life intent, yields once, and proves physical arrival separately from immediate attention',()=>{
 const f=fixture();f.start();f.input.action={phase:'grasp',owner:'ground',commits:{pickup:0,drop:0}};
 expect(f.work().effects).toContainEqual({type:'action',command:{type:'yield'}});expect(f.state.phase).toBe('handoff');expect(f.state.focus).toBe('A');expect(f.state.life.target).toEqual({x:450,y:600});
 f.input.action.phase='idle';f.until('work-travel');const nav=f.state.navigation;
 for(const bad of [{id:3},{generation:0},{revision:0}]){f.tick({event:{kind:'navigation-arrived',...nav,...bad}});expect(f.state.phase).toBe('work-travel');}
 f.tick({event:{kind:'navigation-arrived',...nav},bodyX:850,bodyY:600});expect(f.state.phase).toBe('work-wait');
});
it('retains a carried object until the action executor commits a real drop and stops a stalled handoff',()=>{
 const f=fixture();f.start();f.input.action={phase:'lift',owner:'hand',commits:{pickup:1,drop:0}};
 const effects=f.work().effects;expect(effects).toContainEqual({type:'destination',x:370,y:555});expect(f.input.action.owner).toBe('hand');f.until('paused');expect(f.state.reason).toBe('handoff-timeout');expect(f.state.life).not.toBeNull();
});
it('continued questions and independent sessions retain demand, idle goals do not',()=>{
 const f=fixture();f.start();f.atWork();
 f.tick({command:{type:'fact',fact:fact('B',1,{requests:[{id:'q',kind:'question'}]})}});expect(f.state.focus).toBe('B');
 f.tick({command:{type:'fact',fact:fact('A',2,{running:false,category:'goal-progress'})}});expect(f.state.phase).toBe('work-wait');
 f.tick({command:{type:'fact',fact:fact('A',3,{running:false,category:'completed'})}});expect(f.state.phase).toBe('work-wait');
 f.tick({command:{type:'fact',fact:fact('B',2,{running:false,category:'completed',requests:[{id:'q',kind:'question'}]})}});expect(f.state.phase).toBe('work-wait');
 f.tick({command:{type:'fact',fact:fact('B',3,{running:false,category:'completed'})}});expect(f.state.phase).toBe('return');
 const r=f.tick();expect(f.state.phase).toBe('life');expect(r.effects).toContainEqual({type:'destination',x:450,y:600});expect(r.effects).toContainEqual({type:'action',command:{type:'loop'}});
});
it('duplicates and late revisions do not resurrect work, same-priority attention stays stable, capacity never evicts unresolved work',()=>{
 let s=acceptWorkFact(initialLifeWork(),fact('B'));s=acceptWorkFact(s,fact('A'));expect(s.focus).toBe('B');
 s=acceptWorkFact(s,fact('B',2,{running:false,category:'completed'}));s=acceptWorkFact(s,fact('B'));expect(s.focus).toBe('A');
 for(let i=0;i<32;i++)s=acceptWorkFact(s,fact('C'+i));expect(s.sessions).toHaveLength(32);expect(s.sessions.some(v=>v.sessionId==='A')).toBe(true);
});
it.each([{speed:1},{bodyX:840},{moving:true}])('never accepts a false arrived receipt %o',bad=>{
 const f=fixture();f.work();f.until('work-travel');f.tick({event:{kind:'navigation-arrived',...f.state.navigation},bodyX:850,bodyY:600,...bad});expect(f.state.phase).toBe('paused');
});
it('drag/lifecycle pause keeps facts and resumes from current geometry with a new identity',()=>{
 const f=fixture();f.start();f.work();f.until('work-travel');const old=f.state.navigation;
 f.tick({command:{type:'pause',reason:'drag'}});expect(f.state.phase).toBe('paused');f.input.revision=2;
 f.tick({command:{type:'fact',fact:fact('A',2,{needsAttention:true,category:'error',running:false})}});expect(f.state.phase).toBe('paused');
 f.tick({command:{type:'resume'}});f.until('work-travel');expect(f.state.navigation.id).toBeGreaterThan(old.id);expect(f.state.navigation.revision).toBe(2);
 f.tick({event:{kind:'navigation-arrived',...old}});expect(f.state.phase).toBe('work-travel');
 f.tick({now:50000});expect(f.state.phase).toBe('paused');
});
it('geometry changes pause and return checks current object and updated target, already reached target ends without pickup',()=>{
 const f=fixture();f.start();f.atWork();f.tick({command:{type:'target',x:350,y:555}});f.tick({command:{type:'fact',fact:fact('A',2,{running:false,category:'completed'})}});
 expect(f.tick().effects).toEqual([]);expect(f.state.reason).toBe('target-already-reached');
 const g=fixture();g.start();g.atWork();g.input.objectId='replacement';g.tick({command:{type:'fact',fact:fact('A',2,{running:false,category:'completed'})}});g.tick();expect(g.state.reason).toBe('object-unavailable');
 const h=fixture();h.start();h.tick({revision:2});expect(h.state.reason).toBe('world-changed');
});
it('cancelling life preserves real progress and work demand, an early completion still finishes safe exit',()=>{
 const f=fixture();f.start();f.work();f.input.action.phase='retract';f.tick({command:{type:'fact',fact:fact('A',2,{running:false,category:'completed'})}});expect(f.state.phase).toBe('handoff');
 f.tick({command:{type:'cancel'}});expect(f.state.life).toBeNull();f.input.action.phase='idle';f.until('return');f.tick();expect(f.state.phase).toBe('idle');
 const g=fixture();g.start();g.work();g.tick({command:{type:'cancel'}});expect(g.state.sessions[0].running).toBe(true);g.until('work-travel');
});

it('cancelling while paused during pickup resumes through safe yield instead of continuing the abandoned loop',()=>{
 const f=fixture();f.start();f.input.action={phase:'paused',suspended:'grasp',owner:'ground',commits:{pickup:0,drop:0}};
 f.tick({command:{type:'pause',reason:'drag'}});f.tick({command:{type:'cancel'}});const result=f.tick({command:{type:'resume'}});
 expect(result.effects).toContainEqual({type:'action',command:{type:'yield'}});expect(result.effects).not.toContainEqual({type:'action',command:{type:'resume'}});expect(f.state.life).toBeNull();
});

it('long work wait changes to an awake seated posture without another route or lifecycle clock',()=>{
 const f=fixture();f.atWork();for(let i=0;i<50;i++)f.tick();const r=f.tick();expect(r.effects).toContainEqual({type:'action',command:{type:'sit'}});expect(f.state.phase).toBe('work-wait');expect(f.state.navigation).toBeNull();
});

it('work preempts a manual navigator through the same body channel, and life cannot start on top of it',()=>{
 const f=fixture();f.input.physicalNavigation={id:2};expect(f.tick({command:{type:'start'}}).effects).toEqual([]);expect(f.state.life).toBeNull();
 expect(f.work().effects).toContainEqual({type:'cancel-navigation'});expect(f.state.phase).toBe('handoff');
});

it('celebrates a new result identity once, suppresses global joy over unresolved requests',()=>{
 const a=fact('A',1,{category:'completed',running:false,resultId:'r1',cue:{id:'c1',kind:'completed'}}),b=fact('B',1,{category:'completed',running:false,resultId:'r2',cue:{id:'c2',kind:'completed'}});
 let c=workCelebration([], [a,b]);expect(c.celebrate).toBe(true);
 expect(workCelebration(c.identities,[b,a]).celebrate).toBe(false);
 expect(workCelebration(c.identities,[{...a,revision:2,requests:[{id:'q',kind:'question'}]},b]).celebrate).toBe(false);
 c=workCelebration(c.identities,[fact('A',2),b]);expect(c.celebrate).toBe(false);
 expect(workCelebration(c.identities,[{...a,revision:3},b]).celebrate).toBe(false);
 expect(workCelebration(c.identities,[{...a,resultId:'r3'},b]).celebrate).toBe(true);
 expect(workCelebration([], [a,{...b,requests:[{id:'q',kind:'question'}]}]).celebrate).toBe(false);
});
it('uses admission order after a focus settles and rejects previous source epochs',()=>{
 let s=acceptWorkFact(initialLifeWork(),fact('Z'));s=acceptWorkFact(s,fact('Y'));s=acceptWorkFact(s,fact('A'));
 for(let revision=2;revision<20;revision++)s=acceptWorkFact(s,fact('Y',revision));
 s=acceptWorkFact(s,fact('Z',2,{running:false}));expect(s.focus).toBe('Y');
 s=acceptWorkFact(s,fact('Y',0,{epoch:2,running:false}));expect(s.focus).toBe('A');
 const same=s;s=acceptWorkFact(s,fact('Y',100,{epoch:1}));expect(s).toBe(same);
});
it('returns from idle active goals and preserves input occupation across background facts',()=>{
 const f=fixture();f.atWork();f.tick({command:{type:'occupancy',occupied:true}});expect(f.state.reason).toBe('user-occupied');
 f.tick({command:{type:'fact',fact:fact('A',2,{running:false,category:'goal-progress'})}});expect(f.state.phase).toBe('paused');
 f.tick({command:{type:'occupancy',occupied:false}});f.until('idle');expect(f.state.sessions[0].category).toBe('goal-progress');
});
it('standing invitation and low frequency posture changes stay at the same work station',()=>{
 const f=fixture();f.atWork();f.input.action.phase='rest';
 expect(f.tick({command:{type:'fact',fact:fact('A',2,{requests:[{id:'q',kind:'question'}]})}}).effects).toContainEqual({type:'action',command:{type:'yield'}});
 expect(f.state.navigation).toBeNull();
});

it('unknown source freezes rather than inventing idle or activity, reattachment cannot clear another pause',()=>{
 const f=fixture();f.start();f.work();f.tick({command:{type:'fact',fact:fact('A',2,{driver:'unknown',running:false})}});expect(f.state.reason).toBe('source-unavailable');
 f.tick({command:{type:'fact',fact:fact('A',3,{driver:'idle',running:false})}});expect(f.state.phase).toBe('handoff');
 const g=fixture();g.start();g.tick({command:{type:'pause',reason:'drag'}});g.tick({command:{type:'occupancy',occupied:true}});g.tick({command:{type:'occupancy',occupied:false}});expect(g.state.reason).toBe('drag');expect(g.state.phase).toBe('paused');
});
