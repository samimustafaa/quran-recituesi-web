const KEYS = ['lastPage', 'bookmarks', 'night'];
export async function createNativeStorage(preferences, browserStorage) {
  const values = new Map();
  await Promise.all(KEYS.map(async key => {
    const name = 'mushaf.' + key;
    let raw;
    try { raw = (await preferences.get({key: name})).value; } catch { /* Use the browser backup. */ }
    if (raw == null) { try { raw = browserStorage.getItem(name); } catch { /* Storage can be unavailable. */ } }
    try { if (raw != null) values.set(key, JSON.parse(raw)); } catch { /* Ignore invalid saved settings. */ }
  }));
  let writes = Promise.resolve();
  return {
    get(key, fallback) { return values.get(key) ?? fallback; },
    set(key, value) {
      if (!KEYS.includes(key)) return;
      values.set(key, value);
      const name = 'mushaf.' + key, raw = JSON.stringify(value);
      try { browserStorage.setItem(name, raw); } catch { /* Native preferences remain available. */ }
      writes = writes.then(() => preferences.set({key: name, value: raw})).catch(() => {});
    },
    flush() { return writes; }
  };
}
