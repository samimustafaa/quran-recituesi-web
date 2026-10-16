import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {root, filesIn} from './android-update-metadata.mjs';
import {REPOSITORY, FEED_URL} from '../native/updates.js';
if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/feature/android-app') throw Error('Updates publish only from the Android branch in the project repository.');
const dir = new URL('build/android-update/',root);
const feed = JSON.parse(await readFile(new URL('android-update.json',dir)));
const response = await fetch(FEED_URL, {signal:AbortSignal.timeout(30000),cache:'no-store'});
if (response.ok) {
  const previous = await response.json();
  if (previous.nativeVersion === feed.nativeVersion && previous.nativeBuild === feed.nativeBuild && previous.nativeFingerprint !== feed.nativeFingerprint) throw Error('Native files changed. Increase Android versionName AND versionCode before publishing.');
  if (previous.sequence >= feed.sequence) throw Error('Refusing an older or repeated publication. Re-run the workflow as a new dispatch.');
} else if (response.status !== 404) throw Error(`Cannot read existing update channel: ${response.status}`);
function gh(args) { return execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
try {gh(['release','view','android-ota','--repo',REPOSITORY]);}
catch(error) {
  if (!/not found|404/i.test(String(error.stderr))) throw error;
  gh(['release','create','android-ota','--repo',REPOSITORY,'--target',feed.source,'--title',"Mus'haf Android live updates",'--notes','Automatic web updates for the Android app. Native Android changes require a new APK.','--prerelease','--latest=false']);
}
// Content-addressed assets first; publish the manifest last so readers never see a partial release.
for (const file of (await filesIn(dir)).filter(f=>f!=='android-update.json')) gh(['release','upload','android-ota',fileURLToPath(new URL(file,dir)),'--repo',REPOSITORY,'--clobber']);
gh(['release','upload','android-ota',fileURLToPath(new URL('android-update.json',dir)),'--repo',REPOSITORY,'--clobber']);
console.log(`Published ${feed.version}.`);
