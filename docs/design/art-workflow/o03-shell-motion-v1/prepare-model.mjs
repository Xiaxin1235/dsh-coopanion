import { readFile, writeFile } from 'node:fs/promises';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const model = { whale: await read('../../../../web/upstream/whale/model.json'), shell: await read('../../../../web/props/shell/asset.json'), motion: await read('../../../../web/props/shell/motion-profile.json') };
const path = new URL('./scene-model.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (JSON.stringify(await read('./scene-model.json')) !== JSON.stringify(model)) throw new Error('Motion snapshot differs from source model, shell or profile');
  console.log('Motion snapshot matches source model, shell and authored poses');
} else await writeFile(path, JSON.stringify(model) + '\n');
