import { createWhaleFigure } from '/web/upstream/whale/figure.js';
import { initialPropInteraction, stepPropInteraction } from '/web/prop-interaction.js';

export async function createShellBody(base, options) {
  const spec = options.model.shell, model = options.model.whale;
  const scale = options.host.bounds().S;
  const width = spec.displayWidth / scale, height = width * spec.visibleBounds.height / spec.visibleBounds.width;
  const hand = spec.binding.hand, b = spec.visibleBounds, c = spec.canvas;
  const box = [hand[0]-width*spec.grip.x, hand[1]-height*spec.grip.y, width, height];
  let state = initialPropInteraction(), command = null, arrival = null, lastGrip = null, lastFrame = null, sequence = 0;
  let scene = { floor:options.host.bounds().floorY, shellX:options.host.bounds().W*.51, destinationX:options.host.bounds().W*.8 };
  let groundQuad = null;
  const gripPose = () => ({ visible:state.owner === 'hand', armFar:['reach','lower'].includes(state.phase) || state.phase === 'paused' && ['reach','lower'].includes(state.suspended) ? -6 : state.owner === 'hand' ? -42 : -6 });
  const figure = await createWhaleFigure(new URL('/web/upstream/whale/',base),{
    ...options, model, raster:true, asset:path=>new URL(path,new URL('/web/upstream/whale/',base)),
    gripProp:{ url:new URL('/web/props/shell/shell.png',base), box,
      uvBox:[b.x/c.width,b.y/c.height,(b.x+b.width)/c.width,(b.y+b.height)/c.height], hand, grip:[spec.grip.x,spec.grip.y], ground:[spec.ground.x,spec.ground.y] }, gripPose,
  });
  const actor = options.kit.createBody({ ...options.host, emit:(kind,detail)=>{
    if (kind === 'arrived' || kind === 'interrupted') arrival = { kind,...detail };
    options.host.emit(kind,detail);
  } },{figure});
  actor.set({roam:'off'});
  function placeGround(x) {
    const h=spec.displayWidth*b.height/b.width;
    scene.shellX=x;groundQuad=[{x:x-spec.displayWidth/2,y:scene.floor-h},{x:x+spec.displayWidth/2,y:scene.floor-h},{x:x-spec.displayWidth/2,y:scene.floor}];
  }
  placeGround(scene.shellX);
  let lastNow=0;
  return {
    words:actor.words,
    step(dt) {
      // One body clock; native kit movement and genuine arrival feed the strategy.
      lastNow=performance.now();
      actor.step(dt);
      let grip=figure.gripFrame;
      const layout=actor.layout(), s=options.host.bounds().S;
      const groundGrip={x:groundQuad[0].x+(groundQuad[1].x-groundQuad[0].x)*spec.grip.x+(groundQuad[2].x-groundQuad[0].x)*spec.grip.y,
        y:groundQuad[0].y+(groundQuad[1].y-groundQuad[0].y)*spec.grip.x+(groundQuad[2].y-groundQuad[0].y)*spec.grip.y};
      const motion=grip&&lastGrip?Math.hypot(grip.hand.x-lastGrip.x,grip.hand.y-lastGrip.y):Infinity;
      const contact=grip?{distance:Math.hypot(grip.hand.x-groundGrip.x,grip.hand.y-groundGrip.y),groundDistance:Math.abs(grip.ground.y-scene.floor),settled:motion<.15}:null;
      const result=stepPropInteraction(state,{now:lastNow,command,event:arrival,bodyX:layout.x,moving:layout.moving,canWalk:true,minX:104*s+8,maxX:options.host.bounds().W-104*s-8,
        pickupTarget:groundGrip.x-41*s,dropTarget:scene.destinationX-41*s,contact});
      command=arrival=null;state=result.state;
      for(const effect of result.effects){
        if(effect.type==='walk')actor.walk(effect.x,false,effect.id);
        if(effect.type==='stop')actor.stopWalk(effect.id);
        if(effect.type==='stance')actor.do(effect.value);
        if(effect.type==='face'&&actor.layout().facing!==effect.value)actor.do('turn');
        if(effect.type==='relocate')placeGround(Math.max(130,Math.min(options.host.bounds().W-110,effect.x)));
        if(effect.type==='drop'){groundQuad=grip.quad.map(p=>({...p}));scene.shellX=grip.ground.x;}
        if(effect.type==='reset'){placeGround(options.host.bounds().W*.51);actor.do('stand');actor.place(options.host.bounds().W*.2,1);}
        options.host.emit('prop-action',{action:effect.type,generation:state.generation,walkId:effect.id??null,owner:state.owner,pickups:state.commits.pickup,drops:state.commits.drop,
          contactDistance:contact?.distance??null,groundDistance:contact?.groundDistance??null,bodyX:layout.x});
      }
      // Commit changes ownership in the same displayed frame, without a one-frame disappearing prop.
      if(result.effects.some(e=>e.type==='pickup'||e.type==='drop')){actor.step(.000001);grip=figure.gripFrame;}
      lastGrip=grip?.hand;
      lastFrame={phase:state.phase,owner:state.owner,generation:state.generation,walkId:state.walkId,commits:state.commits,error:state.error,
        groundQuad,grip:grip?.hand??null,groundGrip,heldGrip:grip?.propGrip??null,heldQuad:grip?.quad??null,
        bindingError:grip?Math.hypot(grip.hand.x-grip.propGrip.x,grip.hand.y-grip.propGrip.y):null,
        renderedOwner:grip?.visible?'hand':'ground',contact,bodyX:layout.x,destinationX:scene.destinationX,sequence:++sequence};
      options.host.emit('prop-frame',lastFrame);
    },
    layout:()=>actor.layout(),
    set(value){
      if(value.bounds){scene.floor=options.host.bounds().floorY;actor.resize();if(state.phase!=='idle')command={type:'pause'};}
      if(value.propCommand){
        const action=value.propCommand;
        if(['pickup','drop','pause','resume','reset'].includes(action.type))command={type:action.type};
        if(action.type==='relocate'&&Number.isFinite(action.x))command={type:'relocate',x:action.x};
        if(action.type==='destination'&&Number.isFinite(action.x))scene.destinationX=Math.max(150,Math.min(options.host.bounds().W-100,action.x));
      }
      actor.set(value);
    },
    resize(){actor.resize();if(state.phase!=='idle')command={type:'pause'};},
    do:word=>actor.do(word),walk:(x,run,id)=>actor.walk(x,run,id),stopWalk:id=>actor.stopWalk(id),place:(x,facing)=>actor.place(x,facing),
    pointer:(type,p)=>{command={type:'pause'};actor.pointer(type,p);},drop:p=>actor.drop(p),talk:()=>actor.talk(),dispose:()=>actor.dispose(),
  };
}
