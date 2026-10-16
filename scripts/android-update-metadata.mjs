import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const root = new URL('../', import.meta.url);
export async function runtimeMetadata() {
  const gradle = await readFile(new URL('android/app/build.gradle', root), 'utf8');
  const nativeVersion = gradle.match(/versionName "([^"]+)"/)[1];
  const nativeBuild = gradle.match(/versionCode (\d+)/)[1];
  const source = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: fileURLToPath(root), encoding: 'utf8'}).trim();
  const sequence = Number(process.env.GITHUB_RUN_NUMBER || 0);
  if (!/^[a-f0-9]{40}$/.test(source) || !Number.isSafeInteger(sequence)) throw Error('Invalid build identity');
  const hash = createHash('sha256');
  const files = execFileSync('git', ['ls-files', 'android'], {cwd: fileURLToPath(root), encoding: 'utf8'}).trim().split('\n').filter(Boolean);
  files.push('capacitor.config.json');
  for (const file of files.sort()) hash.update(file).update(await readFile(new URL(file, root)));
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root)));
  for (const [path, pkg] of Object.entries(lock.packages).sort()) {
    if (/^node_modules\/(?:@capacitor\/|@capgo\/)/.test(path)) hash.update(path).update(pkg.version || '');
  }
  return {nativeVersion, nativeBuild, nativeFingerprint: hash.digest('hex'), source, sequence, version: `${nativeVersion}-${sequence}-${source}`};
}
export async function filesIn(url, prefix = '') {
  const result = [];
  for (const entry of await readdir(url, {withFileTypes: true})) {
    if (entry.isDirectory()) result.push(...await filesIn(new URL(entry.name + '/', url), prefix + entry.name + '/'));
    else if (entry.isFile()) result.push(prefix + entry.name);
  }
  return result.sort();
}
