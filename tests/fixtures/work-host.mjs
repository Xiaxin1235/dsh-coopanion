import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {WorkSources} from './adapter.mjs';
export const inject=['appReady','appExit','llm','agents','sessions','sessionController','sessionProjections','goals','approval','userQuestions'];
export function apply(ctx){
 ctx.effect(()=>ctx.appReady.onReady(()=>{setTimeout(async()=>{
 try {
  const load=name=>import(pathToFileURL(join(process.env.WORK_MODULES,'@deepseek-ai',name,'lib/index.js')).href);
  const {LlmAdapter,createUserMessage}=await load('dsh-llm');
  const facts=[],events=[],frames=[],statuses=[],handles=new Map();const sources=new WorkSources(f=>facts.push(f));
  const projection=session=>ctx.sessionProjections.snapshot(session,['userQuestions']).values.userQuestions;
  const attach=agent=>{if(agent.session.header.origin==='subagent')return;const h=sources.attach(agent.session.id,agent.session.snapshotEvents(),agent.status,projection(agent.session));handles.set(agent,h);return h;};
  ctx.on('agent/created',({agent})=>{attach(agent);});
  ctx.on('agent/status',({agent,status})=>{statuses.push(status);handles.get(agent)?.status(status);});
  ctx.on('agent/assistant-stream',({agent,frame})=>{frames.push({type:frame.type,chunk:frame.chunk?.type,revision:frame.revision,index:frame.index,turn:frame.turn,attemptId:frame.attemptId});handles.get(agent)?.stream(frame);});
  ctx.on('agent/request-error',async({agent},next)=>{handles.get(agent)?.requestFailed();return mode==='retry'?{kind:'retry'}:mode==='error'?undefined:next();},true);
  ctx.on('agent/disposed',({agent})=>handles.get(agent)?.detach());
  ctx.on('session/event',(session,event)=>{events.push({type:event.type,seq:event.seq});for(const [a,h] of handles)if(a.session===session){h.event(event);h.questions(projection(session));}});
  let outcome='allowed-once';ctx.on('approval/request',async()=>outcome,true);
  let runtimeQuestions=0;
  ctx.on('user-questions/request',async(request,next)=>{
    const h=handles.get(request.agent),id=request.wait?.callId??'runtime-'+ ++runtimeQuestions;
    h?.question(id,'open');try{return {answers:[{id:'q',selected:[],custom:'controlled'}]};}finally{h?.question(id,'settled');}
  },true);
  let agent,requests=0,mode='normal',failedOnce=false,cancelEntered=false;
  class Controlled extends LlmAdapter {
   async listModels(){return [{provider:'work-script',id:'controlled',name:'Controlled work facts'}];}
   async *stream(options){
    if(options.messages.some(m=>m.source?.kind==='dsh-session-title-llm')){yield {type:'block-end',index:0,block:{type:'text',text:'Controlled title'}};yield {type:'finish',reason:{kind:'stop'}};return;}
    const n=++requests;assert.ok(n<20,'bounded controlled model calls');
    if(mode==='error'||mode==='retry'&&!failedOnce){failedOnce=true;yield {type:'finish',reason:{kind:'error',failure:{code:'CONTROLLED_FAILURE',message:'controlled failure'}}};return;}
    if(mode==='limit'){yield {type:'finish',reason:{kind:'max-tokens'}};return;}
    if(mode==='cancel'){cancelEntered=true;await new Promise(resolve=>{if(options.signal.aborted)resolve();else options.signal.addEventListener('abort',resolve,{once:true});});yield {type:'finish',reason:{kind:'aborted',failure:{code:'ABORTED',message:'controlled cancellation'}}};return;}
    if(n===1){
      for(const next of ['allowed-once','rejected','cancelled','unavailable']){outcome=next;assert.equal(await ctx.approval.request({agent,toolName:'controlled',callId:'control-approval'}),next);}
      await ctx.userQuestions.ask({agent,questions:[{id:'q',question:'PRIVATE runtime question'}]});
    }
    yield {type:'block-start',index:0,blockType:'reasoning'};
    yield {type:'reasoning-delta',index:0,text:'PRIVATE reasoning'};
    yield {type:'block-end',index:0,block:{type:'reasoning',text:'PRIVATE reasoning'}};
    const block=n===1?{type:'tool-call',id:'create-goal',name:'create_goal',arguments:JSON.stringify({objective:'PRIVATE objective',max_goal_rounds:3})}:n===3?{type:'tool-call',id:'complete-goal',name:'update_goal',arguments:JSON.stringify({goal_id:ctx.goals.get(agent).id,revision:ctx.goals.get(agent).revision,action:'complete'})}:{type:'text',text:'PRIVATE reply'};
    yield {type:'block-start',index:1,blockType:block.type,...(block.type==='tool-call'?{id:block.id,name:block.name}:{})};
    if(block.type==='text')yield {type:'text-delta',index:1,text:block.text};
    else yield {type:'tool-call-delta',index:1,id:block.id,name:block.name,argumentsDelta:block.arguments};
    yield {type:'block-end',index:1,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
   }
  }
  ctx.llm.registerAdapter(['work-script'],new Controlled());
  const created=await ctx.sessionController.create({sessionId:'work-controlled',cwd:process.env.DSH_HOME});
  await ctx.sessionController.selectModel({sessionId:created.sessionId,provider:'work-script',model:'controlled'});agent=ctx.agents.get(created.sessionId);if(!handles.has(agent))attach(agent);
  agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Controlled lifecycle'}]}));
  const deadline=Date.now()+20000;
  while(ctx.goals.get(agent)?.phase!=='complete'||agent.status!=='idle'){assert.ok(Date.now()<deadline,'controlled goal timeout '+JSON.stringify({requests,status:agent.status,goal:ctx.goals.get(agent),events:agent.session.snapshotEvents().map(e=>({type:e.type,data:['turn/end','tool/result'].includes(e.type)?e.data:undefined})),last:facts.at(-1)}));await new Promise(r=>setTimeout(r,10));}
  assert.ok(statuses.includes('running')&&statuses.includes('idle'));for(const activity of ['reasoning','generating','tool-arguments','tools'])assert.ok(facts.some(f=>f.activity===activity),activity+' '+JSON.stringify({frames,facts:facts.map(f=>[f.revision,f.driver,f.activity,f.category])}));
  for(const next of ['allowed-once','rejected','cancelled','unavailable'])assert.ok(facts.some(f=>f.cue?.kind==='approval-'+next),next);
  assert.ok(facts.some(f=>f.requests.some(q=>q.kind==='question')),'runtime question visible');
  assert.ok(facts.some(f=>f.category==='goal-progress'));assert.ok(facts.some(f=>f.category==='completed'));
  assert.equal(facts.at(-1).running,false);assert.equal(facts.at(-1).requests.length,0);assert.ok(!JSON.stringify(facts).includes('PRIVATE'));
  const run=async selected=>{
    mode=selected;failedOnce=false;cancelEntered=false;
    const ends=agent.session.snapshotEvents().filter(e=>e.type==='turn/end').length;
    agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Controlled '+selected}]}));
    const until=Date.now()+10000;
    if(selected==='cancel'){while(!cancelEntered){assert.ok(Date.now()<until,'cancel entry timeout');await new Promise(r=>setTimeout(r,5));}agent.cancel({kind:'user'});}
    while(agent.status!=='idle'||agent.session.snapshotEvents().filter(e=>e.type==='turn/end').length===ends){assert.ok(Date.now()<until,selected+' settlement timeout');await new Promise(r=>setTimeout(r,5));}
    return facts.at(-1);
  };
  await run('retry');assert.ok(facts.some(f=>f.cue?.kind==='request-failed'));assert.ok(facts.some(f=>f.cue?.kind==='retry'));
  assert.equal((await run('error')).category,'error');assert.equal((await run('limit')).category,'max-tokens');assert.equal((await run('cancel')).category,'stopped');

  // Public append/projection contract. Deliberately controlled structural events;
  // these do not claim an external process or PTC body actually executed.
  const s=ctx.sessions.create('work-projection');const h=sources.attach(s.id,[],'running');
  const feed=(type,data,options)=>{s.append(type,data,options);h.event(s.snapshotEvents().at(-1));h.questions(projection(s));};
  feed('turn/start',{turn:1});
  const baseHeader=agent.session.snapshotEvents().find(e=>e.type==='request/header').data;
  feed('request/header',{...baseHeader,header:{...baseHeader.header,tools:[{name:'ask_user_question',description:'controlled',parameters:{type:'object',properties:{timeout:{type:'integer'}}}}]}});
  feed('tool/call',{turn:1,step:1,callId:'continued-full',name:'ask_user_question',arguments:JSON.stringify({questions:[{id:'q',question:'PRIVATE projection'}]})});
  assert.equal(facts.at(-1).requests[0].state,'open');
  const message={role:'tool',id:'pending-result',source:{kind:'tool',callId:'continued-full'},toolCallId:'continued-full',content:[{type:'text',text:JSON.stringify({pending:true,callId:'continued-full'})}]};
  feed('tool/result',{turn:1,step:1,message},{surfaceOp:'append'});feed('turn/end',{turn:1,reason:{kind:'completed'}});h.status('idle');assert.equal(facts.at(-1).requests[0].state,'continued');
  feed('turn/start',{turn:2});feed('user/message',{role:'user',id:'late',source:{kind:'user-question-reply',callId:'continued-full',outcome:'answered'},content:[{type:'text',text:JSON.stringify({answers:[{id:'q',selected:[],custom:'controlled'}]})}]},{surfaceOp:'append'});assert.equal(facts.at(-1).requests.length,0);
  h.status('running');const nested={rootCallId:'root',parentCallId:'root',subCallId:'sub',name:'controlled',arguments:{}};feed('tool/ptc-dispatch-start',nested);assert.equal(facts.at(-1).tools.entered,1);h.status('unknown');assert.equal(facts.at(-1).tools.pending,1);h.status('running');assert.equal(facts.at(-1).activity,'tools');feed('tool/ptc-dispatch',{...nested,isError:true,content:[]});assert.equal(facts.at(-1).tools.pending,0);assert.equal(facts.at(-1).category,'working');
  feed('turn/end',{turn:2,reason:{kind:'interrupted'}});h.status('idle');
  const history=s.snapshotEvents();const replacement=sources.attach(s.id,history,'idle',projection(s));assert.equal(facts.at(-1).cue,null);assert.equal(facts.at(-1).needsAttention,false);const count=facts.length;h.status('running');h.requestFailed();assert.equal(facts.length,count);replacement.detach();assert.equal(facts.at(-1).driver,'unknown');
  process.send?.({type:'work-result',result:{status:'pass',requests,statuses,events,frames,facts,cases:{realModelStream:true,realDriverStatus:true,realOrdinaryTools:true,realGoalLifecycle:true,realApprovalFourOutcomes:true,realRuntimeQuestion:true,realRecoveryAttempt:true,realTerminalError:true,realOutputLimit:true,realUserCancellation:true,controlledProjectionContinued:true,controlledNestedEventContract:true,restoreNoReplay:true,sourceReplacement:true,unknownRetainsCalls:true,metadataPrivacy:true}}});
 }catch(error){process.send?.({type:'work-result',error:String(error.stack??error)});}
 },0);}));
 ctx.effect(()=>{const listener=m=>{if(m?.type==='shutdown-host')ctx.appExit(0);};process.on('message',listener);return ()=>process.off('message',listener);});
}
