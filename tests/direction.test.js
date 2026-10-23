import {describe,it,expect} from 'vitest';
import {headingForVelocity,initialDirection,stepDirection,directionPose,DIRECTIONS} from '../web/upstream/whale/direction.js';
import definition from '../web/upstream/whale/directions/model.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyDirectionRestShape,decorationFarPose} from '../web/upstream/whale/direction-shape.js';
describe('directional body',()=>{
 it('keeps authored rest alignment under breathing and does not move unrelated meshes',()=>{
  const state={hairFront:{fn:()=>[2,1],a:3},dress:{a:4}};applyDirectionRestShape(state,definition.directions.front);
  expect(state.hairFront.fn(.5,.5)).toEqual([2,-7]);expect(state.hairFront.fn(.5,0)).toEqual([2,1]);expect(state.hairFront.a).toBe(3);expect(state.dress).toEqual({a:4});
 });
 it('places the asymmetric far-side decoration in its authored rectangle',()=>{
  const d=definition.directions.backRight.headBow,p=decorationFarPose(d),[x,y,w,h]=d.box,[px,py]=d.pivot;
  expect(px+p.sx*(x-px)+p.tx).toBeCloseTo(d.farBox[0]);expect(py+p.sy*(y-py)+p.ty).toBeCloseTo(d.farBox[1]);expect(w*p.sx).toBeCloseTo(d.farBox[2]);expect(h*p.sy).toBeCloseTo(d.farBox[3]);
 });
 it('maps actual planar velocity to all six views and ignores gaze/noise',()=>{
  for(const [x,y,want]of [[0,60,'front'],[60,40,'frontRight'],[60,-40,'backRight'],[0,-60,'back'],[-60,-40,'backLeft'],[-60,40,'frontLeft']])expect(headingForVelocity(x,y)).toBe(want);
  expect(headingForVelocity(1,-1,'back')).toBe('back');expect(headingForVelocity(60,-1,'frontRight')).toBe('frontRight');
 });
 it('turns through neighbours with bounded width and can retarget during a turn',()=>{
  let s=initialDirection(),last=s.current;let seen=new Set();
  for(let i=0;i<150;i++){s=stepDirection(s,{dt:1/60,vx:i<60?0:-60,vy:-60,moving:true});seen.add(s.current);if(s.current!==last){const d=Math.abs(DIRECTIONS.indexOf(last)-DIRECTIONS.indexOf(s.current));expect([1,5]).toContain(d);}expect(directionPose(s).width).toBeGreaterThanOrEqual(.9);last=s.current;}
  expect(seen.has('back')).toBe(true);expect(s.current).toBe('backLeft');
 });
 it('returns attention to front, holds slow heading, and switches contact to calibrated pose immediately',()=>{
  let s={...initialDirection(),current:'back',target:'back',candidate:'back'};
  for(let i=0;i<20;i++)s=stepDirection(s,{dt:1/60,vx:1,vy:1,moving:true});expect(s.current).toBe('back');
  for(let i=0;i<110;i++)s=stepDirection(s,{dt:1/60});expect(s.current).toBe('front');
  s=stepDirection(s,{dt:.01,compatible:false,facing:-1});expect(s.legacy).toBe(true);expect(s.current).toBe('frontLeft');expect(s.turn).toBe(null);
 });
 it('static sandbox model and shipped PNG bytes match the calibrated export',()=>{
  const root=new URL('../web/upstream/whale/directions/',import.meta.url),json=JSON.parse(readFileSync(new URL('model.json',root)));expect(definition).toEqual(json);
  const manifest=JSON.parse(readFileSync(new URL('provenance.json',root)));
  for(const [name,sha]of Object.entries(manifest.files))expect(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')).toBe(sha);
  for(const group of Object.values(definition.directions)){expect(group.anchors.ground).toEqual([128,256]);for(const p of group.parts)expect(p.box.every(Number.isFinite)).toBe(true);}
 });
});
