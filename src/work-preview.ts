/** Typed, explicitly simulated input for the authoring page, never a host source. */
import { WorkFacts } from './work-facts.ts';
import type { SessionEvent, SessionEventMap } from '@deepseek-ai/dsh-session';
import type { AssistantStreamFrame } from '@deepseek-ai/dsh-agent';
import type { ToolCallId, LlmAttemptId, MessageId } from '@deepseek-ai/dsh-llm';
import type { GoalSnapshot } from '@deepseek-ai/dsh-goal';
import type { ApprovalRequestId, ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
export { WorkFacts } from './work-facts.ts';
export class WorkPreview {
  readonly adapter: WorkFacts;
  private seq=0; private turn=0; private open=false; private serial=0; private qrev=0; private attempt=0; private streamRevision=0; private index=0;
  private goal: {id:GoalSnapshot['id'];revision:number;phase:'active'|'complete'} | null=null;
  private approvals: ApprovalRequestId[]=[]; private questions:string[]=[]; private calls:ToolCallId[]=[];
  private last:SessionEvent | null=null;
  constructor(id:string, private send:(fact:ReturnType<WorkFacts['snapshot']>|undefined)=>void,epoch=1) {this.adapter=new WorkFacts(id,epoch);}
  private emit<T extends keyof SessionEventMap>(type:T,data:SessionEventMap[T]) {
    const event={type,data,seq:this.seq++,time:Date.now()} as SessionEvent;
    this.last=event;this.send(this.adapter.consume(event));
  }
  private begin() {if(!this.open){this.turn++;this.open=true;this.send(this.adapter.status('running'));this.emit('turn/start',{turn:this.turn});}}
  private setGoal(phase:'active'|'complete') {
    const create=!this.goal || this.goal.phase==='complete';
    if(create)this.goal={id:('preview-goal-'+ ++this.serial) as GoalSnapshot['id'],revision:0,phase};
    const goal=this.goal!;goal.phase=phase;goal.revision++;
    this.emit('goal/change',{kind:'goal/change',version:1,operation:create?'create':'complete',goal:{...goal,objective:'模拟目标',maxGoalRounds:8},roundsStarted:0,createdAt:0,updatedAt:goal.revision});
  }
  private end(kind:'completed'|'max-tokens'|'aborted'|'error') {
    this.emit('turn/end',{turn:this.turn,reason:kind==='aborted'?{kind,reason:{kind:'user'}}:kind==='error'?{kind,error:{code:'CONTROLLED',message:'simulated'}}:{kind}});
    this.open=false;this.approvals=[];this.calls=[];this.send(this.adapter.status('idle'));
  }
  private frame(frame:AssistantStreamFrame){this.send(this.adapter.streamFrame({...frame,revision:++this.streamRevision}));}
  private stream(kind:'reasoning'|'generating'|'tool-arguments') {
    this.begin();const attemptId=('preview-attempt-'+ ++this.attempt) as LlmAttemptId;this.index=0;
    this.frame({type:'start',attemptId,revision:this.attempt,turn:this.turn,step:1});
    const chunk=kind==='reasoning'?{type:'reasoning-delta' as const,index:0,text:'private simulation'}:kind==='generating'?{type:'text-delta' as const,index:0,text:'simulated output'}:{type:'tool-call-delta' as const,index:0,id:'preview-call' as ToolCallId,argumentsDelta:'{}'};
    this.frame({type:'chunk',attemptId,revision:this.attempt,index:this.index++,time:Date.now(),chunk});
  }
  act(kind:string,outcome:ApprovalOutcome='allowed-once') {
    if(kind==='start'){this.begin();if(!this.goal || this.goal.phase==='complete')this.setGoal('active');}
    else if(kind==='accepted')this.adapter.accepted();
    else if(kind==='progress'){this.begin();if(!this.goal || this.goal.phase==='complete')this.setGoal('active');this.end('completed');}
    else if(kind==='reply'){this.begin();this.end('completed');}
    else if(kind==='complete'){this.begin();if(!this.goal || this.goal.phase==='complete')this.setGoal('active');this.setGoal('complete');this.end('completed');}
    else if(kind==='approval'){this.begin();const id=('preview-approval-'+ ++this.serial) as ApprovalRequestId;this.approvals.push(id);this.emit('approval/asked',{id,toolName:'controlled'});}
    else if(kind==='approved'){const id=this.approvals.shift();if(id)this.emit('approval/decided',{id,outcome});}
    else if(kind==='question'){const id='preview-question-'+ ++this.serial;this.questions.push(id);this.send(this.adapter.question(id,++this.qrev,'open'));}
    else if(kind==='continued'){const id=this.questions[0];if(id)this.send(this.adapter.question(id,++this.qrev,'continued'));}
    else if(kind==='answered'){const id=this.questions.shift();if(id)this.send(this.adapter.question(id,++this.qrev,'settled'));}
    else if(kind==='error'||kind==='limit'||kind==='cancel'){this.begin();this.end(kind==='error'?'error':kind==='limit'?'max-tokens':'aborted');}
    else if(kind==='disconnect')this.send(this.adapter.status('unknown'));
    else if(kind==='reconnect')this.send(this.adapter.status(this.open?'running':'idle'));
    else if(kind==='ack')this.send(this.adapter.acknowledge());
    else if(kind==='repeat'&&this.last)this.send(this.adapter.consume(this.last));
    else if(kind==='reasoning'||kind==='generating'||kind==='tool-arguments')this.stream(kind);
    else if(kind==='retry'){this.begin();this.send(this.adapter.requestFailed());this.stream('reasoning');}
    else if(kind==='tool'){this.begin();const callId=('preview-tool-'+ ++this.serial) as ToolCallId;this.calls.push(callId);this.emit('tool/call',{turn:this.turn,step:1,callId,name:'controlled',arguments:'{}'});}
    else if(kind==='tool-done'||kind==='tool-error'){const callId=this.calls.shift();if(callId)this.emit('tool/result',{turn:this.turn,step:1,message:{id:('result-'+ ++this.serial) as MessageId,source:{kind:'tool',callId},role:'tool',toolCallId:callId,isError:kind==='tool-error',content:[{type:'text',text:'simulated result'}]}});}
    return this.adapter.snapshot();
  }
}
