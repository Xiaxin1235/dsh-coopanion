import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { initialSpaceAction, stepSpaceAction, sampleSpaceAction, pickupMirror, createSpaceNavigationChannel } from '../web/upstream/kit/space-action.js';
const profile = JSON.parse(readFileSync(new URL('../web/props/shell/motion-with-hands.json',import.meta.url)));
function fixture() {
 let state=initialSpaceAction(profile),now=0;
 const base={dt:.05,bodyX:300,bodyY:555,speed:0,moving:false,standingReady:true,facingReady:true,revision:1,objectRevision:1,canNavigate:true,
  minX:0,maxX:1080,pickupRoute:{x:300,y:555,drop:8,facing:1},dropRoute:{x:450,y:600,drop:8,facing:-1},contact:{settled:true,distance:0,groundDistance:0},hand:{enabled:true,weights:{grip:1,release:1}}};
 return {get state(){return state;},set state(s){state=s;},tick(p={}){now+=50;const r=stepSpaceAction(state,{...base,now,...p},profile);state=r.state;return r;},until(phase,patch={}){for(let i=0;i<800&&state.phase!==phase;i++)this.tick(patch);expect(state.phase).toBe(phase);},start(){this.tick({command:{type:'loop'}});this.until('approach');},arrive(p={}){return this.tick({bodyX:state.route.x,bodyY:state.route.y,event:{kind:'navigation-arrived',...state.navigation},...p});}};
}
it('rises from a seated pose before issuing any navigation and pauses mid preparation without a pose jump',()=>{
 const f=fixture();f.tick({command:{type:'sit'}});expect(f.state.phase).toBe('rest');f.tick({command:{type:'pickup'}});
 for(let i=0;i<30;i++)expect(f.tick({standingReady:false}).effects.some(e=>e.type==='navigate')).toBe(false);
 const pose=sampleSpaceAction(f.state,profile);f.tick({command:{type:'pause'}});expect(sampleSpaceAction(f.state,profile)).toEqual(pose);
 f.tick({command:{type:'resume'}});f.until('approach');expect(f.state.navigation.revision).toBe(1);
});
it('rejects stale ids, generations, geometry revisions, false position and nonzero speed',()=>{
 for(const bad of [{id:1},{generation:0},{revision:0}]){const f=fixture();f.start();f.arrive({event:{kind:'navigation-arrived',...f.state.navigation,...bad}});expect(f.state.phase).toBe('approach');}
 for(const bad of [{bodyY:552},{bodyX:100},{speed:2}]){const f=fixture();f.start();f.arrive(bad);expect(f.state.phase).toBe('paused');expect(f.state.commits.pickup).toBe(0);}
});
it('replans paused navigation with fresh identity, preserving ownership and ignoring the old receipt',()=>{
 const f=fixture();f.start();const old=f.state.navigation;f.tick({command:{type:'pause'}});f.tick({command:{type:'resume'}});f.until('approach');expect(f.state.navigation.id).toBeGreaterThan(old.id);
 f.arrive({event:{kind:'navigation-arrived',...old}});expect(f.state.phase).toBe('approach');f.arrive();f.until('held');expect(f.state.commits.pickup).toBe(1);
});
it('requires real stable contact and a closed hand, and pauses immediately before and after commits without replay',()=>{
 const f=fixture();f.start();f.arrive();f.until('reach');for(let i=0;i<30;i++)f.tick({contact:{settled:true,distance:12,groundDistance:0}});expect(f.state.owner).toBe('ground');
 f.until('grasp');for(let i=0;i<20;i++)f.tick({hand:{enabled:true,weights:{grip:.6}}});expect(f.state.commits.pickup).toBe(0);
 f.tick({command:{type:'pause'}});f.tick({command:{type:'resume'}});f.until('lift');f.tick({command:{type:'pause'}});expect(f.state.owner).toBe('hand');f.tick({command:{type:'resume'}});f.until('carry');f.arrive();f.until('release');
 f.tick({command:{type:'pause'}});expect(f.state.owner).toBe('hand');expect(f.state.commits.drop).toBe(0);f.tick({command:{type:'resume'}});f.until('retract');f.tick({command:{type:'pause'}});f.tick({command:{type:'resume'}});f.until('idle');expect(f.state.commits).toEqual({pickup:1,drop:1});
});
it('geometry changes retire the route and force re-evaluation without committing ownership',()=>{
 const f=fixture();f.start();f.tick({revision:2});expect(f.state.phase).toBe('paused');expect(f.state.error).toBe('world-changed');f.tick({revision:2,command:{type:'resume'}});f.until('approach',{revision:2});expect(f.state.navigation.revision).toBe(2);expect(f.state.commits.pickup).toBe(0);
});
it('missing capability, invalid targets, lifecycle gaps and reset never fabricate contact',()=>{
 for(const bad of [{canNavigate:false},{pickupRoute:{x:NaN,y:555,drop:8}},{pickupRoute:{x:300,y:Infinity,drop:8}}]){const f=fixture();f.tick({command:{type:'pickup'},...bad});expect(f.state.phase).toBe('paused');expect(f.state.commits.pickup).toBe(0);}
 const f=fixture();f.start();const old=f.state.navigation;f.tick({now:50000});expect(f.state.phase).toBe('paused');f.tick({command:{type:'reset'}});f.start();expect(f.state.navigation.generation).toBeGreaterThan(old.generation);
});

it('idle lifecycle resume cannot invent a pickup, and seated relocation keeps the seated intent',()=>{
 const f=fixture();f.tick({command:{type:'pause'}});f.tick({command:{type:'resume'}});expect(f.state.phase).toBe('idle');expect(f.state.navigation).toBeNull();
 f.tick({command:{type:'sit'}});const r=f.tick({command:{type:'relocate',x:350,y:600}});expect(r.effects).toContainEqual({type:'relocate',x:350,y:600});expect(f.state.phase).toBe('rest');
 f.tick({command:{type:'pause'}});f.tick({command:{type:'resume'}});expect(f.state.phase).toBe('rest');expect(f.state.commits.pickup).toBe(0);
});
it('object changes before contact replan, while a held object is never externally detached',()=>{
 const f=fixture();f.start();f.arrive();f.until('reach');f.tick({objectRevision:2});expect(f.state.phase).toBe('paused');f.tick({objectRevision:2,command:{type:'resume'}});f.until('approach',{objectRevision:2});expect(f.state.objectRevision).toBe(2);
 f.arrive({objectRevision:2});f.until('held',{objectRevision:2});expect(f.tick({objectRevision:2,command:{type:'relocate',x:50,y:400}}).effects.some(e=>e.type==='relocate')).toBe(false);expect(f.state.owner).toBe('hand');
});

it('a geometry change after drop resumes the exit without inventing another pickup',()=>{
 const f=fixture();f.start();f.arrive();f.until('carry');f.arrive();f.until('retract');expect(f.state.commits.drop).toBe(1);
 f.tick({revision:2});expect(f.state.phase).toBe('paused');f.tick({revision:2,command:{type:'resume'}});f.until('idle',{revision:2});expect(f.state.commits).toEqual({pickup:1,drop:1});
});

it('preserves ground texture orientation when picking up from either side',()=>{
 const right=[{x:10,y:0},{x:50,y:0},{x:10,y:33}],left=[right[1],right[0],{x:50,y:33}];
 expect(pickupMirror(right,1)).toBe(1);expect(pickupMirror(right,-1)).toBe(-1);
 expect(pickupMirror(left,1)).toBe(-1);expect(pickupMirror(left,-1)).toBe(1);
});

it('manual and action routes share monotonic physical identities without changing their logical receipts',()=>{
 const c=createSpaceNavigationChannel(),model={revision:4};
 const a=c.encode({id:1,generation:2,model}),b=c.encode({id:2000001,generation:2,model}),d=c.encode({id:2,generation:3,model});
 expect(a.id<b.id&&b.id<d.id).toBe(true);
 expect(c.decode({...b,revision:4})).toMatchObject({id:2000001,generation:2});
 expect(c.decode({...d,revision:4})).toMatchObject({id:2,generation:3});
 expect(c.decode({...a,generation:0,revision:4})).toBeNull();expect(c.decode({...a,revision:3})).toBeNull();
 for(let i=0;i<64;i++)c.encode({id:i,generation:4,model});expect(c.decode({...a,revision:4})).toBeNull();
});

it('preserves the specific navigation rejection for actionable feedback without committing',()=>{
 const f=fixture();f.start();f.tick({event:{kind:'navigation-interrupted',...f.state.navigation,by:'target-blocked'}});
 expect(f.state.phase).toBe('paused');expect(f.state.error).toBe('target-blocked');expect(f.state.owner).toBe('ground');expect(f.state.commits.pickup).toBe(0);
});
