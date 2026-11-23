import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../public/',import.meta.url);
test('manifest installs at public root with standalone display and PNG icons',()=>{
 const m=JSON.parse(readFileSync(new URL('manifest.webmanifest',root)));
 assert.equal(m.start_url,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');
 for(const size of ['192x192','512x512'])assert.ok(m.icons.some(i=>i.sizes===size&&i.type==='image/png'));
 assert.ok(m.icons.some(i=>i.purpose==='maskable'));
});
function worker(fetcher){
 const handlers={},offline=new Response('offline');
 runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),{self:{location:{origin:'https://ligalab.test'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,fetch:fetcher,caches:{match:async()=>offline}});
 return handlers;
}
test('service worker ignores API, writes, assets and external origins',()=>{
 const h=worker(()=>{throw Error('unexpected fetch');});
 for(const [url,method,mode] of [['https://ligalab.test/api/league','GET','navigate'],['https://ligalab.test/api/admin/leagues','POST','cors'],['https://ligalab.test/app.js','GET','cors'],['https://auth.example/','GET','navigate']])h.fetch({request:{url,method,mode},respondWith:()=>assert.fail('Must leave request untouched')});
});
test('navigation uses network, offline failure gets explicit notice',async()=>{
 const request={url:'https://ligalab.test/',method:'GET',mode:'navigate'};
 for(const [fetcher,expected] of [[async()=>new Response('fresh'),'fresh'],[async()=>{throw Error('offline')},'offline']]){
  let response;worker(fetcher).fetch({request,respondWith:r=>response=r});assert.equal(await(await response).text(),expected);
 }
});
