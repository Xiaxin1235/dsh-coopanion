import {it,expect} from 'vitest';
import {initialWorkPerformance,stepWorkPerformance} from '../web/upstream/kit/work-performance.js';
const fact=(sessionId,activity,extra={})=>({sessionId,activity,running:true,requests:[],needsAttention:false,...extra});
const c=(sessions,focus='A',extra={})=>({phase:'work-wait',sessions,focus,...extra});
it('distinguishes metadata activity and requests without text or independent clocks',()=>{
 const states=['preparing','requesting','reasoning','generating','tool-arguments','tools','recovering'].map(activity=>stepWorkPerformance(initialWorkPerformance(),c([fact('A',activity)]),.05).view);
 expect(new Set(states.map(s=>JSON.stringify([s.expression,s.look,s.armNear]))).size).toBe(7);
 expect(stepWorkPerformance(initialWorkPerformance(),c([fact('A','tools',{requests:[{kind:'approval',id:'p'}]})]),.05).view.kind).toBe('approval');
 expect(stepWorkPerformance(initialWorkPerformance(),c([fact('A','tools',{requests:[{kind:'question',id:'q',state:'continued'}]})]),.05).view.kind).toBe('continued');
});
it('does not restart continuous performance on delta updates, glance and free arm evolve',()=>{
 const coordination=c([fact('A','reasoning')]);let s=initialWorkPerformance(),first;
 for(let i=0;i<180;i++){const r=stepWorkPerformance(s,{...coordination,sessions:[{...coordination.sessions[0],revision:i}]},.05);s=r.state;if(!i)first=r.view;}
 const last=stepWorkPerformance(s,coordination,.05);expect(last.view.age).toBeGreaterThan(8);expect(last.view.look).not.toEqual(first.look);
});
it('background success cannot override a question; repetition and occupation do not replay cues',()=>{
 const completed=fact('C','idle',{running:false,category:'completed',cue:{id:'r1',kind:'completed'}});
 let r=stepWorkPerformance(initialWorkPerformance(),c([fact('B','tools',{requests:[{kind:'approval',id:'p'}]}),completed],'B'),.05);
 expect(r.view.expression).toBe('listening');
 r=stepWorkPerformance(r.state,c([completed],null),.05);expect(r.view.expression).not.toBe('happy');
 r=stepWorkPerformance(r.state,c([{...completed,cue:{id:'r2',kind:'completed'}}],null,{phase:'paused'}),.05);
 expect(stepWorkPerformance(r.state,c([{...completed,cue:{id:'r2',kind:'completed'}}],null),.05).view.expression).not.toBe('happy');
});
it('reduces moving channels and freezes on pause while still consuming new facts',()=>{
 const coordination=c([fact('A','generating')]);const r=stepWorkPerformance(initialWorkPerformance(),coordination,.05,{reduced:true});expect(r.view.look).toEqual([0,0]);expect(r.view.armNear).toBe(4);
 const paused=stepWorkPerformance(r.state,{...coordination,phase:'paused'},.05);expect(paused.state.time).toBe(r.state.time);expect(paused.view.expression).toBe('neutral');
});
const requests=[
 {request:{id:'a',kind:'approval'},kind:'approval',expression:'listening',label:'这一步需要你的许可'},
 {request:{id:'q',kind:'question',state:'open'},kind:'question',expression:'confused',label:'有个问题想听听你'},
 {request:{id:'q',kind:'question',state:'continued'},kind:'continued',expression:'listening',label:'问题保留着，等你方便再答'},
 {request:{id:'q',kind:'question',intent:'plan-review'},kind:'plan-review',expression:'thinking',label:'等你审阅方案'},
];
for(const {request,...expected} of requests)it.each(['tool-error','retry','stopped','approval-allowed-once','approval-rejected','approval-cancelled','approval-unavailable','completed'])(`${expected.kind} keeps its invitation through %s without replay on release`,kind=>{
 const pending=fact('A','tools',{requests:[request],cue:{id:'cue-'+kind,kind}});
 let r=stepWorkPerformance(initialWorkPerformance(),c([pending]),.05);
 expect(r.view).toMatchObject(expected);
 // Releasing the request before the cue expires must not reveal a deferred pulse.
 r=stepWorkPerformance(r.state,c([{...pending,requests:[]}]),.05);
 expect(r.view).toMatchObject({kind:'tools',expression:'determined',label:'等待调用结果'});expect(r.view.cue).toBeFalsy();
});
it('a newly pending request discards a short feedback already being shown',()=>{
 const failure=fact('A','tools',{cue:{id:'failure',kind:'tool-error'}});
 let r=stepWorkPerformance(initialWorkPerformance(),c([failure]),.05);expect(r.view.expression).toBe('worried');
 r=stepWorkPerformance(r.state,c([{...failure,requests:[{id:'a',kind:'approval'}]}]),.05);
 expect(r.view).toMatchObject({kind:'approval',expression:'listening',label:'这一步需要你的许可'});
 r=stepWorkPerformance(r.state,c([failure]),.05);expect(r.view.expression).toBe('determined');expect(r.view.cue).toBeFalsy();
});
it('terminal attention keeps its meaning and a fresh final settlement can still acknowledge permission',()=>{
 const error=fact('A','idle',{needsAttention:true,cue:{id:'retry',kind:'retry'}});
 expect(stepWorkPerformance(initialWorkPerformance(),c([error]),.05).view).toMatchObject({kind:'error',expression:'sad',label:'遇到终止问题，一起看看'});
 const pending=fact('A','tools',{requests:[{id:'a',kind:'approval'}],cue:{id:'failure',kind:'tool-error'}});
 const s=stepWorkPerformance(initialWorkPerformance(),c([pending]),.05).state;
 expect(stepWorkPerformance(s,c([{...pending,requests:[],cue:{id:'allowed',kind:'approval-allowed-once'}}]),.05).view).toMatchObject({expression:'content',label:'收到许可，继续核对'});
});
