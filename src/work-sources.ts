import { WorkFacts, type WorkFact } from './work-facts.ts';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { AssistantStreamFrame } from '@deepseek-ai/dsh-agent';
import type { UserQuestionProjectionView } from '@deepseek-ai/dsh-user-questions';
/** Trusted host attachment owner. A closure from a disposed/replaced Agent can
 * never write into its replacement, even if its revision restarts at one. */
export class WorkSources {
  private sources=new Map<string,{epoch:number;facts:WorkFacts;live:boolean}>();
  constructor(private publish:(fact:WorkFact)=>void) {}
  attach(id:string,events:readonly SessionEvent[],status:'idle'|'running',questions?:UserQuestionProjectionView) {
    const old=this.sources.get(id);
    if(!old && this.sources.size>=32)throw Error('Work source capacity reached; unresolved sources retained');
    const source={epoch:(old?.epoch??0)+1,facts:new WorkFacts(id,(old?.epoch??0)+1),live:true};
    this.sources.set(id,source);this.publish(source.facts.restore(events,status,questions));
    let questionRevision=0;
    const emit=(update:()=>WorkFact|undefined)=>{if(!source.live||this.sources.get(id)!==source)return;const fact=update();if(fact)this.publish(fact);};
    return {
      epoch:source.epoch,
      event:(event:SessionEvent)=>emit(()=>source.facts.consume(event)),
      status:(status:'idle'|'running'|'unknown')=>emit(()=>source.facts.status(status)),
      stream:(frame:AssistantStreamFrame)=>emit(()=>source.facts.streamFrame(frame)),
      requestFailed:()=>emit(()=>source.facts.requestFailed()),
      questions:(view:UserQuestionProjectionView)=>emit(()=>source.facts.questions(view,++questionRevision)),
      question:(id:string,state:'open'|'continued'|'settled',intent?:'plan-review')=>emit(()=>source.facts.question(id,++questionRevision,state,intent)),
      acknowledge:()=>emit(()=>source.facts.acknowledge()),
      detach:()=>{emit(()=>source.facts.status('unknown'));source.live=false;},
    };
  }
}
