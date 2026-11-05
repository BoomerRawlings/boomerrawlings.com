import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryAuthStore, configuredAuth, createAuthConfig } from './auth.mjs';
import { configuredCatalog } from './catalog.mjs';
import { createHandler } from './handler.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
export async function readLocal(name, base = root) {
  if (!/^client\/(?:gate|app)\.(?:html|css|js)$/.test(name)) return new Response('Not found', { status: 404 });
  try { return new Response(await readFile(path.join(base, name)), { headers: { 'Content-Type': types[path.extname(name)] } }); }
  catch { return new Response('Not found', { status: 404 }); }
}
export async function startServer({ port = 8788, authConfig, catalog, base = root, host = '127.0.0.1' } = {}) {
  if (host !== '127.0.0.1') throw new Error('Preview must bind loopback. Use the Worker for production.');
  const store = new MemoryAuthStore();
  let handle;
  const server = createServer(async (req, res) => {
    try {
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {})
      });
      const result = await handle(request);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      if (result.body) Readable.fromWeb(result.body).pipe(res); else res.end();
    } catch { res.writeHead(500, { 'Cache-Control': 'no-store' }); res.end('Request failed'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const origin = `http://${host}:${server.address().port}`;
  handle = createHandler({ read: name => readLocal(name, base), store, authConfig, catalog, origin, secure: false });
  return { server, origin, store };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let authConfig;
  if (process.env.OBSERVATORY_PASSWORD) {
    authConfig = await createAuthConfig(process.env.OBSERVATORY_PASSWORD);
    delete process.env.OBSERVATORY_PASSWORD;
  } else {
    try { authConfig = configuredAuth(await readFile(path.join(root, '.private/auth.json'), 'utf8')); }
    catch { /* Unconfigured preview intentionally serves only the gate. */ }
  }
  let catalog;
  try { catalog = configuredCatalog(await readFile(path.join(root, '.private/catalog.json'), 'utf8')); }
  catch { /* Unconfigured preview intentionally serves only the gate. */ }
  const { origin } = await startServer({ port: Number(process.env.PORT || 8788), authConfig, catalog });
  console.log(`Observatory local preview: ${origin}/observatory/`);
  if (!authConfig || !catalog) console.log('Authentication or directory is unconfigured; access remains closed.');
}
