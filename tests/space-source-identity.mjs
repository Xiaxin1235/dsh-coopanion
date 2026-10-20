import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
// Local verification binds the exact consumed sources and assets to a base commit.
export async function spaceSourceIdentity({stage4=false,stage5=false}={}) {
 const files=['web/prop-motion.js','web/upstream/kit/space-action.js','web/upstream/kit/navigation.js','web/upstream/kit/body.js','web/upstream/kit/raster.js','web/upstream/whale/figure.js','web/upstream/whale/hand-art.js','web/upstream/body-host.js','web/upstream/figure-frame.js','desktop/space-preview.cjs',
 'docs/design/art-workflow/space-v1/scene.js','docs/design/art-workflow/space-v1/geometry.js','docs/design/art-workflow/space-v1/index.html','docs/design/art-workflow/space-v1/style.css','docs/design/art-workflow/o03-shell-hands-v1/figure.js','docs/design/art-workflow/o03-shell-hands-v1/composition.js','docs/design/art-workflow/o03-shell-hands-v1/scene-model.json','web/props/shell/shell.png','web/props/shell/asset.json','web/props/shell/hands/asset.json','web/props/shell/hands/grip.png','tests/space-action-ui.mjs','tests/space-feedback.test.js','tests/space-feedback-ui.mjs','docs/design/art-workflow/space-v1/layouts/stage-3-feedback-20261020.json','docs/design/art-workflow/space-v1/layouts/stage-3-feedback-moved-20261020.json'];
 if(stage4)files.push('src/completion.ts','src/work-facts.ts','src/work-preview.ts','src/work-sources.ts','web/upstream/kit/work-performance.js','web/upstream/kit/life-work.js','web/upstream/kit/personality.js','web/upstream/kit/personality-performance.js','docs/design/art-workflow/space-v1/stage4-preview.js','docs/design/art-workflow/space-v1/prepare-stage4.mjs','docs/design/art-workflow/space-v1/work-facts.generated.js','npm-shrinkwrap.json','tests/life-work-ui.mjs','tests/work-semantics-ui.mjs');
 if(stage5)files.push('tests/personality-feedback.test.js','docs/design/art-workflow/space-v1/stage5-preview.js','tests/personality.test.js','tests/personality-ui.mjs');
 const sources={};for(const file of files)sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 return {baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,sources,digest:createHash('sha256').update(JSON.stringify(sources)).digest('hex')};
}
