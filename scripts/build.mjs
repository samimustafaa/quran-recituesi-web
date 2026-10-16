import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';

// Serve the package's browser ESM entry alongside this buildless HTML site.
const packageRoot = new URL('../node_modules/@vercel/analytics/', import.meta.url);
const assets = new URL('../dist/assets/', import.meta.url);
await mkdir(assets, {recursive: true});
const {version} = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
const sdk = await readFile(new URL('dist/index.mjs', packageRoot), 'utf8');
await writeFile(new URL('vercel-analytics.js', assets),
  `// @vercel/analytics ${version} — MIT. See vercel-analytics.LICENSE.txt.\n` +
  sdk.replace(/^\/\/# sourceMappingURL=.*$/m, '') + '\n');
await copyFile(new URL('LICENSE', packageRoot), new URL('vercel-analytics.LICENSE.txt', assets));
console.log(`Prepared @vercel/analytics ${version} for the browser.`);
