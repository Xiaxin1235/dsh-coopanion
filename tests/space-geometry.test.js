import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BODY, freshLayout, checkRoute, intersectsSegment, expanded, actionRoute, occlusionOrder } from '../docs/design/art-workflow/space-v1/geometry.js';
describe('stage 1 continuous full-body clearance', () => {
  it('keeps original vector source and design brief identities explicit', () => {
    const base=new URL('../docs/design/art-workflow/space-v1/assets/',import.meta.url);
    const manifest=JSON.parse(readFileSync(new URL('source.json',base)));
    for(const entry of manifest.sources){const bytes=readFileSync(new URL(entry.file,base));expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);expect(bytes.length).toBe(entry.bytes);}
    for(const file of ['home.svg','station.svg','planter.svg','post.svg'])expect(readFileSync(new URL(file,base),'utf8')).toMatch(/viewBox="0 0 \d+ \d+"/);
  });
  it('passes the whole home-to-work polyline including turn allowance and the horizontal action strip', () => {
    const map=freshLayout();expect(checkRoute(map)).toMatchObject({passed:true,violations:[],margin:12});expect(actionRoute(map).passed).toBe(true);
    expect(map.objects.find(o=>o.id==='gate-south').y-(map.objects.find(o=>o.id==='gate-north').y+40)).toBe(302);
  });
  it('fails when only the body clips an obstacle while the centre line misses it', () => {
    const map=freshLayout(),pot=map.objects.find(o=>o.id==='planter');pot.y=375;
    expect(intersectsSegment(map.route[1],map.route[2],pot)).toBe(false);
    expect(checkRoute(map).violations.some(v=>v.obstacle==='planter')).toBe(true);
  });
  it('checks thin obstacles between endpoints without sampled-step tunnelling', () => {
    const map=freshLayout();map.objects.push({id:'thin',solid:true,x:620,y:560,w:.01,h:.01});
    expect(checkRoute(map).violations.some(v=>v.obstacle==='thin')).toBe(true);
    expect(intersectsSegment({x:0,y:0},{x:1000,y:0},{x:500,y:-1,w:.001,h:2})).toBe(true);
  });
  it('does not reverse the top/bottom extents when expanding rectangles around the feet root', () => {
    expect(expanded({x:500,y:300,w:20,h:10},BODY,0)).toEqual({x:400,y:292,w:220,h:223});
    expect(intersectsSegment({x:510,y:500},{x:511,y:500},expanded({x:500,y:300,w:20,h:10},BODY,0))).toBe(true);
  });
  it('fails the gate after narrowing it even if the centre still fits, and recovers after restoring', () => {
    const map=freshLayout();map.objects.find(o=>o.id==='gate-north').h=180;
    expect(checkRoute(map).passed).toBe(false);map.objects.find(o=>o.id==='gate-north').h=40;expect(checkRoute(map).passed).toBe(true);
  });
  it('rejects body overlap with world edges and invalid routes', () => {
    const map=freshLayout();expect(checkRoute(map,[{x:20,y:555},{x:240,y:555}]).violations.some(v=>v.obstacle==='world-edge')).toBe(true);
    expect(checkRoute(map,[]).passed).toBe(false);expect(checkRoute(map,[{x:NaN,y:1},{x:2,y:2}]).passed).toBe(false);
  });
  it('keeps hidden solids in geometry and locks an obstructed action plane', () => {
    const map=freshLayout(),pot=map.objects.find(o=>o.id==='planter');pot.hidden=true;pot.x=330;pot.y=450;
    expect(actionRoute(map).passed).toBe(false);expect(checkRoute(map).passed).toBe(false);
  });
  it('sorts scene depth independently of the indivisible palm-shell-finger composite', () => {
    const map=freshLayout();expect(occlusionOrder(map.objects,555).at(-1)).toBe('gate-south');
    expect(occlusionOrder(map.objects,300).indexOf('body-shell-fingers')).toBeLessThan(occlusionOrder(map.objects,300).indexOf('home'));
    expect(occlusionOrder(map.objects,555).indexOf('body-shell-fingers')).toBeGreaterThan(occlusionOrder(map.objects,555).indexOf('home'));
  });
});
