// Temporary CI diagnosis: enum-only helper boundaries, never keyboard payloads.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const { createKeyboardActivity } = createRequire(import.meta.url)('../../desktop/keyboard-activity.cjs');
const mode = process.argv[2];
if (!['factory','uncapped','shell-only'].includes(mode)) throw Error('Bad probe mode');
const began = performance.now(), elapsed = () => Math.round(performance.now() - began);
const events = [], statuses = [], counts = { active: 0, idle: 0, unknown: 0, other: 0 };
let child, firstOutputMs = null, exitResult, stderr = '';
const adapter = createKeyboardActivity({ start(command,args,options) {
  args = [...args];
  if (mode === 'shell-only') args[args.length-1] = "[Console]::Error.WriteLine('probe:shell');[Console]::Out.WriteLine('idle');[Console]::Out.Flush();Start-Sleep -Seconds 45";
  else args[args.length-1] = args.at(-1).replace('try { Add-Type', "try { [Console]::Error.WriteLine('probe:shell'); Add-Type").replace('; [KeyboardActivity]::Run', "; [Console]::Error.WriteLine('probe:compiled'); [KeyboardActivity]::Run").replace("catch { [Console]::Out.WriteLine('unknown');", "catch { [Console]::Error.WriteLine('probe:error:'+ $_.Exception.GetType().FullName + ':' + $_.Exception.Message); [Console]::Out.WriteLine('unknown');");
  events.push({ms:elapsed(),event:'spawn',windowsHide:options.windowsHide});
  child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe']});
  child.once('error',error=>events.push({ms:elapsed(),event:'error',code:error.code}));
  child.once('exit',(code,signal)=>{exitResult={code,signal,ms:elapsed()};events.push({event:'exit',...exitResult});});
  child.stdout.on('data',chunk=>{firstOutputMs??=elapsed();for(const line of chunk.toString().trim().split(/\r?\n/)){if(Object.hasOwn(counts,line))counts[line]++;else counts.other++;} events.push({ms:elapsed(),event:'stdout',bytes:chunk.length});});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);events.push({ms:elapsed(),event:'stderr',text:chunk.toString().slice(0,1000)});});
  return child;
}});
adapter.configure(true);
let verdict;
try {
  for(let i=0;i<90;i++) {
    if(mode==='uncapped') {if(firstOutputMs!==null||exitResult)break;}
    else {const observation=adapter.inspect();if(statuses.at(-1)?.status!==observation.status)statuses.push({ms:elapsed(),...observation});if(['failed','protocol-error','missing-dependency'].includes(observation.status))break;if(elapsed()>=10000&&observation.status!=='starting')break;}
    await new Promise(r=>setTimeout(r,500));
  }
  if(mode!=='uncapped')verdict=adapter.inspect();
} finally {adapter.configure(false);await new Promise(r=>setTimeout(r,1000));if(child&&child.exitCode===null)child.kill('SIGKILL');}
const hashes={};for(const name of ['desktop/keyboard-activity.cjs','desktop/keyboard-activity-win.cs'])hashes[name]=createHash('sha256').update(await readFile(name)).digest('hex');
const report={probeOnly:true,mode,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,hashes,firstOutputMs,verdict,statuses,counts,exitResult,stderr,events};
await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/windows-keyboard-startup-${mode}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(mode==='factory'&&['failed','protocol-error','missing-dependency','starting'].includes(verdict?.status))process.exitCode=1;
if(mode==='uncapped'&&firstOutputMs===null)process.exitCode=1;
