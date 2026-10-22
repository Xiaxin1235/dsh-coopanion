import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from '../scripts/lib/playwright.mjs';
const require = createRequire(import.meta.url), directory = await mkdtemp(join(tmpdir(), 'dsh-mouth-native-'));
let app;
try {
  app = await _electron.launch({ executablePath:require('electron'), args:['--no-sandbox',resolve('desktop/main.cjs')], env:{...process.env,DSH_PET_TEST_DATA_DIR:directory,DSH_PET_TEST_NO_SANDBOX:'1',DSH_PET_TEST_DEBUG_PORT:'0'} });
  const page = await app.firstWindow(); await page.waitForSelector('#pet[data-mode]');
  const body = page.frames().find(frame => frame.url().includes('figure-frame.html'));
  assert.ok(body); assert.equal(await body.evaluate(() => typeof window.dshPetBridge), 'undefined');
  await body.evaluate(() => { window.mouthPulses = []; addEventListener('message', event => {if(event.data?.t === 'talk') window.mouthPulses.push(performance.now());}); });
  const send = value => app.evaluate((_, message) => process.emit('message',message), value);
  const snapshot = (progress, streaming=true) => ({sessionId:'mouth',mood:'talking',active:true,streaming,speechRevision:progress,revision:1,sessions:[{id:'mouth',mood:'talking',active:true,streaming,speechRevision:progress,revision:1}],results:[]});
  await send({type:'init',baseline:true,options:{size:180,roam:false,companionship:'off',locale:'en',notifications:true,bubbleDurationMs:12000},snapshot:snapshot(1)});
  await body.waitForFunction(() => window.mouthPulses.length > 0);
  await page.waitForTimeout(1700); const before = await body.evaluate(() => window.mouthPulses.length);
  await send({type:'snapshot',snapshot:snapshot(1)}); await page.waitForTimeout(500);
  const after = await body.evaluate(() => window.mouthPulses.length); assert.equal(after,before,'native duplicate snapshot cannot sustain mouth pulses');
  await send({type:'snapshot',snapshot:snapshot(2)}); await body.waitForFunction(count => window.mouthPulses.length > count,before);
  await send({type:'snapshot',snapshot:snapshot(2,false)}); await page.waitForTimeout(400);
  const end = await body.evaluate(() => window.mouthPulses.length); await page.waitForTimeout(400); assert.equal(await body.evaluate(() => window.mouthPulses.length),end,'native stream end stops pulses');
  const out = process.env.MOUTH_EVIDENCE_DIR;
  if(out) {await mkdir(out,{recursive:true}); await page.screenshot({path:join(out,'native-mouth-fixed.png')}); await writeFile(join(out,'native-mouth.json'),JSON.stringify({passed:true,platform:process.platform,arch:process.arch,duplicateSnapshot:{before,after},newProgress:true,streamEnd:true,sandboxUnchanged:true},null,2)+'\n');}
  console.log(JSON.stringify({passed:true,before,after,newProgress:true,streamEnd:true}));
} finally {await app?.close(); await rm(directory,{recursive:true,force:true});}
