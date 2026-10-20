// Attention follows a live courtyard object; no extra clock or action playlist.
export function personalityPerformance(coord,input,{reduced=false}={}) {
 const d=coord.personality?.decision,active=coord.phase.startsWith('personal-')&&coord.phase!=='personal-choose'&&!coord.focus&&!coord.occupied;
 const words=input.words??[],observing=['personal-align','personal-dwell'].includes(coord.phase);
 const chooseFace=word=>words.includes(word)?word:'neutral';
 const face=!active||reduced?'neutral':!d?.focus?'neutral':d.attention==='consider'?'thinking':d.result==='observed'?'happy':d.interestKind==='plant'?'surprised':'thinking';
 const root={x:input.bodyX,y:input.bodyY},facing=input.facing??1;
 const eye=input.gazeOrigin??{x:root.x,y:root.y-130};
 const focus=active&&d?.focus&&!reduced?{...d.focus}:null;
 // Lively examines different parts of the actual object, quiet holds its detail.
 if(focus&&observing&&d.attention==='investigate')focus.y+=Math.sin(coord.elapsed*.9)*12;
 const look=focus?[Math.max(-5.5,Math.min(5.5,(focus.x-eye.x)*facing/24)),Math.max(-4,Math.min(4,(focus.y-eye.y)/28))]:[0,0];
 return {active,expression:chooseFace(face),look,attention:d?.attention??null,focus,
  label:!d?.interestId?'留在原地，看看周围':coord.phase==='personal-travel'?`去看看${d.interestLabel}`:coord.phase==='personal-align'?`转向${d.interestLabel}`:d.result==='observed'?`看过${d.interestLabel}，再留意一会儿`:d.attention==='consider'?`静静细看${d.interestLabel}`:`看看${d.interestLabel}的细节`};
}
