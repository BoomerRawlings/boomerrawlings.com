import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { MemoryAuthStore,createAuthConfig } from './auth.mjs';
import { Repository } from './repository.mjs';
import { createHandler } from './handler.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
export async function readLocal(name,base=root) {
  if (name === 'client/screen-motion.js') {
    try { return new Response(await readFile(path.resolve(root, '../../public/scripts/screen-motion.js')), { headers: { 'Content-Type': types['.js'] } }); }
    catch { return new Response('Not found', { status: 404 }); }
  }
  const target=path.resolve(base,name);
  if(!target.startsWith(path.resolve(base)+path.sep)) return new Response('Not found',{status:404});
  try{return new Response(await readFile(target),{headers:{'Content-Type':types[path.extname(target)] || 'application/octet-stream'}});}
  catch{return new Response('Not found',{status:404});}
}
export async function startServer({port=4317,authConfig,base=root,host='127.0.0.1'}={}) {
  if(host !== '127.0.0.1') throw new Error('Local preview must bind loopback. Use the Worker for production.');
  const read=name=>readLocal(name,base);
  const store=new MemoryAuthStore();
  let handle;
  const server=createServer(async(req,res)=>{
    try {
      const request = new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
      const result=await handle(request);
      res.writeHead(result.status,Object.fromEntries(result.headers));
      if(result.body) Readable.fromWeb(result.body).pipe(res);else res.end();
    }catch{res.writeHead(500,{'Cache-Control':'no-store'});res.end('Request failed');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const origin=`http://${host}:${server.address().port}`;
  handle=createHandler({read,repository:new Repository(read),store,authConfig,origin,secure:false});
  return {server,origin,store};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let config;
  if(process.env.ASSC_PASSCODE) { config=await createAuthConfig(process.env.ASSC_PASSCODE);delete process.env.ASSC_PASSCODE; }
  else {try{config=JSON.parse(await readFile(path.join(root,'.private','auth.json'),'utf8'));}catch{throw new Error('Configure local authentication with scripts/configure-local.mjs first.');}}
  const {origin}=await startServer({port:Number(process.env.PORT || 4317),authConfig:config});
  console.log(`ASSC private local preview: ${origin}/ASSC/`);
}
