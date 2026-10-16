import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listDiagnostics, readDiagnostics } from '../../scripts/diagnostics-client.mjs';
const require = createRequire(import.meta.url), profile = await mkdtemp(join(tmpdir(), 'dsh-keyboard-visible-'));
const packageRoot = resolve('.cache/p1-keyboard-20261016/candidate-555503e/unpacked/package');
const app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox',join(packageRoot,'desktop/main.cjs')], env: { ...process.env, DSH_PET_TEST_DATA_DIR: profile, DSH_PET_TEST_DIAGNOSTICS_DIR: join(profile, 'diagnostics'), DSH_PET_TEST_NO_SANDBOX: '1' } });
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const page=await app.firstWindow();
 await app.evaluate((_,options)=>process.emit('message',{type:'init',baseline:true,options,snapshot:{mood:'idle',active:false,sessionId:null,sessions:[],results:[]}}),{size:180,roam:true,companionship:'quiet',diagnostics:true,notifications:false,npcHome:.85,npcRange:.3,bubbleDurationMs:12000});
 await page.waitForSelector('#pet[data-mode]');
 let endpoint;
 for(let i=0;i<60;i++){[endpoint]=await listDiagnostics(join(profile,'diagnostics'));if(endpoint)break;await pause(100);}
 const html=`<!doctype html><meta charset="utf-8"><style>body{font:18px -apple-system,sans-serif;background:#f4f7ff;padding:22px;color:#123}h2{font-size:23px}button{font:20px -apple-system;padding:12px 30px;background:#315be8;color:white;border:0;border-radius:8px}#state{font-size:14px;color:#456}#time{font-size:32px;font-weight:bold}</style><h2 id="title">键盘活动实机验证</h2><p id="help">点击开始后：①输入 10 秒；②停键缓冲 10 秒；③仅移动鼠标 30 秒，远离桌宠。无需提交输入的文字。</p><div id="time">准备就绪</div><p id="state">只记录活动枚举与桌宠阶段，不读取文本。</p><button onclick="window.probeStarted=true;this.hidden=true">开始</button>`;
 await app.evaluate(async({BrowserWindow},html)=>{
  globalThis.keyboardProbePanel=new BrowserWindow({width:520,height:360,show:false,alwaysOnTop:true,focusable:false,title:'键盘活动实机验证',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await globalThis.keyboardProbePanel.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  globalThis.keyboardProbePanel.showInactive();
 },html);
 console.log('PANEL_READY');
 const beganWaiting=performance.now();
 while(!await app.evaluate(()=>globalThis.keyboardProbePanel.webContents.executeJavaScript('window.probeStarted === true'))){if(performance.now()-beganWaiting>180000)throw Error('Human start timed out');await pause(100);}
 const results={},labels={typing:['请连续输入','在普通文本框中连续输入，不必发送。'],settle:['现在停止所有按键','停键缓冲；鼠标可移到屏幕中央，勿点击桌宠。'],'mouse-only':['只移动鼠标，不按任何键','继续远离桌宠；结束提示前保持停键。']};
 for(const[phase,duration]of[['typing',10000],['settle',10000],['mouse-only',30000]]){
  const counts={active:0,idle:0,unknown:0},npcPhases={},reasons={};let maxIdleMs=0,idleSince=null;
  const began=performance.now();
  while(performance.now()-began<duration){
   const state=(await readDiagnostics(endpoint)).value.renderer.npc,now=performance.now();
   counts[state.keyboard]++;npcPhases[state.phase]=(npcPhases[state.phase]??0)+1;reasons[state.reason]=(reasons[state.reason]??0)+1;
   if(state.keyboard==='idle'){idleSince??=now;maxIdleMs=Math.max(maxIdleMs,now-idleSince);}else idleSince=null;
   await app.evaluate((_,v)=>globalThis.keyboardProbePanel.webContents.executeJavaScript(`document.getElementById('title').textContent=${JSON.stringify(v[0])};document.getElementById('help').textContent=${JSON.stringify(v[1])};document.getElementById('time').textContent=${JSON.stringify(v[2])};document.getElementById('state').textContent=${JSON.stringify(v[3])}`),[...labels[phase],Math.ceil((duration-(now-began))/1000)+' 秒','键盘：'+state.keyboard+'　桌宠：'+state.phase+' / '+state.reason]);
   await pause(500);
  }
  results[phase]={counts,npcPhases,reasons,maxIdleMs:Math.round(maxIdleMs)};console.log('PHASE_COMPLETE',phase,JSON.stringify(results[phase]));
 }
 const result={build:JSON.parse(await readFile(join(packageRoot,'dist/build-info.json'),'utf8')),packageSha256:'f459a7c8715bf892d9b0649521bc26a9d29befddc09950d89319d43e0fc48d34',platform:process.platform,arch:process.arch,controlledPerception:false,visiblePrompt:true,humanClickedStart:true,results,physicalTypingDetected:results.typing.counts.active>0,mouseOnlyRemainsIdle:results['mouse-only'].counts.active===0&&results['mouse-only'].counts.unknown===0,stableIdleObserved:results['mouse-only'].maxIdleMs>=12000};
 await writeFile('.cache/p1-keyboard-20261016/validation/physical-panel-package.json',JSON.stringify(result,null,2)+'\n');
 await app.evaluate(()=>globalThis.keyboardProbePanel.webContents.executeJavaScript("document.getElementById('title').textContent='测试结束，可以恢复使用键盘';document.getElementById('help').textContent='记录已保存，窗口即将关闭。';document.getElementById('time').textContent='完成';document.getElementById('state').textContent='不需要在面板提交文字。'"));
 await pause(8000);
} finally{await app.close();await rm(profile,{recursive:true,force:true});}
