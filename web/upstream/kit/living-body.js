import {initialLivingRoutine,stepLivingRoutine} from './living-routine.js';
import { createWhaleFigure } from '../whale/figure.js';
import { initialMotion, sampleMotion, stepMotion, contactRoute } from '../../prop-motion.js';
import { initialSpaceAction, sampleSpaceAction, stepSpaceAction, pickupMirror, createSpaceNavigationChannel } from './space-action.js';
import {personalityPerformance} from './personality-performance.js';
import { initialPersonality, shellInterest } from './personality.js';
import { initialLifeWork, stepLifeWork } from './life-work.js';
import { initialWorkPerformance, stepWorkPerformance } from './work-performance.js';
import { handWeights } from '../whale/hand-art.js';

export async function createMotionBody(base, options) {
  const { shell: originalSpec, whale: model, motion: profile, hands: handSpec } = options.model;
  const spec = { ...originalSpec, grip: { ...originalSpec.grip, ...handSpec.propGrip } };
  const bounds = () => options.host.bounds();
  let geometry = {...bounds()};
  const product = bounds().livingSpace === true;
  const resourceScale = product ? originalSpec.roleSize / 256 : bounds().S;
  if(product)Object.defineProperty(spec,'displayWidth',{get:()=>originalSpec.displayWidth*bounds().S/resourceScale});
  const whaleBase = new URL('../whale/', import.meta.url), shellBase = new URL('../../props/shell/', import.meta.url);
  let livingContext = null, living = null;
  const continuous = bounds().continuousActions === true;
  const coordinated = bounds().lifeWork === true;
  let coordination = initialLifeWork(), coordinationQueue = [], gaze = 0, taskExpression = null, workTarget = null, performanceState = initialWorkPerformance(), performanceView = null, reducedWork = false, freeArm = [4,-2];
  if(bounds().personality===true)coordination.personality=initialPersonality();
  const initial = continuous ? initialSpaceAction : initialMotion, sample = continuous ? sampleSpaceAction : sampleMotion, advance = continuous ? stepSpaceAction : stepMotion;
  let spaceModel = null, interests = [], personalView = null, personalLook = [0,0], objectRevision = 0, propMirror = 1;
  const navigationChannel = continuous ? createSpaceNavigationChannel() : null;
  const actionLayout = () => { const value=actor.layout(); return navigationChannel ? {...value,navigation:navigationChannel.decode(value.navigation)} : value; };
  const navigate = command => actor.navigate(navigationChannel ? navigationChannel.encode(command) : command);
  const b = spec.visibleBounds, c = spec.canvas, hand = spec.binding.hand;
  const w = originalSpec.displayWidth / resourceScale, h = w * b.height / b.width;
  const box = [hand[0] - w * spec.grip.x, hand[1] - h * spec.grip.y, w, h];
  let state = initial(profile), pending = null, arrival = null, previous = null, sequence = 0;
  let destinationY = bounds().floorY, destination = bounds().W * .78, speed = 1, stepOnce = false, forcePause = false, handArtEnabled = true;
  let actor;
  let groundQuad, wallAt = performance.now(), activeTime = 0;
  const putGround = (x, y = bounds().floorY) => { const height = spec.displayWidth * b.height / b.width;
    groundQuad = [{ x: x - spec.displayWidth / 2, y: y - height }, { x: x + spec.displayWidth / 2, y: y - height }, { x: x - spec.displayWidth / 2, y }]; };
  putGround(bounds().W * .50);
  const authoredPose = () => {
    if(product && state.owner==='ground' && ['idle','rest'].includes(state.phase==='paused'?state.suspended:state.phase) && !coordination.phase.startsWith('personal-') && !['work-wait','environment-wait'].includes(coordination.phase)) return null;
    const pose = sample(state, profile), phase = state.phase === 'paused' ? state.suspended : state.phase;
    const navigation=actor?.layout().navigation;
    const walking = ['approach', 'carry'].includes(phase) || !!navigation && navigation.phase !== 'idle';
    const k = ['settle', 'settleDrop'].includes(phase) ? Math.min(1, state.elapsed / profile.seconds[phase]) : continuous && phase === 'prepare' ? Math.max(state.preparePlantFrom ?? 0, Math.min(1,state.elapsed/.8)) : 1;
    const libraryFree=state.owner==='ground' && (phase==='standUp' || bounds().personality===true && ['idle','rest'].includes(phase) && (coordination.phase.startsWith('personal-')||coordination.phase==='environment-wait'));
    const free=coordinated && coordination.phase==='work-wait' && state.owner==='ground' && ['idle','rest'].includes(phase) && !walking && !coordination.occupied;
    return { ...pose, ...(libraryFree?{waist:undefined,armNear:undefined,armFar:undefined}:{}), ...(free ? {armNear:freeArm[0],armFar:freeArm[1]} : {}), ...(personalView?.active && libraryFree ? {look:personalLook} : coordinated ? {look:[pose.look[0]+gaze,pose.look[1]+(performanceView?.look[1]??0)]} : {}), plant: !libraryFree && !walking && phase !== 'rest' && (phase !== 'prepare' || !state.prepareSeated), plantWeight: k * k * (3 - 2 * k), hands: handWeights(continuous && phase === 'prepare' && state.owner === 'hand' ? {...state, phase:'held'} : state, profile), handArt: handArtEnabled,
      ...(walking ? { armNear: undefined, ...(state.owner === 'ground' ? { armFar: undefined, look: [3 + gaze, 0] } : {}) } : {}) };
  };
  const figure = await createWhaleFigure(whaleBase, {
    ...options, model, raster: !product, handDetail: !product, externalProp:!product, asset: path => new URL(path, whaleBase),
    gripProp: { url: new URL('shell.png', shellBase), box, hand,
      uvBox: [b.x / c.width, b.y / c.height, (b.x + b.width) / c.width, (b.y + b.height) / c.height], grip: [spec.grip.x, spec.grip.y], ground: [spec.ground.x, spec.ground.y] },
    gripPose: () => ({ visible: state.owner === 'hand', mirror: continuous ? state.owner === 'ground' ? pickupMirror(groundQuad, actor?.layout().facing) : propMirror : 1 }), motionPose: authoredPose,
    handArt: { ...handSpec, assets: Object.fromEntries(Object.entries(handSpec.assets).map(([name, a]) => [name, { ...a, url: new URL('hands/' + a.image, shellBase) }])) },
  });
  actor = options.kit.createBody({ ...options.host, emit(kind, detail) {
    if (navigationChannel && kind.startsWith('navigation-')) { detail=navigationChannel.decode(detail); if (!detail) return; }
    if ((continuous ? ['navigation-arrived','navigation-interrupted'] : ['arrived', 'interrupted']).includes(kind)) arrival = { kind, ...detail };
    options.host.emit(kind, detail);
  } }, { figure, navigation: options.host.bounds().navigation === true,
    facingOwned: () => !['idle','rest'].includes(state.phase==='paused'?state.suspended:state.phase) || ['personal-align','personal-dwell','environment-wait'].includes(coordination.phase) });
  actor.set({ roam: 'off' });
  let groundLayer=null, groundImage=null;
  if(product){const ns='http://www.w3.org/2000/svg';groundLayer=document.createElementNS(ns,'svg');groundLayer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';groundImage=document.createElementNS(ns,'image');groundImage.setAttribute('href',new URL('shell.png',shellBase));groundImage.setAttribute('width',spec.canvas.width);groundImage.setAttribute('height',spec.canvas.height);groundLayer.append(groundImage);options.host.root.prepend(groundLayer);}
  function paintGround(){if(!groundImage)return;groundImage.style.display=livingContext?.enabled&&state.owner==='ground'?'':'none';const [q0,q1,q2]=groundQuad,a=(q1.x-q0.x)/b.width,bv=(q1.y-q0.y)/b.width,cx=(q2.x-q0.x)/b.height,d=(q2.y-q0.y)/b.height;groundImage.setAttribute('transform',`matrix(${a} ${bv} ${cx} ${d} ${q0.x-a*b.x-cx*b.y} ${q0.y-bv*b.x-d*b.y})`);}
  const groundGrip = () => ({
    x: groundQuad[0].x + (groundQuad[1].x - groundQuad[0].x) * spec.grip.x + (groundQuad[2].x - groundQuad[0].x) * spec.grip.y,
    y: groundQuad[0].y + (groundQuad[1].y - groundQuad[0].y) * spec.grip.x + (groundQuad[2].y - groundQuad[0].y) * spec.grip.y,
  });
  const route = (grip, facing) => contactRoute({ profile, pivots: model.pivots, hand, grip, floor: continuous ? grip.floor : bounds().floorY, scale:bounds().S, facing });
  function inputs(now, dt, command, event) {
    const layout = actor.layout(), grip = figure.gripFrame;
    const point = groundGrip(), floor = groundQuad[2].y, motion = grip && previous ? Math.hypot(grip.hand.x - previous.x, grip.hand.y - previous.y) : Infinity;
    return { now, dt, command, event, bodyX: layout.x, bodyY: layout.y, speed: layout.navigation?.speed ?? 0, revision: spaceModel?.revision, objectRevision,
      canNavigate: !!spaceModel && actor.capabilities.includes('navigation-2d-v1'), standingReady: (grip?.sit ?? 1) < .01, moving: layout.moving,
      facingReady: grip ? Math.abs(grip.facing - layout.facing) < .005 : false, angles: grip?.angles,
      canWalk: true, minX: 104 * bounds().S + 8, maxX: bounds().W - 104 * bounds().S - 8,
      pickupRoute: { ...route({ ...point, floor }, point.x >= layout.x ? 1 : -1), ...(continuous ? { y: floor } : {}) },
      dropRoute: { ...route({ x: destination, y: (continuous ? destinationY : bounds().floorY) - spec.displayWidth * b.height / b.width * (1 - spec.grip.y), floor: destinationY }, destination >= layout.x ? 1 : -1), ...(continuous ? { y: destinationY } : {}) },
      contact: grip ? { distance: Math.hypot(grip.hand.x - point.x, grip.hand.y - point.y), groundDistance: (continuous ? Math.hypot(grip.propGrip.x - destination, grip.ground.y - destinationY) : Math.abs(grip.ground.y - bounds().floorY)), settled: motion < .1 } : null,
      hand: grip?.handArt,
    };
  }
  function apply(result, input) {
    state = result.state;
    for (const e of result.effects) {
      if (continuous && e.type === 'pickup') propMirror = pickupMirror(groundQuad, actor.layout().facing);
      if (e.type === 'stand' || e.type === 'sit') actor.do(e.type);
      if (e.type === 'navigate') navigate({ id:e.id, generation:e.generation, model:spaceModel, target:e.target });
      if (e.type === 'cancel-navigation') { arrival = null; actor.cancelNavigation('action-pause'); }
      if (e.type === 'walk') actor.walk(e.x, false, e.id);
      if (e.type === 'stop') { arrival = null; actor.stopWalk(e.id); }
      if (e.type === 'face' && actor.layout().facing !== e.facing) actor.do('turn');
      if (e.type === 'drop') groundQuad = figure.gripFrame.quad.map(p => ({ ...p }));
      if (e.type === 'relocate') putGround(Math.max(125, Math.min(bounds().W - 100, e.x)), continuous ? input.command.y : bounds().floorY);
      if (e.type === 'reset') { actor.do('stand'); actor.place(Number.isFinite(input.command?.x)?input.command.x:bounds().W * .22, 1); figure.reset(); putGround(bounds().W * .50); previous = null; arrival = null; }
      if (e.type === 'inspect') {
        actor.do('stand'); actor.place(input.pickupRoute.x, 1); figure.reset();
        // Inspection poses are explicitly unscored and always use a right-facing reference.
        state.reachDrop = route(groundGrip(), 1).drop;
        actor.place(route(groundGrip(), 1).x, 1); previous = null;
      }
      options.host.emit('motion-action', { ...e, phase: state.phase, generation: state.generation, owner: state.owner,
        commits: { ...state.commits }, contact: input.contact, handArt: input.hand, activeTime });
    }
  }
  const parking = () => {
    const layout=actor.layout(), floor=layout.y;
    const r=route({x:0,y:floor-spec.displayWidth*b.height/b.width*(1-spec.grip.y),floor},layout.facing);
    return {x:layout.x-r.x,y:floor};
  };
  function coordinate(now, dt, command, event) {
    const layout=actor.layout();
    const currentInterests=interests.map(i=>i.kind==='shell'?shellInterest({x:groundGrip().x,y:groundQuad[2].y}):i);
    const viewInput={bodyX:layout.x,bodyY:layout.y,gazeOrigin:figure.gripFrame?.gazeOrigin,facing:layout.facing,words:actor.words};
    const attention=()=>{
      const value=personalityPerformance(coordination,viewInput,{reduced:reducedWork});
      if(!product||coordination.phase!=='environment-wait'||coordination.focus||reducedWork)return value;
      const eye=figure.gripFrame?.gazeOrigin??{x:layout.x,y:layout.y-130};
      const target=livingContext?.desktop?.pointer??{x:layout.x+layout.facing*35,y:layout.y-230*bounds().S};
      return {...value,active:true,expression:'neutral',look:[Math.max(-5.5,Math.min(5.5,(target.x-eye.x)*layout.facing/24)),Math.max(-4,Math.min(4,(target.y-eye.y)/28))]};
    };
    const preview=attention();
    const input={...inputs(now,dt,null,null), command,event,reduced:reducedWork,directedLife:product&&!!livingContext?.desktop,environmentFocus:livingContext?.desktop?.pointer,personalityEnabled:bounds().personality===true,rememberedKind:livingContext?.memory?.kind,model:spaceModel,interests:currentInterests,gazeOrigin:figure.gripFrame?.gazeOrigin,facing:layout.facing,gazeReady:personalLook.every((v,i)=>Math.abs(v-preview.look[i])<.65),words:actor.words,action:state,objectId:'o03-shell',object:{x:groundGrip().x,y:groundQuad[2].y},
      physicalNavigation:layout.navigation,destination:{x:destination,y:destinationY},parking:parking(),station:workTarget??bounds().workTarget??{x:850,y:600}};
    const result=stepLifeWork(coordination,input);coordination=result.state;
    for(const e of result.effects){
      if(e.type==='destination'){destination=e.x;destinationY=e.y;objectRevision++;}
      if(e.type==='action'){const i=inputs(now,0,e.command,null);apply(advance(state,i,profile),i);}
      if(e.type==='stand')actor.do('stand');
      if(e.type==='cue')actor.cue(e.kind);
      if(e.type==='face' && actor.layout().facing!==e.facing)actor.do('turn');
      if(e.type==='gesture' && state.owner==='ground' && state.phase==='idle' && !reducedWork)actor.do(e.word);
      if(e.type==='navigate')navigate({id:e.id,generation:e.generation,model:spaceModel,target:e.target});
      if(e.type==='cancel-navigation'){actor.cancelNavigation('coordination');arrival=null;}
      options.host.emit('coordination-action',{...e,phase:coordination.phase});
    }
    const focused=coordination.sessions.find(f=>f.sessionId===coordination.focus);
    const performance=stepWorkPerformance(performanceState,coordination,dt,{reduced:reducedWork});
    performanceState=performance.state;performanceView=performance.view;
    const hadPersonal=personalView?.active;
    personalView=attention();
    if(hadPersonal && !personalView.active)actor.set({clearGesture:true});
    const workFeedback=performanceState.cue&&performanceState.cueAge<2.5;
    const expression=personalView.active&&!workFeedback?personalView.expression:performanceView.expression;
    if(expression!==taskExpression){
      // Listening is a held body state, not an expression word. Clear the old
      // expression when using it (or a missing word), then release it explicitly.
      actor.set({listening:expression==='listening',expression:actor.words.includes(expression)?expression:null});taskExpression=expression;
    }
    const aim=focused ? performanceView.look[0] : 0;
    if(coordination.phase!=='paused'){
      personalLook=personalLook.map((v,i)=>v+(personalView.look[i]-v)*Math.min(1,dt*6));
      gaze+=(aim-gaze)*Math.min(1,dt*5);
      freeArm=freeArm.map((v,i)=>v+((i?performanceView.armFar:performanceView.armNear)-v)*Math.min(1,dt*4));
    }
  }
  function updateLiving(now,dt) {
    const result=stepLivingRoutine(living??initialLivingRoutine(),{now,dt,context:livingContext,coordination,action:state,object:{x:groundGrip().x,y:groundQuad[2].y},destination:{x:destination,y:destinationY},moving:actor.layout().moving});living=result.state;
    for(const command of result.commands) coordinationQueue.push(command);
  }
  function emitFrame() {
    if(product)return;
    const grip = figure.gripFrame, layout = actionLayout(), point = groundGrip();
    const contact = grip ? { distance: Math.hypot(grip.hand.x - point.x, grip.hand.y - point.y), groundDistance: (continuous ? Math.hypot(grip.propGrip.x - destination, grip.ground.y - destinationY) : Math.abs(grip.ground.y - bounds().floorY)) } : null;
    options.host.emit('motion-frame', { phase: state.phase, suspended: state.suspended, elapsed: state.elapsed,
      ...(coordinated ? {coordination:structuredClone(coordination),personalityPerformance:personalView?{...personalView,look:[...personalLook]}:null,performance:performanceView?{...performanceView,gaze,arms:[...freeArm]}:null} : {}), owner: state.owner, renderedOwner: grip?.visible ? 'hand' : 'ground', generation: state.generation, walkId: state.walkId,
      commits: { ...state.commits }, error: state.error, inspection: state.inspection, loop: state.loop,
      bodyX: layout.x, bodyY:layout.y, navigation:layout.navigation, bubble:layout.bubble, hit:layout.hit, moving: layout.moving, facing: layout.facing, visualFacing: grip?.facing, destinationX: destination, destinationY, actionNavigation: state.navigation, actionRevision: state.revision, objectRevision, continuous,
      groundQuad, groundGrip: point, hand: grip?.hand, heldGrip: grip?.propGrip, heldQuad: grip?.quad, feet: grip?.feet,gazeOrigin:grip?.gazeOrigin,renderedFace:grip?.renderedFace,gesture:grip?.gesture,posture:grip?.posture, pose: grip?.pose, sit: grip?.sit,
      handArt: grip?.handArt,
      detail: grip?.detail,
      contact, bindingError: grip ? Math.hypot(grip.hand.x - grip.propGrip.x, grip.hand.y - grip.propGrip.y) : null,
      propMirror, activeTime, speed, sequence: ++sequence });
  }
  return {
    words: actor.words, capabilities:actor.capabilities, navigate(command){if(state.phase!=='idle'||coordinated&&!['idle','ended'].includes(coordination.phase)){options.host.emit('navigation-interrupted',{id:command.id,generation:command.generation,revision:command.model.revision,by:'body-owned'});return false;}wallAt=performance.now();return navigate(command);}, cancelNavigation:actor.cancelNavigation, place2d:actor.place2d,
    step(dt) {
      const now = performance.now(), gap = now - wallAt; wallAt = now;
      if (gap > 1000 || forcePause) { if(coordinated)coordinationQueue.push({type:'pause',reason:'lifecycle'}); actor.cancelNavigation('lifecycle-gap'); pending = ['reset','resume'].includes(pending?.type) ? pending : { type: 'pause' }; forcePause = false; }
      if(product && livingContext) updateLiving(now,dt);
      if(coordinated){for(const command of coordinationQueue.splice(0))coordinate(now,0,command,null);coordinate(now,Math.max(0,Math.min(.05,dt))*speed,null,arrival);}
      if (pending) { const input = inputs(now, 0, pending, null); pending = null; apply(advance(state, input, profile), input); }
      const stepping = state.phase === 'paused' && stepOnce, suspended = state.suspended;
      stepOnce = false;
      if (stepping) { state = { ...state, phase: suspended, suspended: null }; }
      if (state.phase !== 'paused') {
        const amount = stepping ? 1 / 60 : Math.max(0, Math.min(.05, dt)) * speed;
        const input = inputs(now, amount, null, arrival); arrival = null;
        apply(advance(state, input, profile), input);
        previous = figure.gripFrame?.hand;
        actor.step(Math.max(1e-6, amount)); activeTime += amount;
        if (stepping) { const inputPause = inputs(now, 0, { type: 'pause' }, null); apply(advance(state, inputPause, profile), inputPause); }
      } else {
        // Freeze the authored clock, not the safety heartbeat. Otherwise the
        // first explicit resume after >1s is itself rejected as a stale gap.
        const input = inputs(now, 0, null, null);
        apply(advance(state, input, profile), input);
        if(product)actor.step(Math.max(1e-6,Math.min(.05,dt)));
      }
      // An inspect/reset command must draw at least once even if the page was paused.
      if (!figure.gripFrame) actor.step(1e-6);
      paintGround(); emitFrame();
    },
    set(value) {
      if(value.livingContext){livingContext=value.livingContext;reducedWork=livingContext.reduced===true;}
      if (value.motionCommand) {
        const cmd = value.motionCommand;
        if(coordinated && bounds().personality===true && ['personality','personality-start','personality-stop'].includes(cmd.type)){coordinationQueue.push(cmd);return;}
        if(coordinated && cmd.type==='work-facts'){coordinationQueue.push({type:'facts',facts:cmd.facts});return;}
        if(coordinated && cmd.type==='work-reduced'){reducedWork=cmd.reduced===true;if(bounds().personality===true)coordinationQueue.push({type:'personality'});return;}
        if(coordinated && cmd.type==='work-occupancy'){coordinationQueue.push({type:'occupancy',occupied:cmd.occupied});return;}
        if(coordinated && ['story-start','story-cancel','story-pause','story-resume','work-fact'].includes(cmd.type)){
          coordinationQueue.push(cmd.type==='work-fact'?{type:'fact',fact:cmd.fact}:{type:({'story-start':'start','story-cancel':'cancel','story-pause':'pause','story-resume':'resume'})[cmd.type]});
          return;
        }
        if(coordinated && cmd.type==='reset')coordinationQueue.push({type:'reset'});
        if(coordinated && ['pause','resume'].includes(cmd.type)){coordinationQueue.push({type:cmd.type});return;}
        if(coordinated && ['pickup','drop','loop','sit','step','inspect'].includes(cmd.type) && !['idle','ended'].includes(coordination.phase))return;
        if (['pickup', 'drop', 'loop', 'pause', 'resume', 'reset', 'inspect', 'relocate', ...(continuous ? ['sit'] : [])].includes(cmd.type)) pending = cmd;
        if (continuous && cmd.type === 'relocate' && state.owner === 'ground' && ['idle','rest'].includes(state.phase)) objectRevision++;
        if (cmd.type === 'speed' && [.25, .5, 1].includes(cmd.value)) speed = cmd.value;
        if (cmd.type === 'hand-art' && ['idle', 'inspect'].includes(state.phase)) handArtEnabled = cmd.enabled !== false;
        if (cmd.type === 'step') stepOnce = true;
        if (cmd.type === 'destination' && Number.isFinite(cmd.x)) { destination = Math.max(125, Math.min(bounds().W - 100, cmd.x)); if (continuous && Number.isFinite(cmd.y)) destinationY = cmd.y; objectRevision++; if(coordinated)coordinationQueue.push({type:'target',x:destination,y:destinationY}); }
        if (continuous && cmd.type === 'world' && cmd.model) { spaceModel = cmd.model; workTarget=cmd.workTarget??workTarget;interests=Array.isArray(cmd.interests)?cmd.interests.slice(0,8):interests; }
      }
      
      actor.set(value);
    },
    layout() { const layout=actionLayout(); return {...layout, ...(product?{living:{phase:coordination.phase,reason:coordination.reason,action:state.phase,suspended:state.suspended,owner:state.owner,pickup:state.commits.pickup,drop:state.commits.drop,routine:living?.stage??'tidy',cycles:living?.cycles??0,environment:coordination.environmentKind,animating:personalView?.active&&personalLook.some((v,i)=>Math.abs(v-personalView.look[i])>.05),goal:coordination.life?'arrange':coordination.personality?.decision?.interestId??null,socialReady:coordination.phase==='social-wait'}}:{})}; }, resize() {
      const next={...bounds()}; actor.resize();
      if(product){
        const layout=actor.layout();
        if(!['drag','air'].includes(layout.mode)) {
          const p={x:Math.max(104*next.S+8,Math.min(next.W-104*next.S-8,layout.x)),y:Math.max(Math.min(next.floorY,205*next.S),Math.min(next.floorY,layout.y))};
          if(p.x!==layout.x||p.y!==layout.y)actor.place2d(p);
        }
        if(state.owner==='ground' && geometry.W>0){
          const old=groundQuad[2], center=(groundQuad[0].x+groundQuad[1].x)/2;
          putGround(Math.max(104*next.S+8,Math.min(next.W-104*next.S-8,center/geometry.W*next.W)),next.floorY-(geometry.floorY-old.y)*next.S/geometry.S);
        }
      }
      geometry=next;forcePause = !['idle', 'inspect'].includes(state.phase);
    },
    do: actor.do, walk: actor.walk, stopWalk: actor.stopWalk, place: actor.place, drop:actor.drop,shift:actor.shift,
    pointer(type, p) { if(product && !['down','up','cancel'].includes(type)){actor.pointer(type,p);return;} if(coordinated)coordinationQueue.push({type:'pause',reason:'drag'});pending = { type: 'pause' }; actor.pointer(type, p); },
    dispose() { groundLayer?.remove(); actor.dispose(); },
    cue:actor.cue,talk:actor.talk,setScheme:actor.setScheme,get z(){return actor.z;},
  };
}
