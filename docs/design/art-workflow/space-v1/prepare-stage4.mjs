// Bundle the shared tracker and the installed public strict goal projection.
// The goal package's barrel also constructs its unused decorated server service.
// Mark only that construction pure so esbuild can remove the host-only branch;
// no projection/fold/decision code is substituted. Reject remaining host imports.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const output=new URL('./work-facts.generated.js',import.meta.url);
const result=await build({entryPoints:[new URL('../../../../src/work-preview.ts',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,plugins:[{name:'omit-unused-goal-service',setup(build){
  build.onLoad({filter:/@deepseek-ai\/dsh-goal\/lib\/index\.js$/},async args=>{
    const contents=await readFile(args.path,'utf8'),marker='let GoalService = (() => {';
    if(!contents.includes(marker))throw Error('Goal package layout changed; review browser preparation before use');
    return {contents:contents.replace(marker,'let GoalService = /* @__PURE__ */ (() => {'),loader:'js'};
  });
  build.onResolve({filter:/^(node:|@deepseek-ai\/(dsh-agent|dsh-session$|dsh-llm|dsh-typert-protocol))/},args=>({path:args.path,external:true,sideEffects:false}));
}}]});
if(Object.values(result.metafile.outputs).some(o=>o.imports.length))throw Error('Preview fact adapter retained host imports');
await writeFile(output,result.outputFiles[0].contents);
console.log('Prepared Stage 4 simulated-fact adapter from src/work-preview.ts and installed strict goal projection');
