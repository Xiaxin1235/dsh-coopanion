const $=id=>document.getElementById(id),image=$('turnaround');
const manifest=await(await fetch('./source/manifest.json',{cache:'no-store'})).json();
let selected,selection=0,focusView='rear';
const primaryZone=item=>item.primaryTailReviewBox??item.rearTailReviewBox;
const reviewZone=()=>focusView==='back'&&selected.backTailReviewBox?selected.backTailReviewBox:primaryZone(selected);
for(const item of manifest.candidates){const option=document.createElement('option');option.value=item.file;option.textContent=item.label;$('candidate').append(option);}
$('candidate').value=manifest.reviewCandidate;
function annotations(){
 const h=1000*image.naturalHeight/image.naturalWidth;
 $('annotations').setAttribute('viewBox',`0 0 1000 ${h}`);
 if(!selected)return;
 const lines=$('guides').checked?selected.guides.map(g=>`<line x1="0" x2="1000" y1="${g.y*h}" y2="${g.y*h}" stroke="#ce5e2b" stroke-width=".8" stroke-dasharray="5 4"/><text x="8" y="${g.y*h-3}" fill="#8f4222" font-size="7" paint-order="stroke" stroke="#fff" stroke-width="2">${g.label}</text>`).join(''):'';
 const zone=reviewZone();
 const box=$('structure').checked?`<rect x="${zone[0]*1000}" y="${zone[1]*h}" width="${zone[2]*1000}" height="${zone[3]*h}" fill="none" stroke="#d2503e" stroke-width="1.5" stroke-dasharray="4 3"/>`:'';
 const attachments=$('structure').checked?(selected.attachmentGuides??[]).map(g=>`<g class="attachment-guide"><path d="${g.hiddenPath.map((p,i)=>(i?'L':'M')+(p[0]*1000)+','+(p[1]*h)).join(' ')}" fill="none" stroke="#217c86" stroke-width="1.2" stroke-dasharray="3 3"/><circle cx="${g.exit[0]*1000}" cy="${g.exit[1]*h}" r="4" fill="none" stroke="#217c86" stroke-width="1.5"/><text x="${g.exit[0]*1000+7}" y="${g.exit[1]*h+5}" font-size="8" fill="#155d65" paint-order="stroke" stroke="#fff" stroke-width="2">${g.view}预期出口</text></g>`).join(''):'';
 $('annotations').innerHTML=lines+box+attachments;
}
async function select(){
 const item=manifest.candidates.find(c=>c.file===$('candidate').value);
 const request=++selection;
 $('load-error').hidden=true;image.src='./source/'+item.file;
 try{
  await image.decode();if(request!==selection)return;selected=item;focusView='rear';$('focus-back-tail').disabled=!item.backTailReviewBox;$('focus-tail').textContent=item.primaryTailReviewLabel??'放大斜后尾根';
  const columns=item.layout?.columns??item.views.length,rows=item.layout?.rows??1,labels=$('view-labels');
  labels.classList.toggle('grid-labels',rows>1);(rows>1?image.parentElement:$('sheet')).append(labels);
  labels.replaceChildren(...item.views.map((view,i)=>{const span=document.createElement('span');span.textContent=view;if(rows>1)Object.assign(span.style,{left:((i%columns)*100/columns+1)+'%',top:(Math.floor(i/columns)*100/rows+.6)+'%'});return span;}));
  labels.style.gridTemplateColumns=`repeat(${columns},1fr)`;
  image.alt=item.views.join('、')+'静态候选';annotations();
  $('candidate-status').textContent=item.label+' · 未锁定';$('candidate-notes').textContent=item.review;
  window.turnaroundReview={manifest,current:item.file,width:image.naturalWidth,height:image.naturalHeight};
 }
 catch{if(request!==selection)return;$('load-error').textContent='候选图未能加载；请检查本地制作资源。';$('load-error').hidden=false;}
}
$('candidate').onchange=select;
$('zoom').onchange=()=>{$('sheet').style.width=(Number($('zoom').value)*100)+'%';};
$('background').onchange=()=>{document.body.className=$('background').value;};
$('guides').onchange=annotations;$('structure').onchange=annotations;
function focusTail(view){if(!selected)return;focusView=view;$('zoom').value='2';$('zoom').onchange();$('structure').checked=true;annotations();const zone=reviewZone(),v=$('viewport');v.scrollLeft=$('sheet').scrollWidth*(zone[0]+zone[2]/2)-v.clientWidth/2;const box=image.getBoundingClientRect();window.scrollBy(0,box.top+box.height*(zone[1]+zone[3]/2)-window.innerHeight/2);}
$('focus-tail').onclick=()=>focusTail('rear');$('focus-back-tail').onclick=()=>focusTail('back');
await select();
