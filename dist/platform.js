export const isNativeApp = Boolean(globalThis.MushafNative);
export const storage = globalThis.MushafNative?.storage || {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('mushaf.' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('mushaf.' + key, JSON.stringify(value)); }
    catch { /* Reading remains available without persistent storage. */ }
  }
};
