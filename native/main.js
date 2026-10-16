import {Capacitor, SystemBars, SystemBarsStyle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Preferences} from '@capacitor/preferences';
import {createNativeStorage} from './preferences.js';

if (Capacitor.isNativePlatform()) {
  const storage = await createNativeStorage(Preferences, localStorage);
  globalThis.MushafNative = {storage, minimize: () => App.minimizeApp().catch(() => {})};
  document.documentElement.classList.add('native-app');
  document.body.classList.toggle('night', Boolean(storage.get('night', false)));
  const applyBars = () => SystemBars.setStyle({style: document.body.classList.contains('night') ? SystemBarsStyle.Light : SystemBarsStyle.Dark}).catch(() => {});
  await applyBars();
  new MutationObserver(applyBars).observe(document.body, {attributes: true, attributeFilter: ['class']});
  await App.addListener('backButton', ({canGoBack}) => {
    if (document.querySelector('#open-button')) window.dispatchEvent(new Event('mushaf:back'));
    else if (canGoBack) history.back();
    else location.replace('/');
  });
  await App.addListener('appStateChange', ({isActive}) => { if (!isActive) storage.flush(); });
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button > 0) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin === location.origin && anchor.target === '_blank') {
      event.preventDefault(); location.assign(url.pathname + url.search + url.hash);
    } else if (url.protocol === 'https:' && url.origin !== location.origin) {
      event.preventDefault(); Browser.open({url: url.href}).catch(() => {});
    }
  });
}
if (document.querySelector('#open-button')) await import('/app.js');
