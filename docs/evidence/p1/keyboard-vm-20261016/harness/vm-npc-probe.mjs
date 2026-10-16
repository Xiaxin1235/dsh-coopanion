import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, release } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [packageArg, outputArg] = process.argv.slice(2);
const packageRoot=resolve(packageArg), output=resolve(outputArg), require=createRequire(join(packageRoot,'package.json'));
const {_electron}=require('playwright-core');
const {listDiagnostics,readDiagnostics}=await import(pathToFileURL(join(packageRoot,'scripts/diagnostics-client.mjs')));
const profile=await mkdtemp(join(tmpdir(),'coop-vm-input-'));await mkdir(output,{recursive:true});
let app;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function phase(name){await writeFile(join(output,'phase.json'),JSON.stringify({phase:name}));console.log('PHASE '+name);}
const report={build:JSON.parse(await readFile(join(packageRoot,'dist/build-info.json'),'utf8')),platform:process.platform,arch:process.arch,kernel:release(),node:process.version,controlledPerception:false,hypervisorInjectedInput:true,physicalHardwareValidated:false,phases:{}};
try {
 assert.equal(report.build.commit,'555503ef54e1375b084a6bc34d9472e9726658be');assert.equal(report.build.dirty,false);
 app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',join(packageRoot,'desktop/main.cjs')],env:{...process.env,DSH_PET_TEST_DATA_DIR:profile,DSH_PET_TEST_DIAGNOSTICS_DIR:join(profile,'diagnostics'),DSH_PET_TEST_NO_SANDBOX:'1'}});
 const page=await app.firstWindow();await app.evaluate((_,options)=>process.emit('message',{type:'init',baseline:true,options,snapshot:{mood:'idle',active:false,sessionId:null,sessions:[],results:[]}}),{size:180,roam:true,companionship:'quiet',diagnostics:true,notifications:false,npcHome:.85,npcRange:.3,bubbleDurationMs:12000});
 await page.waitForSelector('#pet[data-mode]');
 let endpoint;
 for(let i=0;i<100;i++){[endpoint]=await listDiagnostics(join(profile,'diagnostics'));if(endpoint)break;await pause(100);}
 const sample=async()=>{const data=await readDiagnostics(endpoint);assert.ok(data.value.renderer?.npc);return data.value.renderer.npc;};
 let state;const deadline=performance.now()+90000;
 while(performance.now()<deadline){state=await sample();if(['failed','missing-dependency','protocol-error'].includes(state.keyboardStatus))throw Error('Keyboard backend '+state.keyboardStatus);if(state.phase==='outbound')break;await pause(500);}
 report.initial=state;assert.equal(state.phase,'outbound','Expected natural initial exploration');assert.equal(state.keyboard,'idle');
 for(const[name,duration]of[['typing',8000],['short-pause',3000],['typing-again',4000],['mouse-only',35000]]){
  await phase(name);const counts={active:0,idle:0,unknown:0},phases={},reasons={};let stableIdleSince=null,maxIdleMs=0;
  const began=performance.now();const settled={active:0,idle:0,unknown:0};
  while(performance.now()-began<duration){
   state=await sample();const now=performance.now();counts[state.keyboard]++;phases[state.phase]=(phases[state.phase]??0)+1;reasons[state.reason]=(reasons[state.reason]??0)+1;
   if(name==='mouse-only'&&now-began>=3000)settled[state.keyboard]++;
   if(state.keyboard==='idle'){stableIdleSince??=now;maxIdleMs=Math.max(maxIdleMs,now-stableIdleSince);}else stableIdleSince=null;
   await pause(500);
  }
  report.phases[name]={counts,npcPhases:phases,reasons,maxIdleMs:Math.round(maxIdleMs),...(name==='mouse-only'?{settled}: {})};
 }
 const p=report.phases;
 assert.ok(p.typing.counts.active>=5&&p.typing.reasons.input>=5,'Injected keyboard must yield NPC');
 assert.ok(!p['short-pause'].npcPhases.outbound&&!p['short-pause'].npcPhases.observe,'Short pause must not resume exploration');
 assert.ok(p['typing-again'].reasons.input>=2,'Renewed typing resets pause');
 assert.equal(p['mouse-only'].settled.active,0,'Mouse must not look like keyboard');assert.equal(p['mouse-only'].settled.unknown,0);
 assert.ok(p['mouse-only'].maxIdleMs>=12000);assert.ok(p['mouse-only'].npcPhases.outbound||p['mouse-only'].npcPhases.observe,'Stable idle must resume retained exploration');
 report.passed=true;
} catch(error){report.passed=false;report.error=String(error?.stack??error);process.exitCode=1;}
finally{await app?.close();await rm(profile,{recursive:true,force:true});await writeFile(join(output,'result.json'),JSON.stringify(report,null,2)+'\n');await phase('done');console.log('RESULT '+JSON.stringify({passed:report.passed,error:report.error}));}
