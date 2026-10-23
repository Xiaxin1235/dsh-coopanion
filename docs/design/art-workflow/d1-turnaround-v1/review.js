const $=id=>document.getElementById(id),image=$('turnaround');
const manifest=await(await fetch('./source/manifest.json')).json();
for(const item of manifest.candidates){const option=document.createElement('option');option.value=item.file;option.textContent=item.label;$('candidate').append(option);}
$('candidate').value=manifest.reviewCandidate;
function annotations(){
 const h=1000*image.naturalHeight/image.naturalWidth;
 $('annotations').setAttribute('viewBox',`0 0 1000 ${h}`);
 const lines=$('guides').checked?manifest.guides.map(g=>`<line x1="0" x2="1000" y1="${g.y*h}" y2="${g.y*h}" stroke="#ce5e2b" stroke-width=".8" stroke-dasharray="5 4"/><text x="8" y="${g.y*h-3}" fill="#8f4222" font-size="7" paint-order="stroke" stroke="#fff" stroke-width="2">${g.label}</text>`).join(''):'';
 const zone=manifest.rearTailReviewBox;
 const box=$('structure').checked?`<rect x="${zone[0]*1000}" y="${zone[1]*h}" width="${zone[2]*1000}" height="${zone[3]*h}" fill="none" stroke="#d2503e" stroke-width="1.5" stroke-dasharray="4 3"/>`:'';
 $('annotations').innerHTML=lines+box;
}
async function select(){
 const item=manifest.candidates.find(c=>c.file===$('candidate').value);
 $('load-error').hidden=true;image.src='./source/'+item.file;
 try{await image.decode();annotations();$('candidate-status').textContent=item.label+' · 未锁定';$('candidate-notes').textContent=item.review;window.turnaroundReview={manifest,current:item.file,width:image.naturalWidth,height:image.naturalHeight};}
 catch{$('load-error').textContent='候选图未能加载；请检查本地制作资源。';$('load-error').hidden=false;}
}
$('candidate').onchange=select;
$('zoom').onchange=()=>{$('sheet').style.width=(Number($('zoom').value)*100)+'%';};
$('background').onchange=()=>{document.body.className=$('background').value;};
$('guides').onchange=annotations;$('structure').onchange=annotations;
$('focus-tail').onclick=()=>{$('zoom').value='2';$('zoom').onchange();$('structure').checked=true;annotations();const zone=manifest.rearTailReviewBox,v=$('viewport');v.scrollLeft=$('sheet').scrollWidth*(zone[0]+zone[2]/2)-v.clientWidth/2;};
await select();
