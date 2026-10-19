import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require=createRequire(import.meta.url),profile=await mkdtemp(join(tmpdir(),'coopanion-space-'));
const child=spawn(require('electron'),[new URL('../desktop/space-preview.cjs',import.meta.url).pathname],{stdio:'inherit',env:{...process.env,DSH_PET_TEST_DATA_DIR:profile}});
child.on('exit',async code=>{await rm(profile,{recursive:true,force:true});process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
