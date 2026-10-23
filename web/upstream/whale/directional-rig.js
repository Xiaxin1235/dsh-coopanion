import model from './directions/model.js';
import {initialDirection,stepDirection,directionPose} from './direction.js';
import {applyDirectionRestShape,decorationFarPose} from './direction-shape.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Adds direction meshes to the existing rig; no extra actor, GL context or clock. */
export async function directionalRig(asset,load) {
 const textures={},parts=[],deformers={},ids={};
 for(const [name,def]of Object.entries(model.directions)){
  const prefix=`dir_${name}_`,key=`dir_${name}`;
  textures[key]=await load(asset('directions/'+def.atlas));
  for(const p of def.parts)if(p.atlas)textures[key+'_'+p.id]=await load(asset('directions/'+p.atlas));
  for(const [id,d]of Object.entries(def.deformers))deformers[prefix+id]={...d,parent:d.parent?prefix+d.parent:undefined};
  ids[name]=[];
  for(const p of def.parts){const id=prefix+p.id;ids[name].push(id);parts.push({...p,id,tex:p.atlas?key+'_'+p.id:key,parent:prefix+p.parent});}
 }
 parts.push({id:'dir_front_features',tex:'dir_features',box:[-12,-8,280,280],parent:'dir_front_head',z:8,grid:[8,8]});ids.front.push('dir_front_features');
 // Independent asymmetric decoration on the character's right side, never baked into a mirror.
 const headBow=model.directions.backRight.headBow;
 deformers.dir_bow={kind:'rot',pivot:headBow.pivot,parent:'dir_backRight_'+headBow.parent};
 parts.push({id:'dir_headBow',tex:'bow',box:headBow.box,parent:'dir_bow',z:headBow.z,grid:[3,3]});ids.backRight.push('dir_headBow');
 let state=initialDirection(),last=null,legacy=true,manual=null;
 return {
  parts,deformers,textures,
  prepare(o,enabled,compatible){
   const dt=last?Math.max(0,Math.min(.05,o.t-last.t)):0;
   // Teleports, drag and geometry changes cannot become travel headings.
   const dx=last?o.x-last.x:0,dy=last?o.y-last.y:0;
   const travel=['walk','run','navigate'].includes(o.mode),valid=dt>0&&Math.hypot(dx,dy)<20;
   state=stepDirection(state,{dt,vx:travel&&valid?dx/dt:0,vy:travel&&valid?dy/dt:0,moving:travel,compatible:enabled&&compatible,front:!travel&&o.attention,facing:o.facing,heading:manual&&o.t<manual.until&&!travel?manual.heading:null});
   legacy=state.legacy;last={t:o.t,x:o.x,y:o.y};
   return legacy?o.facing:1;
  },
  apply(st,o,originalIds){
   const p=directionPose(state),name=state.current,frontSide=name==='frontLeft'||name==='frontRight',mirror=name.endsWith('Left')?-1:1;
   const group=frontSide?null:name==='backLeft'?'backRight':name;
   const hidden={};
   for(const id of originalIds)hidden[id]=!legacy&&!frontSide;
   for(const [key,list]of Object.entries(ids))for(const id of list)hidden[id]=legacy||group!==key;
   if(!legacy&&frontSide){st.body.sx*=mirror*p.width;st.waist.ty=p.drop;
    // The original bow has its own mesh. Move it to the far side before mirroring.
    st.dir_originalBow={tx:mirror<0?99:0,sx:mirror<0?.72:1};
    st.z.bow=mirror<0?14:12;
   }else{st.dir_originalBow={};st.z.bow=12;}
   if(!legacy&&group){
    const prefix=`dir_${group}_`,walking=['navigate','walk','run'].includes(o.mode);
    const stride=walking?clamp((o.legs[0][2]-o.legs[0][0])/25,-1,1):0;
    const body={sx:mirror*p.width,sy:1-.004*Math.sin(o.t*2.4),ty:0};
    const values={body,upper:{a:Math.sin(o.t*.8)*.6,ty:p.drop},legL:{a:stride*4,ty:-Math.max(0,stride)*4},legR:{a:-stride*4,ty:-Math.max(0,-stride)*4},
     armL:{a:-stride*10},armR:{a:stride*10},tail:{a:Math.sin(o.t*2.2)*5},bow:{a:Math.sin(o.t*2)*1.5},
     dress:{fn:(u,v)=>[Math.sin(o.t*2+u)*v*1.1,Math.abs(stride)*v*.6]},
     head:{a:o.look[0]*.3,fn:(u,v)=>[Math.sin(o.t*1.8+v*2)*Math.max(0,v-.45)*1.8,0]},
     hairBack:{fn:(u,v)=>[Math.sin(o.t*1.8+v*2)*v*v*1.6,0]},hairFront:{fn:(u,v)=>[Math.sin(o.t*1.8+v*2)*v*v*.8,0]}};
    for(const [id,value]of Object.entries(values))st[prefix+id]=value;
    applyDirectionRestShape(st,model.directions[group],prefix);
    // Front-facing right-side bow is viewer-left; rear right-side is viewer-right.
    st.dir_bow=mirror<0?decorationFarPose(headBow):{};
   }
   return {hidden,group,legacy,mirror,pose:p,anchors:group?model.directions[group].anchors:null};
  },
  turn(facing,t){manual={heading:facing<0?'frontLeft':'frontRight',until:t+1.5};},
  get state(){return {...state,turn:state.turn?{...state.turn}:null,...directionPose(state)};},
  reset(){state=initialDirection();last=null;legacy=true;manual=null;}
 };
}
