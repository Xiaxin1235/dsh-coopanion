import { it, expect } from 'vitest';
import { initialPropInteraction, stepPropInteraction } from '../web/prop-interaction.js';

function fixture() {
  let state=initialPropInteraction(),now=0;
  const input={bodyX:200,minX:80,maxX:900,pickupTarget:300,dropTarget:700,canWalk:true,moving:false,contact:{settled:true,distance:0,groundDistance:0}};
  return {get state(){return state;},tick(patch={}){now+=16;const out=stepPropInteraction(state,{...input,now,...patch});state=out.state;return out;},arrive(){return this.tick({bodyX:state.destination,event:{kind:'arrived',walkId:state.walkId}});},settle(){for(let i=0;i<4;i++)this.tick();},pickup(){this.tick({command:{type:'pickup'}});this.arrive();this.settle();this.tick();}};
}
it('requires matching arrival at the actual target, then stable contact, before a single pickup',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});const id=f.state.walkId;
  f.tick({event:{kind:'arrived',walkId:id-1},bodyX:300});expect(f.state.phase).toBe('approach');
  f.arrive();expect(f.state.phase).toBe('reach');
  for(let i=0;i<12;i++)f.tick({contact:{settled:true,distance:8,groundDistance:0}});
  expect(f.state.owner).toBe('ground');expect(f.state.commits.pickup).toBe(0);
  f.settle();expect(f.state.owner).toBe('hand');expect(f.state.commits.pickup).toBe(1);
  for(let i=0;i<20;i++)f.tick({command:{type:'pickup'}});
  expect(f.state.phase).toBe('held');expect(f.state.commits.pickup).toBe(1);
});
it('rejects a matching arrival whose physical position is wrong',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});f.tick({event:{kind:'arrived',walkId:f.state.walkId},bodyX:100});
  expect(f.state.phase).toBe('paused');expect(f.state.owner).toBe('ground');expect(f.state.error).toBe('interrupted');
});
it('pause preserves the movement goal and ownership, resume uses a new id and ignores stale callbacks',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});const id=f.state.walkId;
  expect(f.tick({command:{type:'pause'}}).effects).toContainEqual({type:'stop',id});
  expect(f.state.destination).toBe(300);expect(f.state.phase).toBe('paused');
  f.tick({command:{type:'resume'}});expect(f.state.walkId).toBeGreaterThan(id);
  f.tick({event:{kind:'arrived',walkId:id},bodyX:300});expect(f.state.phase).toBe('approach');
  f.arrive();f.settle();f.tick();expect(f.state.owner).toBe('hand');
  f.tick({command:{type:'drop'}});f.tick({command:{type:'pause'}});expect(f.state.owner).toBe('hand');
  f.tick({command:{type:'resume'}});f.arrive();
  for(let i=0;i<12;i++)f.tick({contact:{settled:true,distance:0,groundDistance:9}});
  expect(f.state.owner).toBe('hand');expect(f.state.commits.drop).toBe(0);
  f.settle();expect(f.state.owner).toBe('ground');expect(f.state.commits).toEqual({pickup:1,drop:1});
});
it('a reach interruption does not attach, and a lower interruption does not release or double commit',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});f.arrive();f.tick();
  f.tick({command:{type:'pause'}});expect(f.state.owner).toBe('ground');
  f.tick({command:{type:'resume'}});f.settle();f.tick();f.tick({command:{type:'drop'}});f.arrive();f.tick();
  f.tick({command:{type:'pause'}});expect(f.state.owner).toBe('hand');
  f.tick({command:{type:'resume'}});f.settle();for(let i=0;i<20;i++)f.tick();
  expect(f.state.phase).toBe('idle');expect(f.state.commits).toEqual({pickup:1,drop:1});
});
it('ground relocation retires its route while a held object cannot be externally detached',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});const id=f.state.walkId;
  const relocated=f.tick({command:{type:'relocate',x:450}});expect(relocated.effects).toContainEqual({type:'stop',id});expect(f.state.phase).toBe('idle');
  f.tick({event:{kind:'arrived',walkId:id},bodyX:300});expect(f.state.commits.pickup).toBe(0);
  f.pickup();const held=f.tick({command:{type:'relocate',x:100}});expect(held.effects).not.toContainEqual({type:'relocate',x:100});expect(f.state.owner).toBe('hand');
});
it('missing capability and unreachable destinations do not manufacture arrival or ownership',()=>{
  const f=fixture();expect(f.tick({command:{type:'pickup'},canWalk:false}).effects).toEqual([]);expect(f.state.error).toBe('unreachable');
  f.tick({command:{type:'pickup'},pickupTarget:1000});expect(f.state.owner).toBe('ground');expect(f.state.walkId).toBeNull();
});
it('reset advances generation and lifecycle gaps conservatively pause',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});const id=f.state.walkId;
  f.tick({command:{type:'reset'}});f.tick({command:{type:'pickup'}});expect(f.state.walkId).toBeGreaterThan(id);
  f.tick({now:5000});expect(f.state.phase).toBe('paused');expect(f.state.owner).toBe('ground');
});
it('unreachable contact times out without attaching or releasing, and invalid relocation is ignored',()=>{
  const f=fixture();f.tick({command:{type:'pickup'}});f.arrive();
  for(let i=0;i<390;i++)f.tick({contact:{settled:true,distance:50,groundDistance:0}});
  expect(f.state.phase).toBe('paused');expect(f.state.error).toBe('contact-timeout');expect(f.state.owner).toBe('ground');
  expect(f.tick({command:{type:'relocate',x:NaN}}).effects).toEqual([]);
});
