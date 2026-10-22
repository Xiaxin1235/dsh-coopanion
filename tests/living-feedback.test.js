import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {initialSpaceAction,stepSpaceAction} from '../web/upstream/kit/space-action.js';
const profile=JSON.parse(readFileSync(new URL('../web/props/shell/motion-with-hands.json',import.meta.url)));
it('a user interruption of ground idle yields without bending into a nonexistent object',()=>{
 let state=initialSpaceAction(profile);
 const pause=stepSpaceAction(state,{now:1,command:{type:'pause'}},profile);
 const resumed=stepSpaceAction(pause.state,{now:2,command:{type:'yield'},revision:1,objectRevision:1},profile);
 expect(resumed.state.owner).toBe('ground');
 expect(resumed.state.phase).toBe('idle');
 expect(resumed.effects).toEqual([]);
});

import {bodyAnimating,advanceRenderCadence} from '../web/render-cadence.js';
it.each(['prepare','settle','look','reach','grasp','lift','held','settleDrop','lower','touch','release','retract','rise'])('standing authored %s retains the display cadence',action=>{
 const layout={moving:false,living:{action,phase:'life'}};
 const next=advanceRenderCadence({at:0,elapsed:0},16,1/60,!bodyAnimating(layout));
 expect(next.paint).toBe(true);
});
