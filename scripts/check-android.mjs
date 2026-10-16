import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createNativeStorage} from '../native/preferences.js';
import {nativeBackAction, resumePage} from '../dist/mobile-core.js';
import {validFont, FONT_REVISION} from './android-fonts.mjs';

const out = new URL('../build/android-web/', import.meta.url);
const original = new URL('../dist/', import.meta.url);
const read = path => readFile(new URL(path, out));
const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
assert.equal(config.appId, 'com.samimustafa.mushaf');
assert.ok(!config.server?.url, 'The Android app must use packaged content, not a remote website.');
assert.equal(config.android.allowMixedContent, false);
const manifest = JSON.parse(await read('offline-manifest.json'));
assert.equal(manifest.fontRevision, FONT_REVISION);
assert.equal(Object.keys(manifest.fonts).length, 604);
for (let page = 1; page <= 604; page++) {
  const data = await read(`data/${page}.json`);
  assert.deepEqual(data, await readFile(new URL(`data/${page}.json`, original)), `Arabic content changed on page ${page}`);
  const font = await read(`assets/fonts/p${page}.woff2`);
  assert.ok(validFont(font), `Invalid local page font ${page}`);
  assert.equal(createHash('sha256').update(font).digest('hex'), manifest.fonts[page]);
}
for (const file of ['index.html', 'burimi.html']) {
  const html = (await read(file)).toString();
  assert.ok(html.includes('<html lang="sq">'));
  assert.equal((html.match(/src="\/native.js"/g) || []).length, 1);
  assert.ok(!html.includes('src="/analytics.js"'));
  assert.ok(html.includes('class="app-booting"'));
  assert.equal((html.match(/id="app-loader"/g) || []).length, 1);
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('id="app-loading-retry"'));
  for (const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"#]+)"/g)) await access(new URL('.' + match[1], out));
}
await assert.rejects(access(new URL('analytics.js', out)));
assert.ok(!(await read('native.js')).toString().includes('from "@capacitor'), 'Native dependencies must be bundled for WebView.');

assert.equal(nativeBackAction({dialogOpen: true, busy: true, readerOpen: true}), 'close-dialog');
assert.equal(nativeBackAction({busy: true, readerOpen: true}), 'wait');
assert.equal(nativeBackAction({opening: true}), 'wait');
assert.equal(nativeBackAction({focus: true, readerOpen: true}), 'leave-focus');
assert.equal(nativeBackAction({readerOpen: true}), 'close-reader');
assert.equal(nativeBackAction({}), 'minimize');
const saved = new Map([['mushaf.lastPage','604'],['mushaf.bookmarks','[1,187,604]'],['mushaf.night','true']]);
const prefs = {async get({key}) {return {value: saved.get(key) ?? null};},async set({key,value}) {saved.set(key,value);}};
const backup = {getItem() {return null;},setItem() {throw Error('Browser storage unavailable');}};
const storage = await createNativeStorage(prefs, backup);
assert.equal(storage.get('lastPage',1),604);
assert.deepEqual(storage.get('bookmarks',[]),[1,187,604]);
assert.equal(storage.get('night',false),true);
storage.set('lastPage',100); storage.set('lastPage',101); await storage.flush();
assert.equal(saved.get('mushaf.lastPage'),'101','Rapid page changes must preserve the newest position.');
const restored = await createNativeStorage(prefs,backup);
assert.equal(restored.get('lastPage',1),101,'Reading progress must restore after a new app session.');
const unavailable = await createNativeStorage({get: async()=>{throw Error('Unavailable');},set:async()=>{throw Error('Unavailable');}}, {getItem:()=>'{broken',setItem(){}});
assert.equal(unavailable.get('lastPage',1),1); unavailable.set('night',true); await unavailable.flush();
assert.equal(unavailable.get('night',false),true);
console.log('Passed: 604 unchanged Quran pages and offline fonts, packaged navigation, native back behavior, saved progress and storage recovery.');

// Cold starts restore real page 1 as well as later pages; first installs stay on the cover.
for (const page of [1, 2, 187, 603, 604]) {
  assert.equal(resumePage({native: true, hash: '', savedPage: page}), page);
}
for (const invalid of [null, undefined, -1, 0, 605, 1.5, '187', {}, NaN]) {
  assert.equal(resumePage({native: true, hash: '', savedPage: invalid}), null);
}
assert.equal(resumePage({native: false, hash: '', savedPage: 187}), null);
assert.equal(resumePage({native: true, hash: '#page=50', savedPage: 187}), 50);
// Two independent phone stores must never overwrite each other's reading position.
const secondSaved = new Map();
const secondPrefs = {async get({key}) {return {value: secondSaved.get(key) ?? null};}, async set({key,value}) {secondSaved.set(key,value);}};
const phone2 = await createNativeStorage(secondPrefs, {getItem:()=>null,setItem(){}});
assert.equal(resumePage({native:true, hash:'', savedPage:phone2.get('lastPage',null)}),null);
phone2.set('lastPage',42); await phone2.flush();
const reopenedPhone2 = await createNativeStorage(secondPrefs, {getItem:()=>null,setItem(){}});
assert.equal(resumePage({native:true, hash:'', savedPage:reopenedPhone2.get('lastPage',null)}),42);
assert.equal(restored.get('lastPage',1),101);
console.log('Passed: automatic cold-start resume, page 1 and 604, first install, invalid data, separate phone progress and loading-screen markup.');
