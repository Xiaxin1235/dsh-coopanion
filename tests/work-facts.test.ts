import {execFileSync} from 'node:child_process';
import {it,expect} from 'vitest';
import {WorkFacts} from '../src/work-facts.ts';
import type {SessionEvent} from '@deepseek-ai/dsh-session';
function fixture(Adapter=WorkFacts){const facts=new Adapter('A');let seq=0;
 const feed=(type:string,data:unknown)=>facts.consume({type,data,seq:seq++,time:10} as SessionEvent);
 const goal=(phase='active',revision=1,id='goal',version=1)=>feed('goal/change',{kind:'goal/change',version,operation:revision===1?'create':phase==='complete'?'complete':phase==='blocked'?'block':'pause',goal:{id,revision,objective:'controlled',phase,maxGoalRounds:8,...(phase==='blocked'?{blockedReason:{code:'external-blocker',message:'controlled'}}:{})},roundsStarted:0,createdAt:0,updatedAt:revision});
 return {facts,feed,goal,start:(turn=1)=>feed('turn/start',{turn}),end:(turn=1,kind='completed')=>feed('turn/end',{turn,reason:{kind}})};
}
it('separates ordinary replies, active-goal progress, accepted sends and committed completion',()=>{
 const r=fixture();r.start();expect(r.facts.accepted()).toBeUndefined();expect(r.facts.snapshot().running).toBe(true);
 expect(r.end()?.category).toBe('reply');r.start(2);r.goal();expect(r.end(2)?.category).toBe('goal-progress');
 r.start(3);r.goal('complete',2);expect(r.end(3)?.category).toBe('completed');r.start(4);expect(r.end(4)?.category).toBe('reply');
});
it.each(['error','aborted','interrupted','blocked','max-tokens'])('does not celebrate completion when the turn ends %s',kind=>{
 const r=fixture();r.start();r.goal();r.goal('complete',2);expect(r.end(1,kind)?.category).toBe(kind==='aborted'?'stopped':kind);
});
it.each(['missing','id','revision','version'])('degrades %s goal replay immediately to ordinary reply',fault=>{
 const r=fixture();r.start();if(fault!=='missing')r.goal();r.goal('complete',fault==='revision'?1:2,fault==='id'?'other':'goal',fault==='version'?99:1);expect(r.end()?.category).toBe('reply');
});
it('keeps pending question projection independent from end, goal completion and acknowledgement',()=>{
 const r=fixture();r.start();r.goal();r.facts.question('q',1,true);r.goal('complete',2);r.end();r.facts.acknowledge();
 expect(r.facts.snapshot().requests).toEqual([{id:'q',kind:'question',state:'open'}]);r.facts.question('q',3,false);
 expect(r.facts.question('q',2,true)).toBeUndefined();expect(r.facts.snapshot().requests).toEqual([]);
});
it('matches approvals by native identity, refuses stale sequence/turn and keeps sessions separate',()=>{
 const a=fixture(),b=fixture();a.start();a.feed('approval/asked',{turn:1,id:'full-id',toolName:'controlled'});
 a.feed('approval/decided',{turn:1,id:'other'});expect(a.facts.snapshot().requests).toHaveLength(1);expect(b.facts.snapshot().requests).toHaveLength(0);
 a.feed('approval/decided',{turn:1,id:'full-id'});expect(a.facts.snapshot().requests).toHaveLength(0);a.end();a.start(2);
 expect(a.facts.consume({type:'turn/end',data:{turn:1,reason:{kind:'completed'}},seq:0,time:1} as SessionEvent)).toBeUndefined();
 a.end(1);expect(a.facts.snapshot().running).toBe(true);
});
it('never derives completion from tool output and only acknowledges exceptions, without clearing running work',()=>{
 const r=fixture();r.start();r.goal();r.feed('tool/result',{turn:1,message:{isError:false,content:[{type:'text',text:'goal complete'}]}});expect(r.end()?.category).toBe('goal-progress');
 r.start(2);r.facts.acknowledge();expect(r.facts.snapshot().running).toBe(true);r.end(2,'error');expect(r.facts.snapshot().needsAttention).toBe(true);expect(r.facts.acknowledge().needsAttention).toBe(false);
});
it('bounds question tombstones and does not resurrect a settled id',()=>{
 const r=fixture();for(let i=0;i<64;i++)r.facts.question('q'+i,3,false);expect(r.facts.question('overflow',1,true)?.problem).toBe('capacity');expect(r.facts.question('q1',2,true)).toBeUndefined();expect(r.facts.snapshot().requests).toHaveLength(0);
});
it('generated browser adapter agrees with the host tracker including strict invalid replay',async()=>{
 execFileSync(process.execPath,['docs/design/art-workflow/space-v1/prepare-stage4.mjs']);
 const modulePath='../docs/design/art-workflow/space-v1/work-facts.generated.js';
 const {WorkFacts:BrowserFacts}=await import(modulePath);
 for(const invalid of [false,true]){
  const a=fixture(),b=fixture(BrowserFacts);
  for(const r of [a,b]){r.start();r.goal();r.end();r.facts.question('q',1,true);r.start(2);r.goal('complete',2,invalid?'wrong':'goal');r.end(2);r.facts.accepted();}
  expect(b.facts.snapshot()).toEqual(a.facts.snapshot());
 }
});

it('keeps actual driver drain separate from turn/goal outcome, then releases active goal demand',()=>{
 const r=fixture();r.facts.status('running');r.start();r.goal();r.end();expect(r.facts.snapshot()).toMatchObject({running:true,category:'goal-progress'});
 expect(r.facts.status('idle')).toMatchObject({running:false,activity:'idle',goal:{known:true,goal:{phase:'active'}}});
});
it('tracks simultaneous ordinary and nested tool identities, one failure is not task failure',()=>{
 const r=fixture();r.start();
 for(const callId of ['a','b'])r.feed('tool/call',{turn:1,step:1,callId,name:'controlled',arguments:'PRIVATE'});
 const nested={rootCallId:'a',parentCallId:'a',subCallId:'a:ptc:1',name:'controlled',arguments:{private:'PRIVATE'}};
 r.feed('tool/ptc-dispatch-start',nested);expect(r.facts.snapshot().tools).toEqual({pending:3,entered:1});
 r.feed('tool/result',{turn:1,step:1,message:{toolCallId:'a',isError:true,content:[]}});
 expect(r.facts.snapshot()).toMatchObject({running:true,category:'working',tools:{pending:2},cue:{kind:'tool-error'}});
 r.feed('tool/ptc-dispatch',{...nested,isError:false,content:[]});expect(r.facts.snapshot().tools.pending).toBe(1);
 expect(JSON.stringify(r.facts.snapshot())).not.toContain('PRIVATE');
});
it.each(['allowed-once','rejected','cancelled','unavailable'])('preserves formal approval outcome %s and only settles its identity',outcome=>{
 const r=fixture();r.start();for(const id of ['one','two'])r.feed('approval/asked',{id,toolName:'controlled'});
 r.feed('approval/decided',{id:'one',outcome});expect(r.facts.snapshot()).toMatchObject({running:true,category:'working',requests:[{id:'two'}],cue:{kind:'approval-'+outcome}});
});
it('projects continued, intent and settlement without storing question text',()=>{
 const r=fixture();const view={active:[{callId:'q',state:'continued',questions:[{question:'PRIVATE',header:'private',options:[],multiSelect:false,intent:{kind:'plan-review'}}]}],settled:[]} as unknown as import('@deepseek-ai/dsh-user-questions').UserQuestionProjectionView;
 r.facts.questions(view,1);expect(r.facts.snapshot().requests).toEqual([{id:'q',kind:'question',state:'continued',intent:'plan-review'}]);
 r.start();r.end();expect(r.facts.snapshot().requests).toHaveLength(1);expect(JSON.stringify(r.facts.snapshot())).not.toContain('PRIVATE');
 r.facts.questions({active:[],settled:[]},2);expect(r.facts.snapshot().cue?.kind).toBe('answered');expect(r.facts.questions(view,1)).toBeUndefined();expect(r.facts.snapshot().requests).toHaveLength(0);
});
it('guards attempt and chunk order; request failure only becomes retry on a new start',()=>{
 const r=fixture();r.start();const id='attempt' as import('@deepseek-ai/dsh-llm').LlmAttemptId;
 const start={type:'start',attemptId:id,revision:1,turn:1,step:1} as const;r.facts.streamFrame(start);
 expect(r.facts.streamFrame({...start,revision:0})).toBeUndefined();
 const chunk={type:'chunk',attemptId:id,revision:2,index:0,time:0,chunk:{type:'reasoning-delta',index:0,text:'PRIVATE'}} as const;
 expect(r.facts.streamFrame(chunk)?.activity).toBe('reasoning');expect(r.facts.streamFrame(chunk)).toBeUndefined();
 expect(r.facts.requestFailed()?.cue?.kind).toBe('request-failed');expect(r.facts.snapshot().category).toBe('working');
 expect(r.facts.streamFrame({...start,revision:3,attemptId:'new' as typeof id})?.cue?.kind).toBe('retry');
 expect(r.facts.streamFrame({...chunk,index:1})).toBeUndefined();expect(JSON.stringify(r.facts.snapshot())).not.toContain('PRIVATE');
 r.end();expect(r.facts.streamFrame({...start,revision:4})).toBeUndefined();
});
it('restores fork/interruption without replay and rejects callbacks from a replaced source',async()=>{
 const {WorkSources}=await import('../src/work-sources.ts');const published:ReturnType<WorkFacts['snapshot']>[]=[];const sources=new WorkSources(f=>published.push(f));
 const r=fixture();r.start();r.end(1,'forked');expect(r.facts.snapshot()).toMatchObject({category:'reply',needsAttention:false});
 const history=[{type:'turn/start',data:{turn:1},seq:0,time:0},{type:'turn/end',data:{turn:1,reason:{kind:'interrupted'}},seq:1,time:0}] as SessionEvent[];
 const old=sources.attach('A',history,'idle');expect(published.at(-1)).toMatchObject({cue:null,resultId:null,needsAttention:false});
 const fresh=sources.attach('A',history,'running');const count=published.length;old.status('idle');old.requestFailed();old.detach();expect(published).toHaveLength(count);
 fresh.detach();expect(published.at(-1)).toMatchObject({epoch:2,driver:'unknown'});const n=published.length;fresh.status('running');expect(published).toHaveLength(n);
});
it('an empty timed projection cannot erase a live blocking runtime question',()=>{
 const r=fixture();r.facts.question('runtime',1,'open');r.facts.questions({active:[],settled:[]},2);expect(r.facts.snapshot().requests).toHaveLength(1);
 r.facts.question('runtime',3,'settled');expect(r.facts.snapshot().requests).toHaveLength(0);
});

it('unknown driver retains known in-flight calls until authoritative idle or exact result',()=>{
 const r=fixture();r.start();r.feed('tool/call',{turn:1,step:1,callId:'pending',name:'controlled',arguments:'{}'});
 expect(r.facts.status('unknown')).toMatchObject({driver:'unknown',activity:'unknown',tools:{pending:1}});
 expect(r.facts.status('running')).toMatchObject({activity:'tools',tools:{pending:1}});
 expect(r.facts.status('idle')).toMatchObject({activity:'idle',tools:{pending:0}});
});

it('acknowledges only the current error identity, even after a known idle detach',async()=>{
 const {WorkSources}=await import('../src/work-sources.ts');let last:ReturnType<WorkFacts['snapshot']>;const owner=new WorkSources(f=>{last=f;});const handle=owner.attach('ack',[],'running');handle.event({type:'turn/start',seq:0,time:0,data:{turn:1}} as SessionEvent);handle.event({type:'turn/end',seq:1,time:1,data:{turn:1,reason:{kind:'error',error:{message:'PRIVATE'}}}} as unknown as SessionEvent);
 handle.detach('idle');expect(last!.needsAttention).toBe(true);expect(owner.acknowledge('ack',last!.epoch,last!.revision-1)).toBe(false);expect(owner.acknowledge('ack',last!.epoch,last!.revision)).toBe(true);expect(last!.needsAttention).toBe(false);
});
