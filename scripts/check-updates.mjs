import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateUpdate, createUpdateChecker, readRejectedVersion, FEED_URL, REPOSITORY} from '../native/updates.js';
const hash = 'a'.repeat(64), source = 'b'.repeat(40);
const entry = file_name => ({file_name, file_hash:hash, download_url:`https://raw.githubusercontent.com/${REPOSITORY}/${source}/dist/${file_name}`});
const manifest = ['index.html','burimi.html','native.js','native.css','app.js','update-runtime.json'].map(entry);
for (let page=1;page<=604;page++) manifest.push(entry(`data/${page}.json`),entry(`assets/fonts/p${page}.woff2`));
const feed = {schema:1,nativeVersion:'1.0.2',nativeBuild:'3',source,sequence:2,version:`1.0.2-2-${source}`,manifest};
const runtime = {sequence:1,version:'old'};
const info = {version:'1.0.2',build:'3'};
assert.ok(validateUpdate(feed,info,runtime));
for (const change of [{schema:2},{nativeVersion:'1.0.3'},{nativeBuild:'4'},{sequence:0},{version:'builtin'},{manifest:manifest.slice(1)}]) assert.equal(validateUpdate({...feed,...change},info,runtime),null);
for (const change of [{file_name:'../app.js'},{file_name:'/app.js'},{file_name:'a//b'},{file_name:'a/./b'},{file_hash:'bad'},{download_url:'http://example.com/app.js'},{download_url:`https://github.com/another/repo/releases/download/android-ota/file.js`}]) {
  assert.equal(validateUpdate({...feed,manifest:[{...manifest[0],...change},...manifest.slice(1)]},info,runtime),null);
}
assert.equal(validateUpdate({...feed,manifest:[...manifest,manifest[0]]},info,runtime),null);
function setup(options={}) {
  const calls=[];
  const updater={
    async current(){return {bundle:{version:'old'}};},async getNextBundle(){return null;},async list(){return {bundles:[]};},
    async download(update){calls.push(['download',update]);return {id:'verified-bundle'};},
    async next(value){calls.push(['next',value]);},async delete(value){calls.push(['delete',value]);},...options.updater
  };
  const check=createUpdateChecker({updater,getFeed:options.getFeed||asyncFeed,getNativeInfo:async()=>info,runtime,now:()=>100,...options.checker});
  return {calls,check};
}
async function asyncFeed(){return structuredClone(feed);}
let test=setup();await test.check();assert.deepEqual(test.calls.map(c=>c[0]),['download','next']);
assert.equal(test.calls[0][1].url,FEED_URL);assert.equal(test.calls[0][1].manifest.length,1214);
await test.check();assert.equal(test.calls.length,2,'Repeated foreground checks are throttled.');
test=setup({updater:{download:async()=>{throw Error('Hash mismatch or interrupted download');}}});await test.check();assert.equal(test.calls.length,0,'Unverified files must never be activated.');
for (const updater of [{getNextBundle:async()=>({id:'already-pending'})},{current:async()=>({bundle:{version:feed.version}})}]) {
  test=setup({updater});await test.check();assert.equal(test.calls.length,0);
}
test=setup({checker:{blockedVersion:feed.version}});await test.check();assert.equal(test.calls.length,0,'A bundle rolled back on startup must not be reinstalled.');
test=setup({updater:{list:async()=>({bundles:[{id:'interrupted',version:feed.version,status:'error'}]})}});await test.check();assert.deepEqual(test.calls.map(c=>c[0]),['delete','download','next'],'Interrupted downloads remain retryable.');
const rejected = new Map();
const preferences={async set({key,value}){rejected.set(key,value);},async get({key}){return {value:rejected.get(key)||null};}};
assert.equal(await readRejectedVersion({getFailedUpdate:async()=>({bundle:{version:feed.version}})},preferences),feed.version);
assert.equal(await readRejectedVersion({getFailedUpdate:async()=>null},preferences),feed.version,'A consumed native rollback report must survive the next launch.');
test=setup({updater:{list:async()=>({bundles:[{id:'cached',version:feed.version,status:'pending'}]})}});await test.check();assert.deepEqual(test.calls,[['next',{id:'cached'}]]);
let connected=false;
test=setup({getFeed:async()=>{if(!connected)throw Error('Offline');return feed;}});await test.check();connected=true;await test.check();assert.equal(test.calls.length,2,'An offline launch can retry when online.');
let release;
test=setup({getFeed:()=>new Promise(resolve=>{release=resolve;})});const first=test.check();await test.check();release(feed);await first;assert.equal(test.calls.length,2,'Concurrent checks must stage only one bundle.');
const config=JSON.parse(await readFile(new URL('../capacitor.config.json',import.meta.url)));
assert.equal(config.plugins.CapacitorUpdater.autoUpdate,false);
assert.equal(config.plugins.CapacitorUpdater.statsUrl,'');
assert.ok(config.plugins.CapacitorUpdater.appReadyTimeout>=60000);
console.log('Passed: trusted delta manifests, complete offline Quran, native compatibility, staging without reload, failed downloads, rollback retry avoidance, offline recovery and concurrent checks.');
