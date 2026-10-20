import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {freshLayout,actionNavigationModel} from '../docs/design/art-workflow/space-v1/geometry.js';
import {planPath} from '../web/upstream/kit/navigation.js';
import {contactRoute} from '../web/prop-motion.js';
const scene=JSON.parse(readFileSync(new URL('../docs/design/art-workflow/o03-shell-hands-v1/scene-model.json',import.meta.url)));
function layout(planter){const l=freshLayout();l.actor={x:112,y:640};l.shell.y=450;l.destinationY=600;Object.assign(l.objects.find(o=>o.id==='gate-north'),{y:18});Object.assign(l.objects.find(o=>o.id==='planter'),planter);return l;}
it('routes the reported 580/528 flowerbox layout from the actual corner root to work',()=>{
 const l=layout({x:580,y:528}),r=planPath(actionNavigationModel(l),l.actor,{x:850,y:600});
 expect(r.passed,JSON.stringify(r)).toBe(true);
});
it('can approach the ground shell after work in the reported 558/252 layout',()=>{
 const l=layout({x:558,y:252}),spec={...scene.shell,grip:{...scene.shell.grip,...scene.hands.propGrip}},h=40*spec.visibleBounds.height/spec.visibleBounds.width;
 const r=contactRoute({profile:scene.motion,pivots:scene.whale.pivots,hand:spec.binding.hand,grip:{x:l.shell.x,y:l.shell.y-h*(1-spec.grip.y)},floor:l.shell.y,scale:180/256,facing:-1});
 const route=planPath(actionNavigationModel(l),{x:850,y:600},{x:r.x,y:l.shell.y});
 expect(route.passed,JSON.stringify(route)).toBe(true);
 for(const y of [440,446,460])expect(planPath(actionNavigationModel(l),{x:850,y:600},{x:r.x,y}).passed).toBe(true);
});
it('keeps full-body content restrictions, uncalibrated solids, world edges and swept ground collisions',()=>{
 const l=layout({x:580,y:528}),m=actionNavigationModel(l);
 expect(planPath(m,l.actor,{x:850,y:350}).passed).toBe(false); // head intersects content rectangle
 expect(planPath(m,l.actor,{x:100,y:640}).passed).toBe(false); // full width + margin leaves world
 expect(planPath(m,l.actor,{x:600,y:610}).passed).toBe(false); // actual flowerbox base
 l.objects.push({id:'unknown',solid:true,layer:'depth',x:350,y:100,w:20,h:20});
 expect(planPath(actionNavigationModel(l),l.actor,{x:360,y:250}).passed).toBe(false); // full body for unknown geometry
});
it('minimal linked elevations cannot manufacture a wall, while their ground bands still block traversal',()=>{
 const l=layout({x:580,y:528});l.objects=l.objects.filter(o=>['planter','station'].includes(o.id));
 const p=planPath(actionNavigationModel(l),l.actor,{x:850,y:600});expect(p.passed).toBe(true);expect(p.alternative).toBe(true);
});
