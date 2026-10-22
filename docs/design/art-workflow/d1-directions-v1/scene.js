import {createDirectionSample} from './figure.js';
const model=await(await fetch('./model.json')).json(),samples={};
for(const[id,def]of Object.entries(model.directions))samples[id]=await createDirectionSample(document.getElementById(id),def,new URL('./',import.meta.url));
const $=id=>document.getElementById(id);let t=0,paused=false,last=null,frames=0,states={};
function paint(){for(const[id,sample]of Object.entries(samples))states[id]=sample.draw({t,walk:$('motion').value==='walk'?1:0,blink:$('blink').checked?1:Math.max(0,Math.sin((t%4.7)*Math.PI/.16))*(t%4.7<.16?1:0),look:[Math.sin(t*.7),Math.sin(t*.4)],stress:$('motion').value==='stress'?Math.sin(t*2):0});$('clock').textContent=t.toFixed(3)+' s';frames++;}
function loop(now){if(last!==null&&!paused)t+=Math.min(.05,(now-last)/1000)*Number($('speed').value);last=now;paint();requestAnimationFrame(loop);}
function size(){const px=Number($('size').value)*280/256;document.querySelectorAll('.stage canvas,.stage img').forEach(n=>{n.style.width=px+'px';n.style.height=px+'px';});}
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续':'暂停';};$('step').onclick=()=>{paused=true;$('pause').textContent='继续';t+=1/60;paint();};$('reset').onclick=()=>{t=0;paint();};$('size').onchange=size;$('bg').onchange=()=>{document.body.className=$('bg').value;};
window.directionPreview={model,samples,get state(){return{t,paused,frames,states};},pose(value){paused=true;t=value.t??0;$('motion').value=value.motion??'idle';$('blink').checked=!!value.blink;paint();}};
$('status').textContent='三个方向已用实际 WebGL 网格绘制；只作为制作候选。';size();requestAnimationFrame(loop);
addEventListener('pagehide',()=>{for(const s of Object.values(samples))s.dispose();});
