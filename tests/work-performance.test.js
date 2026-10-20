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
