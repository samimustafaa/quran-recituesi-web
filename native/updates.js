export const REPOSITORY = 'samimustafaa/quran-recituesi-web';
export const FEED_URL = `https://github.com/${REPOSITORY}/releases/download/android-ota/android-update.json`;
const RELEASE_ROOT = `https://github.com/${REPOSITORY}/releases/download/android-ota/`;
const RAW_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}/`;
const FONT_ROOT = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@74eb4e20f4e78cc11c055a3e130136e8dbb7743e/public/fonts/quran/hafs/v2/woff2/';

export function validateUpdate(feed, nativeInfo, runtime) {
  if (!feed || feed.schema !== 1 || feed.nativeVersion !== nativeInfo.version || feed.nativeBuild !== nativeInfo.build) return null;
  if (!Number.isSafeInteger(feed.sequence) || feed.sequence <= runtime.sequence || feed.version === runtime.version) return null;
  if (!/^[a-f0-9]{40}$/.test(feed.source) || feed.version !== `${feed.nativeVersion}-${feed.sequence}-${feed.source}`) return null;
  if (!Array.isArray(feed.manifest) || feed.manifest.length > 3000) return null;
  const paths = new Set();
  for (const entry of feed.manifest) {
    const path = entry?.file_name;
    if (typeof path !== 'string' || !/^[\w./-]+$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..') || paths.has(path)) return null;
    if (!/^[a-f0-9]{64}$/.test(entry.file_hash)) return null;
    const url = entry.download_url;
    if (typeof url !== 'string') return null;
    const trusted = url.startsWith(RELEASE_ROOT) || new RegExp(`^${RAW_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-f0-9]{40}/(?:dist|native)/`).test(url) || (url.startsWith(FONT_ROOT) && /^p\d+\.woff2$/.test(url.slice(FONT_ROOT.length)));
    if (!trusted || new URL(url).protocol !== 'https:' || url.includes('?') || url.includes('#') || url.split('/').includes('..')) return null;
    paths.add(path);
  }
  for (const path of ['index.html', 'burimi.html', 'native.js', 'native.css', 'app.js', 'update-runtime.json']) if (!paths.has(path)) return null;
  for (let page = 1; page <= 604; page++) if (!paths.has(`data/${page}.json`) || !paths.has(`assets/fonts/p${page}.woff2`)) return null;
  return {url: FEED_URL, version: feed.version, manifest: feed.manifest};
}

// No reload/set calls: stage verified files while the current reader stays open.
export async function readRejectedVersion(updater, preferences) {
  const failed = await updater.getFailedUpdate();
  const key = 'mushaf.rejectedUpdate';
  if (failed?.bundle?.version) {
    try { await preferences.set({key, value:failed.bundle.version}); } catch { /* Still block it in this session. */ }
    return failed.bundle.version;
  }
  try { return (await preferences.get({key})).value; } catch { return null; }
}

export function createUpdateChecker({updater, getFeed, getNativeInfo, runtime, blockedVersion, now = Date.now}) {
  let running = false, lastCheck = -Infinity;
  return async function check() {
    if (running || now() - lastCheck < 60 * 60 * 1000) return;
    running = true;
    lastCheck = now();
    try {
      const [feed, info, current, pending, list] = await Promise.all([
        getFeed(), getNativeInfo(), updater.current(), updater.getNextBundle(), updater.list()
      ]);
      const update = validateUpdate(feed, info, runtime);
      if (!update || current.bundle.version === update.version || pending || blockedVersion === update.version) return;
      // A download error is retryable; a startup rollback is blocked above.
      for (const bundle of list.bundles.filter(b => b.version === update.version && b.status === 'error')) await updater.delete({id:bundle.id});
      const existing = list.bundles.find(b => b.version === update.version && ['pending', 'success'].includes(b.status));
      const bundle = existing || await updater.download(update);
      await updater.next({id: bundle.id});
    } catch {
      // A later foreground/online event can retry after connectivity returns.
      lastCheck = -Infinity;
    }
    finally { running = false; }
  };
}
