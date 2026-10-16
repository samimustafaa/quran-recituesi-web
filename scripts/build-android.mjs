import {cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {prepareFonts, FONT_REVISION} from './android-fonts.mjs';
import {runtimeMetadata} from './android-update-metadata.mjs';

const root = new URL('../', import.meta.url);
const out = new URL('build/android-web/', root);
await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp(new URL('dist/', root), out, {recursive: true});
const fonts = await prepareFonts();
await cp(fonts, new URL('assets/fonts/', out), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('native/main.js', root))], outfile: fileURLToPath(new URL('native.js', out)), bundle: true, format: 'esm', target: 'chrome109', external: ['/app.js'], minify: true, legalComments: 'eof'});
await cp(new URL('native/native.css', root), new URL('native.css', out));
for (const file of ['index.html', 'burimi.html']) {
  let html = await readFile(new URL(file, out), 'utf8');
  html = html.replace(/<script type="module" src="\/(?:app|analytics)\.js"><\/script>\s*/g, '');
  html = html.replace('<body>', `<body class="app-booting">
<section id="app-loader" class="app-loader" aria-label="Po hapet Mus'haf">
  <img src="/assets/logo.png" width="62" height="126" alt="">
  <h1>Mus'haf<span>.</span></h1>
  <p id="app-loading-message" role="status">Po përgatitet hapësira e leximit…</p>
  <span id="app-loading-spinner" class="app-loading-spinner" aria-hidden="true"></span>
  <button id="app-loading-retry" type="button" hidden>Provo përsëri</button>
</section>`);
  html = html.replace('</head>', '<link rel="stylesheet" href="/native.css">\n</head>');
  html = html.replace('</body>', '<script type="module" src="/native.js"></script>\n</body>');
  await writeFile(new URL(file, out), html);
}
for (const file of ['analytics.js', 'assets/vercel-analytics.js', 'assets/vercel-analytics.LICENSE.txt', 'robots.txt', 'sitemap.xml']) await rm(new URL(file, out), {force: true});
const fontChecksums = {};
for (let page = 1; page <= 604; page++) {
  const bytes = await readFile(new URL(`assets/fonts/p${page}.woff2`, out));
  fontChecksums[page] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(new URL('offline-manifest.json', out), JSON.stringify({pages: 604, fontRevision: FONT_REVISION, fonts: fontChecksums}, null, 2) + '\n');
await writeFile(new URL('update-runtime.json', out), JSON.stringify(await runtimeMetadata()));
console.log('Android bundle ready: 604 Quran pages, 604 local fonts, native controls, no web analytics.');
