import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {root, filesIn} from './android-update-metadata.mjs';
import {FONT_REVISION} from './android-fonts.mjs';
import {REPOSITORY, validateUpdate} from '../native/updates.js';
const web = new URL('build/android-web/', root);
const output = new URL('build/android-update/', root);
const runtime = JSON.parse(await readFile(new URL('update-runtime.json', web)));
const releaseRoot = `https://github.com/${REPOSITORY}/releases/download/android-ota/`;
const rawRoot = `https://raw.githubusercontent.com/${REPOSITORY}/${runtime.source}/`;
await rm(output, {recursive:true,force:true}); await mkdir(output, {recursive:true});
const manifest = [];
for (const file of await filesIn(web)) {
  const bytes = await readFile(new URL(file, web));
  const hash = createHash('sha256').update(bytes).digest('hex');
  let url;
  try {
    if (bytes.equals(await readFile(new URL('dist/' + file, root)))) url = rawRoot + 'dist/' + file;
  } catch { /* Generated files and the remaining local fonts need another source. */ }
  if (!url && /^assets\/fonts\/p\d+\.woff2$/.test(file)) url = `https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@${FONT_REVISION}/public/fonts/quran/hafs/v2/woff2/${file.split('/').at(-1)}`;
  if (!url && file === 'native.css') url = rawRoot + 'native/native.css';
  if (!url) {
    const asset = `file-${hash}.${file.split('.').at(-1)}`;
    await writeFile(new URL(asset, output), bytes);
    url = releaseRoot + asset;
  }
  manifest.push({file_name:file, file_hash:hash, download_url:url});
}
const feed = {schema:1, ...runtime, manifest};
if (!validateUpdate(feed, {version:runtime.nativeVersion,build:runtime.nativeBuild}, {version:'old',sequence:-1})) throw Error('Generated update manifest is invalid');
await writeFile(new URL('android-update.json', output), JSON.stringify(feed));
console.log(`Prepared delta update: ${manifest.length} verified files; ${ (await filesIn(output)).length - 1} generated assets. Unchanged APK files are reused locally.`);
