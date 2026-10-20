// Explicit development entry: no Harness, tray, daily profile or model calls.
// The same map, body sandbox and position reports run in a real native window.
const {app,BrowserWindow,screen,powerMonitor}=require('electron');
const {join}=require('node:path');
if(!process.env.DSH_PET_TEST_DATA_DIR)throw new Error('Space preview requires an isolated DSH_PET_TEST_DATA_DIR');
app.setPath('userData',process.env.DSH_PET_TEST_DATA_DIR);
app.setPath('crashDumps',join(process.env.DSH_PET_TEST_DATA_DIR,'crashes'));
if(process.env.DSH_PET_TEST_NO_SANDBOX==='1'){app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
let win,poll,reading=false,lastHit=true;
app.whenReady().then(async()=>{
 const area=screen.getPrimaryDisplay().workArea;
 win=new BrowserWindow({x:area.x,y:area.y,width:Math.min(1440,area.width),height:Math.min(1080,area.height),transparent:true,frame:false,show:false,backgroundColor:'#00000000',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((a,b,cb)=>cb(false));
 await win.loadURL(['3','4','5a'].includes(process.env.DSH_SPACE_STAGE)?'http://127.0.0.1:4189/docs/design/art-workflow/space-v1/index.html?native=1&stage='+process.env.DSH_SPACE_STAGE:'http://127.0.0.1:4189/?native=1');win.show();
 // In map mode the editor receives normal input. The explicit desktop overlay
 // toggle passes empty space through, while restoring body input as it moves.
 poll=setInterval(async()=>{if(reading||win.isDestroyed())return;reading=true;try{
  const cursor=screen.getCursorScreenPoint(),b=win.getContentBounds(),p={x:cursor.x-b.x,y:cursor.y-b.y};
  const hit=await win.webContents.executeJavaScript(`window.spacePreview?.nativeHit(${JSON.stringify(p)}) ?? true`);
  if(hit!==lastHit){lastHit=hit;win.setIgnoreMouseEvents(!hit,{forward:true});}
  global.spaceNativeState={cursor,bounds:b,hit,display:screen.getDisplayMatching(b).id};
 }catch{}finally{reading=false;}},50);
 powerMonitor.on('suspend',()=>win.webContents.executeJavaScript("window.dispatchEvent(new Event('space-suspend'))").catch(()=>{}));
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>clearInterval(poll));
