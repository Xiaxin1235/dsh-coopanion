// Opt-in API 2 extension. Rectangular Minkowski geometry, continuous segment
// tests and a conservative visibility graph with 0.5px corner clearance.
export const NAVIGATION = 'navigation-2d-v1';
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function segmentHits(a,b,r) {
  let lo=0,hi=1;
  for(const [p,d,min,max] of [[a.x,b.x-a.x,r.x,r.x+r.w],[a.y,b.y-a.y,r.y,r.y+r.h]]) {
    if(!d){if(p<min||p>max)return false;}
    else {const u=(min-p)/d,v=(max-p)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}
  }
  return true;
}
export function obstaclesFor(model) {
  const m=model.margin;
  return model.obstacles.map(o=>{
    // Only explicitly calibrated ground solids use finite ground depth.
    // Content volumes and unclassified solids retain the whole visual body.
    const b=o.kind==='ground-solid' && model.groundBody ? model.groundBody : model.body;
    return {...o,x:o.x-b.right-m,y:o.y-b.bottom-m,w:o.w+b.left+b.right+2*m,h:o.h+b.top+b.bottom+2*m};
  });
}
export function checkPath(model,points) {
  const b=model.body,m=model.margin,blocks=obstaclesFor(model),violations=[];
  for(let i=1;i<points.length;i++) {
    for(const p of [points[i-1],points[i]])if(p.x<b.left+m||p.x>model.width-b.right-m||p.y<b.top+m||p.y>model.height-b.bottom-m)violations.push({segment:i,obstacle:'world-edge',envelope:'full-body'});
    for(const o of blocks)if(segmentHits(points[i-1],points[i],o))violations.push({segment:i,obstacle:o.id,envelope:o.kind??'solid-silhouette'});
  }
  return {passed:points.length>=2&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&!violations.length,violations};
}
export function planPath(model,start,target) {
  const direct=checkPath(model,[start,target]),meta={revision:model.revision,precision:.5,model:model.groundBody?'finite ground bodies / full-body restricted volumes':'full-body / solid silhouettes / full restricted rectangles',direct};
  if(!checkPath(model,[start,start]).passed)return {...meta,passed:false,reason:'start-blocked',points:[]};
  if(!checkPath(model,[target,target]).passed)return {...meta,passed:false,reason:'target-blocked',points:[]};
  if(direct.passed)return {...meta,passed:true,alternative:false,points:[{...start},{...target}]};
  const nodes=[{...start},{...target}],eps=.5;
  for(const r of obstaclesFor(model))for(const x of[r.x-eps,r.x+r.w+eps])for(const y of[r.y-eps,r.y+r.h+eps]){
    const p={x,y};if(checkPath(model,[p,p]).passed)nodes.push(p);
  }
  const costs=nodes.map(()=>Infinity),prev=[],done=new Set();costs[0]=0;
  while(done.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||costs[i]<costs[u]))u=i;
    if(u<0||!Number.isFinite(costs[u]))break;if(u===1)break;done.add(u);
    for(let v=0;v<nodes.length;v++)if(!done.has(v)&&checkPath(model,[nodes[u],nodes[v]]).passed){const cost=costs[u]+distance(nodes[u],nodes[v]);if(cost<costs[v]){costs[v]=cost;prev[v]=u;}}
  }
  if(!Number.isFinite(costs[1]))return {...meta,passed:false,reason:'disconnected-in-rectangle-model',points:[]};
  const points=[];for(let i=1;i!==undefined;i=prev[i])points.unshift(nodes[i]);
  return {...meta,passed:true,alternative:true,points,length:costs[1]};
}
// The controller owns the actual root. It never places, shifts CSS, or emits a
// timed arrival. Corners stop before turning; each frame sweeps the entire body.
export function createNavigator(start,emit=()=>{}) {
  let p={...start},speed=0,route=null,index=1,wait=0,latest=0,generation=0,phase='idle',model=null,pending=null,pendingPlan=null,facing=1,revision=0;
  const report=(kind,by)=>{const operation=pending??route;if(operation)emit(kind,{id:operation.id,generation:operation.generation,revision:operation.model.revision,x:p.x,y:p.y,by});};
  const cancel=by=>{report('navigation-interrupted',by);route=null;pending=null;pendingPlan=null;speed=0;phase='idle';};
  function begin(command){model=structuredClone(command.model);const plan=planPath(model,p,command.target);route={...command,model,plan};index=1;wait=.3;phase='turning';if(!plan.passed){report('navigation-interrupted',plan.reason);route=null;phase='idle';}return plan;}
  return {
    get state(){return {x:p.x,y:p.y,speed,facing,phase,id:pending?.id??route?.id??null,generation,revision,plan:pending?pendingPlan:route?.plan??null};},
    request(command){
      if(!Number.isSafeInteger(command?.id)||command.id<=latest||!Number.isSafeInteger(command.generation)||command.generation<generation || (command.generation===generation && command.model.revision<revision))return null;
      latest=command.id;generation=command.generation;revision=command.model.revision;
      if(route){report('navigation-interrupted','replaced');pending=structuredClone(command);pendingPlan=planPath(command.model,p,command.target);phase='braking';return pendingPlan;}
      return begin(command);
    },
    cancel,
    relocate(point){cancel('drag');p={...point};},
    step(dt){
      if(!route)return this.state;
      dt=Math.max(0,Math.min(.05,dt));
      // Geometry replacement is checked before any further movement. A newly
      // occupied current position is reported explicitly, never teleported out.
      if(pending&&!checkPath(pending.model,[p,p]).passed){cancel('geometry-overlap');return this.state;}
      const look=route.plan.points[Math.min(index,route.plan.points.length-1)];if(look&&Math.abs(look.x-p.x)>.01)facing=Math.sign(look.x-p.x);
      if(phase==='turning'||phase==='settling'){
        wait-=dt;if(wait<=0){if(phase==='settling'){report('navigation-arrived');route=null;phase='idle';}else phase='moving';}return this.state;
      }
      const q=route.plan.points[Math.min(index,route.plan.points.length-1)],dist=distance(p,q),dx=q.x-p.x,dy=q.y-p.y;
      if(Math.abs(dx)>.01)facing=Math.sign(dx);
      const accel=180,max=100;
      // Reserve braking distance AFTER this frame's displacement. Limiting
      // only by sqrt(2*a*currentDistance) can overshoot and snap speed to zero.
      const safe=Math.max(0,(-accel*dt+Math.sqrt(Math.max(0,(accel*dt)**2-4*(accel*dt*speed-2*accel*dist))))/2);
      const nextSpeed=phase==='braking'?Math.max(0,speed-accel*dt):Math.max(0,speed-accel*dt,Math.min(max,speed+accel*dt,safe));
      const travel=phase==='braking'&&nextSpeed===0 ? speed*speed/(2*accel) : (speed+nextSpeed)*.5*dt;
      const amount=Math.min(dist,travel),next=dist?{x:p.x+dx/dist*amount,y:p.y+dy/dist*amount}:{...p};
      if(!checkPath(pending?.model??model,[p,next]).passed){cancel('geometry-sweep');return this.state;}
      p=next;speed=nextSpeed;
      if(phase==='braking'&&(!speed||amount>=dist)){const command=pending;pending=null;pendingPlan=null;speed=0;begin(command);return this.state;}
      if(distance(p,q)<.001){p={...q};speed=0;if(++index>=route.plan.points.length){phase='settling';wait=.4;}else{phase='turning';wait=.3;}}
      return this.state;
    },
  };
}
