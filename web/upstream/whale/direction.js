// Heading is independent of gaze and horizontal contact facing. The caller owns time.
export const DIRECTIONS = ['front','frontRight','backRight','back','backLeft','frontLeft'];
const wrap = a => ((a + 540) % 360) - 180;
export function headingForVelocity(x, y, current = 'front') {
  if (!Number.isFinite(x+y) || Math.hypot(x,y) < 4) return current;
  const angle = Math.atan2(x,y)*180/Math.PI, index = Math.max(0,DIRECTIONS.indexOf(current));
  if (Math.abs(wrap(angle-index*60)) < 42) return current;
  return DIRECTIONS[(Math.round(angle/60)+6)%6];
}
export function initialDirection() { return {current:'front',target:'front',candidate:'front',age:0,idle:0,turn:null}; }
export function stepDirection(previous, {dt=0,vx=0,vy=0,moving=false,front=false,compatible=true,facing=1,heading=null}={}) {
  const s={...previous,turn:previous.turn?{...previous.turn}:null};dt=Math.max(0,Math.min(.05,dt));
  if(!compatible) return {...initialDirection(),current:facing<0?'frontLeft':'frontRight',target:facing<0?'frontLeft':'frontRight',legacy:true};
  s.legacy=false;s.idle=moving?0:s.idle+dt;
  const desired=DIRECTIONS.includes(heading)?heading:front||s.idle>.7?'front':headingForVelocity(vx,vy,s.target);
  if(desired!==s.candidate){s.candidate=desired;s.age=0;}else s.age+=dt;
  if(s.age>=.1 || front)s.target=desired;
  if(s.turn){
    s.turn.elapsed+=dt;
    if(s.turn.elapsed>=.12)s.current=s.turn.to;
    if(s.turn.elapsed>=.24)s.turn=null;
  }
  if(!s.turn && s.current!==s.target){
    const from=DIRECTIONS.indexOf(s.current),to=DIRECTIONS.indexOf(s.target),delta=(to-from+6)%6;
    s.turn={to:DIRECTIONS[(from+(delta<=3?1:5))%6],elapsed:0};
  }
  return s;
}
export function directionPose(state) {
  const k=state.turn?Math.sin(Math.PI*state.turn.elapsed/.24):0;
  return {width:1-.10*k,drop:1.4*k,turning:!!state.turn};
}
