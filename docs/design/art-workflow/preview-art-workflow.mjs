import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const port = Number(process.env.PORT ?? 4186);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const home = '/docs/design/art-workflow/space-v1/index.html';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webm':'video/webm', '.txt':'text/plain; charset=utf-8', '.md':'text/plain; charset=utf-8' };
createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if (path === '/') { res.writeHead(302,{ Location: home }); res.end(); return; }
    const requested = path;
    const motionModule = ['/web/prop-interaction.js', '/web/prop-motion.js'].includes(requested);
    if (!requested.startsWith('/docs/design/art-workflow/') && !requested.startsWith('/web/upstream/') && !requested.startsWith('/web/props/') && !motionModule) { res.writeHead(404); res.end(); return; }
    const file = resolve(root, '.'+requested);
    const exampleRoot = resolve(root,'docs/design/art-workflow')+sep, upstreamRoot = resolve(root,'web/upstream')+sep, propRoot=resolve(root,'web/props')+sep;
    if (!file.startsWith(exampleRoot) && !file.startsWith(upstreamRoot) && !file.startsWith(propRoot) && !motionModule) { res.writeHead(403); res.end(); return; }
    const metadata = await stat(file);
    if (!metadata.isFile()) { res.writeHead(404); res.end(); return; }
    const origin = `http://127.0.0.1:${port}`;
    const headers = { 'Content-Type':types[extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Length':metadata.size };
    if (requested.startsWith('/web/upstream/') || requested.startsWith('/web/props/') || motionModule || requested.endsWith('/reference-whale.js') || /\/o03-shell-(interaction|motion|hands)-v1\/figure\.js$/.test(requested)) headers['Access-Control-Allow-Origin'] = '*';
    if (requested.endsWith('/figure-frame.html')) headers['Content-Security-Policy'] = `default-src 'none'; script-src ${origin}/web/upstream/ ${origin}/web/prop-interaction.js ${origin}/web/prop-motion.js ${origin}/docs/design/art-workflow/o03-shell-v1/ ${origin}/docs/design/art-workflow/o03-shell-interaction-v1/ ${origin}/docs/design/art-workflow/o03-shell-motion-v1/ ${origin}/docs/design/art-workflow/o03-shell-hands-v1/; img-src ${origin}/web/upstream/ ${origin}/web/props/ data: blob:; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;
    res.writeHead(200,headers); res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(port,'127.0.0.1',()=>console.log(`Art workflow preview: http://127.0.0.1:${port}/ (isolated visual preview; no model or desktop control)`));
