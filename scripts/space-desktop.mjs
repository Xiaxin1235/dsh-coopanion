import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { temporary } from './lib/local-cache.mjs';
const require=createRequire(import.meta.url),run=await temporary('space-preview'),profile=run.path;
let child;
try { child=spawn(require('electron'),[new URL('../desktop/space-preview.cjs',import.meta.url).pathname],{stdio:'inherit',env:{...process.env,DSH_PET_TEST_DATA_DIR:profile}}); }
catch(error) { await run.dispose(); throw error; }
child.on('error',async error=>{console.error(error);await run.dispose();process.exitCode=1;});
child.on('exit',async code=>{await run.dispose();process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
