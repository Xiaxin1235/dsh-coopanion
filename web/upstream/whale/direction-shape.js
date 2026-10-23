// Authoring registration is part of the rest shape, before any breathing or gait.
function at(knots,value){
 if(value<=knots[0][0])return knots[0][1];
 for(let i=1;i<knots.length;i++){const [x,y]=knots[i],[a,b]=knots[i-1];if(value<=x)return b+(y-b)*(value-a)/(x-a);}
 return knots.at(-1)[1];
}
export function applyDirectionRestShape(states,definition,prefix=''){
 for(const [name,warp]of Object.entries(definition.restWarps??{})){
  const state=states[prefix+name]??{},moving=state.fn;
  states[prefix+name]={...state,fn(u,v){const [x,y]=moving?.(u,v)??[0,0];return[x+(warp.x?at(warp.x,u):0),y+(warp.y?at(warp.y,v):0)];}};
 }
}
export function decorationFarPose(decoration){
 const [x,y,w,h]=decoration.box,[a,b,c,d]=decoration.farBox,[px,py]=decoration.pivot,sx=c/w,sy=d/h;
 return{sx,sy,tx:a-px-sx*(x-px),ty:b-py-sy*(y-py)};
}
