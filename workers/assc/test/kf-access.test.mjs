import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../handler.mjs';
import {MemoryAuthStore,createAuthConfig} from '../auth.mjs';
test('KF data and modules require the same session and logout revokes access',async()=>{
  const origin='https://example.test',reads=[];
  const handle=createHandler({origin,authConfig:await createAuthConfig('kf-fixture-only'),store:new MemoryAuthStore(),repository:{},read:async name=>{reads.push(name);return new Response(name==='.private/kf.json'?JSON.stringify({fixture:true}):'module',{headers:{'Content-Type':name.endsWith('.json')?'application/json':'text/javascript'}});}});
  for(const route of ['api/kf','client/kf.js','client/kf-model.js','client/kf.css','kf.js','kf-model.js','kf.css','_protected/private/kf.json','.private/kf.json']){
    const result=await handle(new Request(`${origin}/ASSC/${route}`));assert.equal(result.status,401);
  }assert.equal(reads.length,0);
  const login=await handle(new Request(`${origin}/ASSC/login`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({answer:'kf-fixture-only'})}));
  const cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie};
  const data=await handle(new Request(`${origin}/ASSC/api/kf`,{headers}));assert.equal(data.status,200);assert.deepEqual(await data.json(),{fixture:true});assert.match(data.headers.get('cache-control'),/no-store/);
  for(const name of ['kf.js','kf-model.js','kf.css'])assert.equal((await handle(new Request(`${origin}/ASSC/client/${name}`,{headers}))).status,200);
  assert.equal((await handle(new Request(`${origin}/ASSC/.private/kf.json`,{headers}))).status,404);
  assert.equal((await handle(new Request(`${origin}/ASSC/_protected/private/kf.json`,{headers}))).status,404);
  await handle(new Request(`${origin}/ASSC/logout`,{method:'POST',headers:{cookie,origin}}));assert.equal((await handle(new Request(`${origin}/ASSC/api/kf`,{headers}))).status,401);
});
