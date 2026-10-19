// Optional renderer-specific diagnostic replay. Never edits frozen evidence.
import { chromium } from '../../../../../../node_modules/playwright-core/index.mjs';
import { readFile } from 'node:fs/promises';
const oldComposite=await readFile(new URL('./baseline-composition.js',import.meta.url),'utf8');
const oldPixels=await readFile(new URL('./baseline-continuity.js',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const results=[];
  for(const mode of ['frozen-baseline','current']) {
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    if(mode==='frozen-baseline') {await page.route('**/composition.js',r=>r.fulfill({contentType:'text/javascript',body:oldComposite}));await page.route('**/continuity.js',r=>r.fulfill({contentType:'text/javascript',body:oldPixels}));}
    await page.goto((process.env.SPACE_PREVIEW_URL??'http://127.0.0.1:4189')+'/docs/design/art-workflow/o03-shell-hands-v1/continuity.html');await page.click('#run');await page.waitForFunction(()=>document.querySelector('#report').textContent.includes('"passed"'));
    results.push({mode,report:JSON.parse(await page.textContent('#report'))});await page.close();
  }
  console.log(JSON.stringify({browser:browser.version(),results},null,2));
  if(!results.find(r=>r.mode==='current').report.passed)process.exitCode=1;
} finally {await browser.close();}
