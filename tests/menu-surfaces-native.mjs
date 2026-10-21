// Disposable real store + Electron IPC; desktop operations remain serial.
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { checkMenuSurface, menuSnapshot } from './helpers/menu-surfaces.mjs';
const require=createRequire(import.meta.url),{CompanionStore}=require('../dist/companion-store.cjs');
const directory=await mkdtemp(join(tmpdir(),'dsh-menu-native-')),store=new CompanionStore(join(directory,'companionship-v1'));
for(let i=0;i<16;i++){const current=await store.request({type:'read',characterId:'whale'});await store.request({type:i%2?'play':'pet',characterId:'whale',requestId:`native-menu-${i}`,revision:current.revision,memoryGeneration:current.memory.generation});}
await store.close();
const out=process.env.MENU_EVIDENCE_DIR??await mkdtemp(join(tmpdir(),'dsh-menu-native-shots-')),checks=[];await mkdir(out,{recursive:true});let app;
try {
  app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',resolve('desktop/main.cjs')],env:{...process.env,DSH_PET_TEST_DATA_DIR:directory,DSH_PET_TEST_NO_SANDBOX:'1',DSH_PET_TEST_DEBUG_PORT:'0'}});
  const page=await app.firstWindow();await page.waitForSelector('#pet[data-mode]');await page.emulateMedia({reducedMotion:'reduce'});
  const send=value=>app.evaluate((_,message)=>process.emit('message',message),value);
  await send({type:'init',baseline:true,options:{locale:'zh',textScale:1,size:180,roam:false,companionship:'off'},snapshot:menuSnapshot});
  for(const locale of ['zh','en']) for(const textScale of [1,1.25,1.5]) checks.push(await checkMenuSurface(page,{send,locale,textScale,out,name:`native-menu-${locale}-${textScale}`}));
  await writeFile(join(out,'checks.json'),JSON.stringify({passed:true,platform:process.platform,arch:process.arch,checks},null,2)+'\n');console.log(JSON.stringify({passed:true,cases:checks.length,out}));
} finally {await app?.close();await rm(directory,{recursive:true,force:true});}
