import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const sourceCommit = '74fa3d0643652a1a8ff314ffa6b7e6280071c3b8';
const pet = execFileSync('git',['show',sourceCommit+':web/pet.js'],{encoding:'utf8'});
const release = pet.match(/if \(event.type === 'pointerup' && native && (.+)\) send\(\{ type: 'move-display' \}\);/)[1];
const vertical = vm.runInNewContext(release,{event:{screenX:500,screenY:-500},screen:{availLeft:0,availTop:25,availWidth:1440,availHeight:875}});
assert.equal(vertical,false);
const dip = {x:-600,y:200}, origin={x:-1280,y:100}, dpr=1.5;
const local={x:dip.x-origin.x,y:dip.y-origin.y};
// Reproduce existing Windows test helper formula using a second display at -1280.
const pointerSource=execFileSync('git',['show',sourceCommit+':tests/helpers/native-pointer.mjs'],{encoding:'utf8'});
assert.ok(pointerSource.includes('(screenX + b.x + b.width / 2) * devicePixelRatio'));
const helperPhysical={x:(origin.x+local.x)*dpr,y:(origin.y+local.y)*dpr};
const nativeOrigin={x:-1920,y:200};
const displayRelativePhysical={x:nativeOrigin.x+local.x*dpr,y:nativeOrigin.y+local.y*dpr};
assert.notDeepEqual(helperPhysical,displayRelativePhysical);
const report={sourceCommit,controlled:true,physicalMultiDisplay:false,cases:[
 {id:'vertical-offset-portrait',layout:[{id:1,bounds:{x:0,y:0,width:1440,height:900},scaleFactor:2},{id:2,bounds:{x:200,y:-1920,width:1080,height:1920},scaleFactor:1}],cursor:{x:500,y:-500},baselineRequestsMove:vertical,expectedRequestsMove:true},
 {id:'mixed-scale-negative-origin',layout:[{id:1,bounds:{x:0,y:0,width:1440,height:900},scaleFactor:2},{id:2,bounds:{x:-1280,y:100,width:1280,height:800},scaleFactor:1.5}],dip,origin,nativeOrigin,local,baselineWindowsHelper:helperPhysical,displayRelativePhysical,explanation:'Multiplying a global DIP origin by the target scale is invalid across displays; use Electron platform conversion at the native seam.'}
]};
writeFileSync('docs/evidence/m5/baseline-reproduction.json',JSON.stringify(report,null,2)+'\n');
