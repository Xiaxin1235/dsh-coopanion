import {createDirectionSample} from './figure.js';
import {mountDesignReferences} from './design-reference.js';
const model=await(await fetch('./model.json')).json(),samples={};
for(const[id,def]of Object.entries(model.directions))samples[id]=await createDirectionSample(document.getElementById(id),def,new URL('./',import.meta.url));
const registration=await(await fetch('./source/design-registration-v1.json')).json(),references=await mountDesignReferences(registration);
const $=id=>document.getElementById(id);let t=0,paused=false,last=null,frames=0,states={};
const isRest=()=>$('render-mode').value==='rest';
function paint(){
 const rest=isRest();if(rest)t=0;
 for(const[id,sample]of Object.entries(samples))states[id]=sample.draw({rest,t,walk:$('motion').value==='walk'?1:0,blink:$('blink').checked?1:Math.max(0,Math.sin((t%4.7)*Math.PI/.16))*(t%4.7<.16?1:0),look:[Math.sin(t*.7),Math.sin(t*.4)],stress:$('motion').value==='stress'?Math.sin(t*2):0});
 $('clock').textContent=rest?'原位静态':t.toFixed(3)+' s';frames++;
}
function syncMode(){
 const rest=isRest();for(const id of ['motion','blink','speed','pause','step','reset','neutral'])$(id).disabled=rest;
 $('status').textContent=rest?'原位静态拼合：关闭所有动画与静态形变补偿，保留当前图块位置、五官校准和绘制层级。此模式暴露源稿／装配偏差，不表示已回到原设计。':'动画预览：与产品共用绑定和静态校准；时间归零仍含默认形变。';
 $('pause').textContent=paused?'继续':'暂停';
}
function loop(now){if(last!==null&&!paused&&!isRest())t+=Math.min(.05,(now-last)/1000)*Number($('speed').value);last=now;paint();requestAnimationFrame(loop);}
function size(){const px=Number($('size').value)*280/256;document.querySelectorAll('.stage canvas,.stage img').forEach(n=>{n.style.width=px+'px';n.style.height=px+'px';});}
$('pause').onclick=()=>{paused=!paused;syncMode();};$('step').onclick=()=>{paused=true;t+=1/60;syncMode();paint();};$('reset').onclick=()=>{t=0;paint();};$('size').onchange=size;$('bg').onchange=()=>{document.body.className=$('bg').value;};
window.directionPreview={model,samples,registration,references,get state(){return{t,paused,frames,states,renderMode:$('render-mode').value};},pose(value){paused=true;t=value.t??0;if(value.renderMode)$('render-mode').value=value.renderMode;$('motion').value=value.motion??'idle';$('blink').checked=!!value.blink;syncMode();paint();}};
$('render-mode').onchange=()=>{paused=true;t=0;syncMode();paint();};
$('reference-view').onchange=()=>{document.documentElement.dataset.referenceView=$('reference-view').value;if($('reference-view').value!=='actual')window.directionPreview.pose({t:0});};
$('neutral').onclick=()=>window.directionPreview.pose({t:0});
syncMode();size();requestAnimationFrame(loop);
addEventListener('pagehide',()=>{for(const s of Object.values(samples))s.dispose();});
