import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const FONT_REVISION = '74eb4e20f4e78cc11c055a3e130136e8dbb7743e';
const cache = new URL(`../.android-cache/fonts-${FONT_REVISION}/`, import.meta.url);
const bundled = new URL('../dist/assets/fonts/', import.meta.url);
export function validFont(bytes) { return bytes.length > 100 && bytes.subarray(0, 4).toString() === 'wOF2' && bytes.readUInt32BE(8) === bytes.length; }

export async function prepareFonts() {
  await mkdir(cache, {recursive: true});
  let next = 1, done = 0;
  async function worker() {
    while (next <= 604) {
      const page = next++, file = new URL(`p${page}.woff2`, cache);
      let bytes;
      try { bytes = await readFile(page <= 32 ? new URL(`p${page}.woff2`, bundled) : file); } catch { /* Download a missing font. */ }
      if (!bytes || !validFont(bytes)) {
        const path = `public/fonts/quran/hafs/v2/woff2/p${page}.woff2`;
        const sources = [
          `https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@${FONT_REVISION}/${path}`,
          `https://raw.githubusercontent.com/quran/quran.com-frontend-next/${FONT_REVISION}/${path}`
        ];
        let error;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const response = await fetch(sources[attempt % 2], {signal: AbortSignal.timeout(30000)});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
            if (!validFont(bytes)) throw new Error('Invalid WOFF2 font');
            await writeFile(new URL(`p${page}.tmp`, cache), bytes);
            await rename(new URL(`p${page}.tmp`, cache), file);
            error = null; break;
          } catch (reason) { error = reason; }
        }
        if (error) throw new Error(`Cannot package Quran font for page ${page}: ${error.message}`);
      } else if (page <= 32) await writeFile(file, bytes);
      done++;
      if (done % 64 === 0 || done === 604) console.log(`Offline Quran fonts: ${done}/604`);
    }
  }
  await Promise.all(Array.from({length: 8}, worker));
  return cache;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareFonts();
