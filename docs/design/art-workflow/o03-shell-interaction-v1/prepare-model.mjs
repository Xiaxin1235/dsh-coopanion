import { readFile, writeFile } from 'node:fs/promises';
const whale=JSON.parse(await readFile(new URL('../../../../web/upstream/whale/model.json',import.meta.url),'utf8'));
const shell=JSON.parse(await readFile(new URL('../../../../web/props/shell/asset.json',import.meta.url),'utf8'));
const target=new URL('./scene-model.json',import.meta.url);
const next=JSON.stringify({whale,shell})+'\n';
if(process.argv.includes('--check')){
  if(JSON.stringify(JSON.parse(await readFile(target,'utf8')))!==JSON.stringify({whale,shell}))throw new Error('Scene snapshot does not match the current model and asset spec');
  console.log('Scene snapshot matches current source model and asset spec');
}else{await writeFile(target,next);console.log('Prepared isolated scene model');}
