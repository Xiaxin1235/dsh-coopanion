// Actual published profile loader, isolated home, controlled LLM; no daily plugin install.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const {values}=parseArgs({options:{runtime:{type:'string'},version:{type:'string'},output:{type:'string'}}});
assert.ok(values.runtime&&values.version&&values.output,'provide --runtime --version --output');
const modules=join(resolve(values.runtime),'node_modules'),root=realpathSync(await mkdtemp(join(tmpdir(),'coopanion-work-host-'))),home=join(root,'home'),profile=join(home,'profiles/work');
const output=resolve(values.output),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={kind:'published-profile-loader-controlled-model',version:values.version,node:process.version,baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:{},packages:{}};
let host,logs='';
try {
 for(const file of ['src/work-facts.ts','src/work-sources.ts','src/completion.ts','tests/fixtures/work-host.mjs','tests/work-host-contract.mjs'])report.sources[file]=sha(await readFile(file));
 for(const name of ['dsh','dsh-agent','dsh-llm','dsh-goal','dsh-session','dsh-tools','dsh-user-approval','dsh-user-questions']){
  const base=join(modules,'@deepseek-ai',name);assert.equal(JSON.parse(await readFile(join(base,'package.json'),'utf8')).version,values.version);
  report.packages[name]=sha(await readFile(join(base,'lib',name==='dsh'?'bin.js':'index.js')));
 }
 await mkdir(profile,{recursive:true});const observer=join(root,'observer');await mkdir(observer);
 await writeFile(join(observer,'package.json'),JSON.stringify({name:'coopanion-work-observer',private:true,type:'module'}));
 await build({entryPoints:[resolve('src/work-sources.ts')],outfile:join(observer,'adapter.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'host-goal',setup(b){b.onResolve({filter:/^@deepseek-ai\/dsh-goal$/},()=>({path:join(modules,'@deepseek-ai/dsh-goal/lib/index.js'),external:true}));}}]});
 report.adapterSha256=sha(await readFile(join(observer,'adapter.mjs')));
 const fixture=join(observer,'host.mjs');await writeFile(fixture,await readFile('tests/fixtures/work-host.mjs'));
 await writeFile(join(profile,'package.json'),JSON.stringify({private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}}));
 await writeFile(join(profile,'cordis.patch.yml'),`- insert:\n    - id: work-contract\n      name: ${JSON.stringify(fixture)}\n`);
 const env={...process.env,DSH_HOME:home,DSH_TELEMETRY_DISABLED:'1',WORK_MODULES:modules,XDG_CONFIG_HOME:root,XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data'),XDG_STATE_HOME:join(root,'state')};
 host=spawn(process.execPath,[join(modules,'@deepseek-ai/dsh/lib/bin.js'),'--profile','work','--no-open','--port','0'],{cwd:root,env,stdio:['ignore','pipe','pipe','ipc']});
 host.stdout.on('data',c=>logs=(logs+c).slice(-20000));host.stderr.on('data',c=>logs=(logs+c).slice(-20000));
 Object.assign(report,await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('Host timeout: '+logs)),45000);host.on('message',m=>{if(m?.type==='work-result'){clearTimeout(timer);m.error?rej(Error(m.error)):res(m.result);}});host.on('exit',code=>{clearTimeout(timer);rej(Error('Host exited '+code+': '+logs));});}));
}catch(error){report.status='fail';report.error=String(error.stack??error);report.logs=logs;throw error;}
finally {
 if(host?.connected){const done=once(host,'exit');host.send({type:'shutdown-host'});const timer=setTimeout(()=>host.kill('SIGKILL'),10000);const [code,signal]=await done;clearTimeout(timer);report.shutdown={code,signal};}
 await mkdir(output,{recursive:true});await writeFile(join(output,`host-${values.version}.json`),JSON.stringify(report,null,2)+'\n');await rm(root,{recursive:true,force:true});
}
assert.equal(report.shutdown.code,0);assert.equal(report.shutdown.signal,null);console.log('Work host passed: '+values.version);
