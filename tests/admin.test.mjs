import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog,defaultLeagues,validateLeague,HttpError} from '../lib/catalog.js';
import {createService} from '../lib/api.js';
import {createHandler} from '../api/index.js';
import {zoneProbability} from '../public/zones.js';

test('validates sources, formats and zone ranges before saving',()=>{
 const c=defaultLeagues()[0];assert.equal(validateLeague(c).id,'chile');
 for(const override of [{country:'https://evil.test'},{slug:'../x'},{rounds:3},{ties:['gd','pts','gf']},{zones:[{id:'bad',name:'Bad',from:16,to:17,color:'#000000'}]}])assert.throws(()=>validateLeague({...c,...override}),HttpError);
 assert.throws(()=>validateLeague({...c,zones:[c.zones[0],c.zones[0]]}),/únicos/);
});
test('anonymous admin request cannot write or call provider',async()=>{
 let fetched=false;const service=createService({catalog:createCatalog({url:'https://test.invalid',key:'public',fetcher:()=>{fetched=true;throw Error();}})});
 const r=await service.handle(new Request('https://test/api/admin/leagues',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));assert.equal(r.status,401);assert.equal(fetched,false);
});
test('verified user without admin role is denied',async()=>{
 const catalog=createCatalog({url:'https://test.invalid',key:'public',fetcher:async url=>Response.json(url.endsWith('/user')?{email_confirmed_at:'2026-01-01'}:false)});
 await assert.rejects(catalog.authorize(new Request('https://test',{headers:{Authorization:'Bearer user'}})),e=>e.status===403);
});
test('RLS writes use visitor token and revision filter; conflict never overwrites',async()=>{
 let call;const catalog=createCatalog({url:'https://test.invalid',key:'public',fetcher:async(url,options)=>{call={url,options};return Response.json([]);}});
 await assert.rejects(catalog.save(defaultLeagues()[0],2,'admin-token'),e=>e.status===409);
 assert.match(call.url,/revision=eq.2/);assert.equal(call.options.headers.Authorization,'Bearer admin-token');assert.equal(call.options.method,'PATCH');
});
test('disabled leagues are absent from public catalog',async()=>{
 const all=defaultLeagues();all[1].enabled=false;
 const catalog=createCatalog({url:'https://test.invalid',key:'public',fetcher:async()=>Response.json(all.map(config=>({config})))});
 assert.deepEqual((await catalog.list()).map(c=>c.id),['chile']);
 const service=createService({catalog});assert.equal((await service.handle(new Request('https://test/api/league?league=england'))).status,404);
});
test('routing preserves admin authorization and JSON request body',async()=>{
 const handler=createHandler(async req=>Response.json({path:new URL(req.url).pathname,authorization:req.headers.get('Authorization'),body:await req.json()}));
 const response=await handler(new Request('https://test/api/index?route=admin/leagues',{method:'POST',headers:{Authorization:'Bearer x','Content-Type':'application/json'},body:JSON.stringify({revision:2})}));
 assert.deepEqual(await response.json(),{path:'/api/admin/leagues',authorization:'Bearer x',body:{revision:2}});
});
test('zone probabilities use individual position distributions including overlaps',()=>{
 const positions=[.1,.2,.3,.4];assert.ok(Math.abs(zoneProbability(positions,{from:2,to:3})-.5)<1e-10);assert.equal(zoneProbability(positions,{from:1,to:4}),1);assert.equal(zoneProbability(positions,{from:4,to:4}),.4);
});
test('invalid and non-JSON admin submissions are rejected without persistence',async()=>{
 let saved=false;const catalog={authorize:async()=>({token:'ok'}),save:async()=>{saved=true;}};
 const s=createService({catalog});for(const [body,contentType,status] of [['{}','text/plain',415],['{','application/json',400],[JSON.stringify({config:{}}),'application/json',400]]){
  assert.equal((await s.handle(new Request('https://test/api/admin/leagues',{method:'POST',headers:{'Content-Type':contentType},body}))).status,status);
 }assert.equal(saved,false);
});
