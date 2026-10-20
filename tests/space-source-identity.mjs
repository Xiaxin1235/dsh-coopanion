import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
// Local verification binds the exact consumed sources and assets to a base commit.
export async function spaceSourceIdentity() {
 const files=['web/prop-motion.js','web/upstream/kit/space-action.js','web/upstream/kit/navigation.js','web/upstream/kit/body.js','web/upstream/kit/raster.js','web/upstream/whale/figure.js','web/upstream/whale/hand-art.js','web/upstream/body-host.js','web/upstream/figure-frame.js','desktop/space-preview.cjs',
 'docs/design/art-workflow/space-v1/scene.js','docs/design/art-workflow/space-v1/geometry.js','docs/design/art-workflow/space-v1/index.html','docs/design/art-workflow/space-v1/style.css','docs/design/art-workflow/o03-shell-hands-v1/figure.js','docs/design/art-workflow/o03-shell-hands-v1/composition.js','docs/design/art-workflow/o03-shell-hands-v1/scene-model.json','web/props/shell/shell.png','web/props/shell/asset.json','web/props/shell/hands/asset.json','web/props/shell/hands/grip.png','tests/space-action-ui.mjs','tests/space-feedback.test.js','tests/space-feedback-ui.mjs','docs/design/art-workflow/space-v1/layouts/stage-3-feedback-20261020.json','docs/design/art-workflow/space-v1/layouts/stage-3-feedback-moved-20261020.json'];
 const sources={};for(const file of files)sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 return {baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,sources,digest:createHash('sha256').update(JSON.stringify(sources)).digest('hex')};
}
