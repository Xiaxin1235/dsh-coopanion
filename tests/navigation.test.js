import { describe,it,expect } from 'vitest';
import { planPath,checkPath,createNavigator } from '../web/upstream/kit/navigation.js';
import { freshLayout,navigationModel,checkRoute,occlusionOrder } from '../docs/design/art-workflow/space-v1/geometry.js';
const start={x:240,y:555},target={x:850,y:600};
const run=(n,count=3000)=>{for(let i=0;i<count&&n.state.id;i++)n.step(1/60);};
describe('stage 2 full-body navigation',()=>{
 it('diagnoses the reported flowerbox without declaring the whole map blocked',()=>{
  const l=freshLayout();Object.assign(l.objects.find(o=>o.id==='planter'),{x:508,y:261});
  expect(checkRoute(l).violations).toContainEqual({segment:1,obstacle:'planter'});
  const m=navigationModel(l),plan=planPath(m,start,target);
  expect(plan.passed).toBe(true);expect(checkPath(m,plan.points).passed).toBe(true);
  expect(m.obstacles.find(o=>o.id==='planter').art).toMatchObject({x:508,y:261,w:112,h:105});
 });
 it('finds a legal alternative when the straight line is blocked, then detects a closed gate',()=>{
  const l=freshLayout();l.objects.find(o=>o.id==='planter').y=280;const m=navigationModel(l),p=planPath(m,start,target);
  expect(p.alternative).toBe(true);expect(checkPath(m,p.points).passed).toBe(true);expect(p.direct.violations[0]).toMatchObject({segment:1,obstacle:'planter',envelope:'solid-silhouette'});
  l.objects.find(o=>o.id==='gate-north').h=300;
  expect(planPath(navigationModel(l),start,target).passed).toBe(false);
 });
 it('keeps shadow and transparent art distinct from physical silhouette and depth',()=>{
  const l=freshLayout(),m=navigationModel(l),pot=m.obstacles.find(o=>o.id==='planter');
  expect(pot.x).toBeGreaterThan(pot.art.x);expect(pot.y+pot.h).toBeLessThan(pot.art.y+pot.art.h);
  const before=planPath(m,start,target);occlusionOrder(l.objects,250);expect(planPath(m,start,target)).toEqual(before);
  const panel=m.obstacles.find(o=>o.id==='panel');expect(panel).toMatchObject({...panel.art,kind:'full-body-restricted'});
 });
 it('does not use a foot point through content or pass through thin obstacles and exact boundaries',()=>{
  const m={width:500,height:500,revision:1,body:{left:30,right:30,top:100,bottom:5},margin:0,obstacles:[{id:'thin',x:250,y:0,w:.001,h:500}]};
  expect(planPath(m,{x:100,y:250},{x:400,y:250}).passed).toBe(false);
  expect(checkPath(m,[{x:220,y:250},{x:220,y:250}]).passed).toBe(false);
  expect(checkPath(m,[{x:219.99,y:250},{x:219.99,y:250}]).passed).toBe(true);
  expect(planPath(m,{x:100,y:99.99},{x:100,y:300}).reason).toBe('start-blocked');
 });
 it('moves in both axes using continuously swept segments, stops then arrives exactly once',()=>{
  const m=navigationModel(freshLayout()),events=[],n=createNavigator(start,(kind,value)=>events.push({kind,...value}));
  n.request({id:1,generation:1,model:m,target});let previous=n.state,sawY=false,sawBraking=false;
  for(let i=0;i<3000&&n.state.id;i++){const s=n.step(1/60);expect(checkPath(m,[previous,s]).passed).toBe(true);expect(Math.abs(s.speed-previous.speed)).toBeLessThanOrEqual(180/60+.001);expect(Math.hypot(s.x-previous.x,s.y-previous.y)).toBeLessThanOrEqual(100/60+.001);sawY ||= s.y!==start.y;sawBraking ||= previous.speed>s.speed;previous=s;}
  expect(sawY&&sawBraking).toBe(true);expect(n.state).toMatchObject({...target,speed:0,phase:'idle'});expect(events.filter(e=>e.kind==='navigation-arrived')).toEqual([expect.objectContaining({id:1,revision:1,...target})]);n.step(1);expect(events).toHaveLength(1);
 });
 it('replaces targets from the braking endpoint, rejects stale ids/generations and cancels without late arrival',()=>{
  const m=navigationModel(freshLayout()),events=[],n=createNavigator(start,(kind,value)=>events.push({kind,...value}));n.request({id:1,generation:3,model:m,target});for(let i=0;i<80;i++)n.step(1/60);
  const p=n.state;n.request({id:2,generation:3,model:m,target:start});expect(n.state.x).toBe(p.x);expect(n.state.speed).toBe(p.speed);
  expect(n.request({id:1,generation:2,model:m,target})).toBeNull();run(n);expect(n.state.x).toBe(start.x);expect(events.filter(e=>e.kind==='navigation-arrived').map(e=>e.id)).toEqual([2]);
  n.request({id:3,generation:4,model:m,target});n.cancel('drag');run(n);expect(events.at(-1)).toMatchObject({kind:'navigation-interrupted',by:'drag',id:3});
 });
 it('rejects old route revisions within a generation but permits an explicit new setup',()=>{
  const m=navigationModel(freshLayout()),n=createNavigator(start);m.revision=9;n.request({id:1,generation:2,model:m,target});
  const old={...m,revision:8};expect(n.request({id:2,generation:2,model:old,target})).toBeNull();
  n.cancel('setup');expect(n.request({id:3,generation:3,model:{...m,revision:1},target}).passed).toBe(true);
 });
 it('settles every replaced or cancelled identity once even during repeated braking',()=>{
  const m=navigationModel(freshLayout()),events=[],n=createNavigator(start,(kind,v)=>events.push({kind,...v}));n.request({id:1,generation:1,model:m,target});for(let i=0;i<80;i++)n.step(1/60);
  n.request({id:2,generation:1,model:{...m,revision:4},target:start});
  expect(n.request({id:3,generation:1,model:{...m,revision:3},target})).toBeNull();
  n.request({id:4,generation:1,model:{...m,revision:4},target});n.cancel('cancel');run(n);
  expect(events.map(e=>[e.id,e.by])).toEqual([[1,'replaced'],[2,'replaced'],[4,'cancel']]);
 });
 it('checks changed geometry before moving and does not pretend to arrive at an occupied target',()=>{
  const l=freshLayout(),m=navigationModel(l),events=[],n=createNavigator(start,(kind,value)=>events.push({kind,...value}));n.request({id:1,generation:1,model:m,target});for(let i=0;i<70;i++)n.step(1/60);
  const current=n.state;const updated=structuredClone(m);updated.revision++;updated.obstacles.push({id:'new',x:current.x-5,y:current.y-10,w:10,h:10});n.request({id:2,generation:1,model:updated,target});n.step(1/60);expect(n.state.x).toBe(current.x);expect(events.at(-1)).toMatchObject({kind:'navigation-interrupted',by:'geometry-overlap',id:2,revision:2});expect(events.some(e=>e.kind==='navigation-arrived')).toBe(false);
 });
});
