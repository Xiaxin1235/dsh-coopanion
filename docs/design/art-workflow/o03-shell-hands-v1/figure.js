import { createWhaleFigure } from '/web/upstream/whale/figure.js';
import { initialMotion, sampleMotion, stepMotion, contactRoute } from '/web/prop-motion.js';
import { initialSpaceAction, sampleSpaceAction, stepSpaceAction, pickupMirror, createSpaceNavigationChannel } from '/web/upstream/kit/space-action.js';
import {personalityPerformance} from '/web/upstream/kit/personality-performance.js';
import { initialPersonality, shellInterest } from '/web/upstream/kit/personality.js';
import { initialLifeWork, stepLifeWork } from '/web/upstream/kit/life-work.js';
import { initialWorkPerformance, stepWorkPerformance } from '/web/upstream/kit/work-performance.js';
import { handWeights } from '/web/upstream/whale/hand-art.js';

export async function createMotionBody(base, options) {
  const { shell: originalSpec, whale: model, motion: profile, hands: handSpec } = options.model;
  const spec = { ...originalSpec, grip: { ...originalSpec.grip, ...handSpec.propGrip } };
  const bounds = () => options.host.bounds(), scale = bounds().S;
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
  const w = spec.displayWidth / scale, h = w * b.height / b.width;
  const box = [hand[0] - w * spec.grip.x, hand[1] - h * spec.grip.y, w, h];
  let state = initial(profile), pending = null, arrival = null, previous = null, sequence = 0;
  let destinationY = bounds().floorY, destination = bounds().W * .78, speed = 1, stepOnce = false, forcePause = false, handArtEnabled = true;
  let actor;
  let groundQuad, wallAt = performance.now(), activeTime = 0;
  const putGround = (x, y = bounds().floorY) => { const height = spec.displayWidth * b.height / b.width;
    groundQuad = [{ x: x - spec.displayWidth / 2, y: y - height }, { x: x + spec.displayWidth / 2, y: y - height }, { x: x - spec.displayWidth / 2, y }]; };
  putGround(bounds().W * .50);
  const authoredPose = () => {
    const pose = sample(state, profile), phase = state.phase === 'paused' ? state.suspended : state.phase;
    const navigation=actor?.layout().navigation;
    const walking = ['approach', 'carry'].includes(phase) || !!navigation && navigation.phase !== 'idle';
    const k = ['settle', 'settleDrop'].includes(phase) ? Math.min(1, state.elapsed / profile.seconds[phase]) : continuous && phase === 'prepare' ? Math.max(state.preparePlantFrom ?? 0, Math.min(1,state.elapsed/.8)) : 1;
    const libraryFree=state.owner==='ground' && (phase==='standUp' || bounds().personality===true && ['idle','rest'].includes(phase) && coordination.phase.startsWith('personal-'));
    const free=coordinated && coordination.phase==='work-wait' && state.owner==='ground' && ['idle','rest'].includes(phase) && !walking && !coordination.occupied;
    return { ...pose, ...(libraryFree?{waist:undefined,armNear:undefined,armFar:undefined}:{}), ...(free ? {armNear:freeArm[0],armFar:freeArm[1]} : {}), ...(personalView?.active && libraryFree ? {look:personalLook} : coordinated ? {look:[pose.look[0]+gaze,pose.look[1]+(performanceView?.look[1]??0)]} : {}), plant: !libraryFree && !walking && phase !== 'rest' && (phase !== 'prepare' || !state.prepareSeated), plantWeight: k * k * (3 - 2 * k), hands: handWeights(continuous && phase === 'prepare' && state.owner === 'hand' ? {...state, phase:'held'} : state, profile), handArt: handArtEnabled,
      ...(walking ? { armNear: undefined, ...(state.owner === 'ground' ? { armFar: undefined, look: [3 + gaze, 0] } : {}) } : {}) };
  };
  const figure = await createWhaleFigure(new URL('/web/upstream/whale/', base), {
    ...options, model, raster: true, handDetail: true, externalProp:true, asset: path => new URL(path, new URL('/web/upstream/whale/', base)),
    gripProp: { url: new URL('/web/props/shell/shell.png', base), box, hand,
      uvBox: [b.x / c.width, b.y / c.height, (b.x + b.width) / c.width, (b.y + b.height) / c.height], grip: [spec.grip.x, spec.grip.y], ground: [spec.ground.x, spec.ground.y] },
    gripPose: () => ({ visible: state.owner === 'hand', mirror: continuous ? state.owner === 'ground' ? pickupMirror(groundQuad, actor?.layout().facing) : propMirror : 1 }), motionPose: authoredPose,
    handArt: { ...handSpec, assets: Object.fromEntries(Object.entries(handSpec.assets).map(([name, a]) => [name, { ...a, url: new URL('/web/props/shell/hands/' + a.image, base) }])) },
  });
  actor = options.kit.createBody({ ...options.host, emit(kind, detail) {
    if (navigationChannel && kind.startsWith('navigation-')) { detail=navigationChannel.decode(detail); if (!detail) return; }
    if ((continuous ? ['navigation-arrived','navigation-interrupted'] : ['arrived', 'interrupted']).includes(kind)) arrival = { kind, ...detail };
    options.host.emit(kind, detail);
  } }, { figure, navigation: options.host.bounds().navigation === true });
  actor.set({ roam: 'off' });
  const groundGrip = () => ({
    x: groundQuad[0].x + (groundQuad[1].x - groundQuad[0].x) * spec.grip.x + (groundQuad[2].x - groundQuad[0].x) * spec.grip.y,
    y: groundQuad[0].y + (groundQuad[1].y - groundQuad[0].y) * spec.grip.x + (groundQuad[2].y - groundQuad[0].y) * spec.grip.y,
  });
  const route = (grip, facing) => contactRoute({ profile, pivots: model.pivots, hand, grip, floor: continuous ? grip.floor : bounds().floorY, scale, facing });
  function inputs(now, dt, command, event) {
    const layout = actor.layout(), grip = figure.gripFrame;
    const point = groundGrip(), floor = groundQuad[2].y, motion = grip && previous ? Math.hypot(grip.hand.x - previous.x, grip.hand.y - previous.y) : Infinity;
    return { now, dt, command, event, bodyX: layout.x, bodyY: layout.y, speed: layout.navigation?.speed ?? 0, revision: spaceModel?.revision, objectRevision,
      canNavigate: !!spaceModel && actor.capabilities.includes('navigation-2d-v1'), standingReady: (grip?.sit ?? 1) < .01, moving: layout.moving,
      facingReady: grip ? Math.abs(grip.facing - layout.facing) < .005 : false, angles: grip?.angles,
      canWalk: true, minX: 104 * scale + 8, maxX: bounds().W - 104 * scale - 8,
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
    const preview=personalityPerformance(coordination,{bodyX:layout.x,bodyY:layout.y,gazeOrigin:figure.gripFrame?.gazeOrigin,facing:layout.facing,words:actor.words},{reduced:reducedWork});
    const input={...inputs(now,dt,null,null), command,event,reduced:reducedWork,personalityEnabled:bounds().personality===true,model:spaceModel,interests:currentInterests,gazeOrigin:figure.gripFrame?.gazeOrigin,facing:layout.facing,gazeReady:personalLook.every((v,i)=>Math.abs(v-preview.look[i])<.65),words:actor.words,action:state,objectId:'o03-shell',object:{x:groundGrip().x,y:groundQuad[2].y},
      physicalNavigation:layout.navigation,destination:{x:destination,y:destinationY},parking:parking(),station:workTarget??bounds().workTarget??{x:850,y:600}};
    const result=stepLifeWork(coordination,input);coordination=result.state;
    for(const e of result.effects){
      if(e.type==='destination'){destination=e.x;destinationY=e.y;objectRevision++;}
      if(e.type==='action'){const i=inputs(now,0,e.command,null);apply(advance(state,i,profile),i);}
      if(e.type==='stand')actor.do('stand');
      if(e.type==='face' && actor.layout().facing!==e.facing)actor.do('turn');
      if(e.type==='gesture' && state.owner==='ground' && state.phase==='idle' && !reducedWork)actor.do(e.word);
      if(e.type==='navigate')navigate({id:e.id,generation:e.generation,model:spaceModel,target:e.target});
      if(e.type==='cancel-navigation'){actor.cancelNavigation('coordination');arrival=null;}
      options.host.emit('coordination-action',{...e,phase:coordination.phase});
    }
    const focused=coordination.sessions.find(f=>f.sessionId===coordination.focus);
    const performance=stepWorkPerformance(performanceState,coordination,dt,{reduced:reducedWork});
    performanceState=performance.state;performanceView=performance.view;
    personalView=personalityPerformance(coordination,input,{reduced:reducedWork});
    if(!personalView.active)actor.set({clearGesture:true});
    const workFeedback=performanceState.cue&&performanceState.cueAge<2.5;
    const expression=personalView.active&&!workFeedback?personalView.expression:performanceView.expression;
    if(expression!==taskExpression){actor.set({expression});taskExpression=expression;}
    const aim=focused ? performanceView.look[0] : 0;
    if(coordination.phase!=='paused'){
      personalLook=personalLook.map((v,i)=>v+(personalView.look[i]-v)*Math.min(1,dt*6));
      gaze+=(aim-gaze)*Math.min(1,dt*5);
      freeArm=freeArm.map((v,i)=>v+((i?performanceView.armFar:performanceView.armNear)-v)*Math.min(1,dt*4));
    }
  }
  function emitFrame() {
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
      }
      // An inspect/reset command must draw at least once even if the page was paused.
      if (!figure.gripFrame) actor.step(1e-6);
      emitFrame();
    },
    set(value) {
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
      if (value.bounds) { actor.resize(); forcePause = !['idle', 'inspect'].includes(state.phase); }
      actor.set(value);
    },
    layout: actionLayout, resize() { actor.resize(); forcePause = !['idle', 'inspect'].includes(state.phase); },
    do: actor.do, walk: actor.walk, stopWalk: actor.stopWalk, place: actor.place,
    pointer(type, p) { if(coordinated)coordinationQueue.push({type:'pause',reason:'drag'});pending = { type: 'pause' }; actor.pointer(type, p); },
    dispose: actor.dispose,
  };
}
