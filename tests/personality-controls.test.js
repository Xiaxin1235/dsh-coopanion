import {it,expect,vi,afterEach} from 'vitest';
import {mountStage5} from '../docs/design/art-workflow/space-v1/stage5-preview.js';
import {initialPersonality} from '../web/upstream/kit/personality.js';
afterEach(()=>vi.unstubAllGlobals());
it('old body frames cannot overwrite unsubmitted parameter edits before Apply',()=>{
 const nodes=new Map(),node=()=>({value:'',checked:false,textContent:'',before(){},append(){},prepend(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 vi.stubGlobal('document',{createElement:node,getElementById:get,querySelector:get});
 const commands=[],panel=mountStage5(c=>commands.push(c)),p=initialPersonality();
 const frame={coordination:{phase:'idle',personality:p}};
 panel.render(frame);get('personality-id').value='quiet';get('personality-id').onchange();
 get('personality-dwell').value='12';get('personality-dwell').oninput();panel.render(frame);
 get('personality-explore').value='0.95';get('personality-explore').oninput();panel.render(frame);
 expect(get('personality-dwell').value).toBe('12');expect(get('personality-explore').value).toBe('0.95');
 get('personality-apply').onclick();expect(commands.at(-1)).toMatchObject({parameters:{dwellMin:12,explore:.95}});
});
