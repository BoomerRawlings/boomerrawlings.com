import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../handler.mjs';
import {MemoryAuthStore,createAuthConfig} from '../auth.mjs';
test('profile data and modules remain protected; unsafe profile IDs are rejected',async()=>{
  const origin='https://profiles-test.invalid';let reads=0;
  const handler=createHandler({origin,authConfig:await createAuthConfig('fixture-profile'),store:new MemoryAuthStore(),repository:{},read:async p=>{reads++;return new Response(JSON.stringify({path:p}));}});
  for(const route of ['api/profiles','api/profiles/fictional-subject','client/profiles.js','client/kf-state.js'])assert.equal((await handler(new Request(origin+'/ASSC/'+route))).status,401);assert.equal(reads,0);
  const login=await handler(new Request(origin+'/ASSC/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({answer:'fixture-profile'})}));const cookie=login.headers.get('set-cookie').split(';')[0];
  const ok=await handler(new Request(origin+'/ASSC/api/profiles/fictional-subject',{headers:{cookie}}));assert.equal(ok.status,200);assert.equal((await ok.json()).path,'.private/profiles/fictional-subject.json');
  assert.equal((await handler(new Request(origin+'/ASSC/api/profiles/%2e%2e%2fauth',{headers:{cookie}}))).status,404);
});
