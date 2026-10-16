import {TOTAL_PAGES, normalizePage, spreadFor, adjacentPage, groupPageLines, pageTurnJourney, journeyTurnDuration} from './reader-core.js';
import {createOpeningPage} from './opening-page.js';
import {surahMeaning, normalizeSearch} from './surah-names.js';
import {storage, isNativeApp} from './platform.js';
import {nativeBackAction, resumePage} from './mobile-core.js';

const $ = selector => document.querySelector(selector);
const media = matchMedia('(max-width: 720px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = {page: 1, open: false, busy: false, chapters: [], index: [], tab: 'surahs', bookmarks: storage.get('bookmarks', []), night: storage.get('night', false), focus: false};
state.bookmarks = Array.isArray(state.bookmarks) ? [...new Set(state.bookmarks.filter(p => Number.isInteger(p) && p >= 1 && p <= TOTAL_PAGES))] : [];
let bookScene, bookScenePromise, metaPromise, toastTimer, pendingJump, renderToken = 0;
const pageCache = new Map();
const fontCache = new Map();
const FONT_REVISION = '74eb4e20f4e78cc11c055a3e130136e8dbb7743e';
const measure = document.createElement('canvas').getContext('2d');

function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2500); }
function fetchJson(url) { return fetch(url).then(r => { if (!r.ok) throw new Error('Nuk u ngarkuan të dhënat e leximit'); return r.json(); }); }
function loadMetadata() {
  if (!metaPromise) metaPromise = Promise.all([fetchJson('/data/chapters.json'), fetchJson('/data/index.json'), getPage(1)]).then(([chapters, index, firstPage]) => { state.chapters = chapters; state.index = index; state.bismillah = firstPage.verses.find(v => v.key === '1:1').text; }).catch(error => { metaPromise = null; throw error; });
  return metaPromise;
}
function getPage(page) {
  if (!pageCache.has(page)) {
    const promise = fetchJson(`/data/${page}.json`).then(data => { if (data.page !== page || !data.verses?.length) throw new Error('Faqe e pavlefshme e Kuranit'); return data; }).catch(error => { pageCache.delete(page); throw error; });
    pageCache.set(page, promise);
  }
  return pageCache.get(page);
}
function getFont(page) {
  if (!fontCache.has(page)) {
    const path = `public/fonts/quran/hafs/v2/woff2/p${page}.woff2`;
    const primary = isNativeApp || page <= 32 ? `/assets/fonts/p${page}.woff2` : `https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@${FONT_REVISION}/${path}`;
    const backup = isNativeApp ? primary : `https://raw.githubusercontent.com/quran/quran.com-frontend-next/${FONT_REVISION}/${path}`;
    const promise = new FontFace(`QuranPage${page}`, `url(${primary})`).load().catch(() => new FontFace(`QuranPage${page}`, `url(${backup})`).load()).then(font => { document.fonts.add(font); return font.family; }).catch(error => { fontCache.delete(page); throw error; });
    fontCache.set(page, promise);
  }
  return fontCache.get(page);
}
async function preparePages(page, mobile = media.matches) {
  await loadMetadata();
  const numbers = spreadFor(page, mobile);
  return Promise.all(numbers.map(async n => {
    if (n === null) return null;
    const [data, font] = await Promise.all([getPage(n), getFont(n)]);
    return {data, font};
  }));
}
async function preparePassingPages(page, mobile = media.matches) {
  return Promise.all(spreadFor(page, mobile).map(async n => n === null ? null : {data: await getPage(n), font: 'Uthmani', unicode: true}));
}
function chapterName(id) { return surahMeaning(id); }
function pageElement(prepared, position) {
  const {data, font} = prepared;
  const article = document.createElement('article');
  article.className = `mushaf-page ${position}-page${data.page <= 2 ? ' opening-page' : ''}`;
  article.setAttribute('lang', 'sq');
  article.setAttribute('aria-label', `Faqja ${data.page} e Kuranit`);
  article.style.setProperty('--page-font', `"${font}"`);
  article.dataset.page = data.page;
  const chaptersOnPage = [...new Set(data.verses.map(v => Number(v.key.split(':')[0])))];
  const top = document.createElement('div'); top.className = 'page-topline'; top.dir = 'rtl'; top.lang = 'ar';
  const surah = document.createElement('span'); surah.textContent = 'سورة ' + (state.chapters.find(c => c.id === chaptersOnPage[0])?.name_arabic || '');
  const juz = document.createElement('span'); juz.textContent = 'الجزء ' + arabicNumber(data.juz);
  top.append(surah, juz);
  const frame = document.createElement('div'); frame.className = 'page-frame'; frame.lang = 'ar';
  const content = document.createElement('div'); content.className = 'quran-lines';
  const lines = groupPageLines(data, state.chapters);
  for (const line of lines) {
    const row = document.createElement('div'); row.className = 'quran-line';
    if (line.type === 'surah') { row.classList.add('surah-heading'); row.textContent = 'سورة ' + line.chapter.name_arabic; }
    else if (line.type === 'bismillah') { row.classList.add('bismillah'); row.textContent = state.bismillah; }
    else {
      if (line.words.length < 5 || data.page <= 2) row.classList.add('centered');
      for (const word of line.words) {
        const span = document.createElement('span'); span.className = 'quran-word'; span.textContent = prepared.unicode ? word.text : word.glyph; span.dataset.text = word.text; span.dataset.verse = word.key; span.setAttribute('aria-label', word.kind === 'end' ? 'الآية ' + word.text : word.text);
        row.append(span);
      }
    }
    content.append(row);
  }
  frame.append(content);
  const bottom = document.createElement('div'); bottom.className = 'page-number'; bottom.lang = 'ar'; bottom.textContent = arabicNumber(data.page);
  article.append(top, frame, bottom);
  return article;
}
function arabicNumber(number) { return String(number).replace(/\d/g, n => '٠١٢٣٤٥٦٧٨٩'[Number(n)]); }
function fitPage(article) {
  const content = article.querySelector('.quran-lines'); if (!content || !measure) return;
  const font = article.style.getPropertyValue('--page-font');
  const width = content.clientWidth;
  if (!width) return;
  measure.font = `32px ${font}`;
  let max = 1;
  article.querySelectorAll('.quran-line').forEach(line => {
    const words = [...line.querySelectorAll('.quran-word')]; if (!words.length) return;
    const naturalWidth = words.reduce((sum, word) => sum + measure.measureText(word.textContent).width, 0) + (words.length - 1) * 4;
    max = Math.max(max, naturalWidth);
  });
  const size = Math.min(width / max * 32 * .96, content.clientHeight / (article.classList.contains('opening-page') ? 8 : 15) * .86);
  article.style.setProperty('--quran-size', `${size.toFixed(2)}px`);
}
function fitAll() { document.querySelectorAll('#mushaf-book > .mushaf-page').forEach(fitPage); }
function installPages(prepared) {
  for (let i = 0; i < 2; i++) {
    const position = i === 0 ? 'left' : 'right';
    const previous = $(`#${position}-page`);
    if (!prepared[i]) { previous.hidden = true; continue; }
    const article = pageElement(prepared[i], position); article.id = position + '-page'; previous.replaceWith(article);
  }
  fitAll();
}
function updateUI({persist = true, prefetch = true} = {}) {
  const [left, right] = spreadFor(state.page, media.matches);
  const info = state.index.find(p => p.page === state.page) || state.index.find(p => p.page === right);
  $('#location-surah').textContent = info ? info.chapters.map(chapterName).join(' · ') : 'Kurani';
  $('#location-juz').textContent = `Xhuzi ${info?.juz || 1} · Mus'hafi i Medinës`;
  $('#page-input').value = state.page;
  $('#page-input').setCustomValidity('');
  $('#page-total').textContent = left === null ? '/ 604' : `· ${right}–${left} / 604`;
  $('#source-page').href = `https://quran.com/page/${state.page}`;
  $('#progress-fill').style.width = `${state.page / TOTAL_PAGES * 100}%`;
  $('#previous-page').disabled = right === 1 || state.busy;
  $('#next-page').disabled = (left || right) >= TOTAL_PAGES || state.busy;
  const saved = state.bookmarks.includes(state.page);
  $('#bookmark-button').setAttribute('aria-pressed', String(saved));
  $('#bookmark-button').setAttribute('aria-label', saved ? 'Hiqe faqen aktuale nga të ruajturat' : 'Ruaj faqen aktuale');
  if (persist) {
    storage.set('lastPage', state.page);
    const url = new URL(location.href); url.hash = `page=${state.page}`;
    history.replaceState(null, '', url);
  }
  const next = adjacentPage(state.page, media.matches, 1);
  if (prefetch && next !== state.page) for (const n of spreadFor(next, media.matches).filter(Boolean)) { getPage(n).catch(() => {}); getFont(n).catch(() => {}); }
}
function showPageError() {
  const page = $('#right-page'); page.replaceChildren();
  const error = document.createElement('div'); error.className = 'page-error';
  const message = document.createElement('p'); message.textContent = 'Kjo faqe nuk u ngarkua. Kontrollo lidhjen me internetin dhe provo përsëri.';
  const retry = document.createElement('button'); retry.textContent = 'Provo përsëri'; retry.onclick = () => goToPage(state.page);
  const source = document.createElement('a'); source.href = `https://quran.com/page/${state.page}`; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Lexoje këtë faqe në Quran.com ↗';
  error.append(message, retry, source); page.append(error); $('#left-page').hidden = true;
}
async function goToPage(page, animate = false, direction = 1) {
  if (state.busy) { if (animate === 'jump') pendingJump = normalizePage(page); return; }
  const token = ++renderToken; state.busy = true; $('#mushaf-book').setAttribute('aria-busy', 'true');
  $('#next-page').disabled = true; $('#previous-page').disabled = true;
  const target = normalizePage(page);
  const mobile = media.matches;
  const journey = animate === 'jump' && !reducedMotion.matches && $('#right-page').querySelector('.quran-lines') ? pageTurnJourney(state.page, target, mobile) : [];
  const travelLabel = $('#travel-label');
  if (journey.length) { travelLabel.textContent = `Po shfletohet drejt faqes ${target}…`; travelLabel.hidden = false; $('#mushaf-book').classList.add('travelling'); }
  try {
    const [prepared, passing] = await Promise.all([
      preparePages(target, mobile),
      Promise.all(journey.slice(0, -1).map(n => preparePassingPages(n, mobile).catch(() => null)))
    ]);
    if (token !== renderToken) return;
    if (journey.length) {
      direction = target > state.page ? 1 : -1;
      for (let i = 0; i < journey.length; i++) {
        if (mobile !== media.matches) break;
        if (i !== journey.length - 1 && !passing[i]) continue;
        const destination = i === journey.length - 1 ? prepared : passing[i];
        await turnLeaf(destination, direction, {duration: journeyTurnDuration(i, journey.length), fast: true});
        installPages(destination); state.page = journey[i]; updateUI({persist: false, prefetch: false});
      }
    } else if (animate === true && mobile === media.matches && !reducedMotion.matches && $('#right-page').querySelector('.quran-lines')) await turnLeaf(prepared, direction);
    installPages(mobile === media.matches ? prepared : await preparePages(target)); state.page = target;
  } catch (error) { state.page = target; showPageError(); toast('Të dhënat e leximit nuk janë të disponueshme. Provo përsëri ose hap Quran.com.'); }
  finally { if (token === renderToken) {
    state.busy = false; $('#mushaf-book').setAttribute('aria-busy', 'false'); $('#mushaf-book').classList.remove('travelling'); travelLabel.hidden = true; updateUI();
    if (pendingJump !== undefined) { const next = pendingJump; pendingJump = undefined; queueMicrotask(() => goToPage(next, 'jump')); }
  } }
}
async function turnLeaf(prepared, direction, {duration = media.matches ? 530 : 720, fast = false} = {}) {
  const leaf = $('#turning-leaf');
  const forward = direction > 0;
  leaf.classList.toggle('backward', !forward);
  const front = leaf.querySelector('.leaf-front'); const back = leaf.querySelector('.leaf-back');
  const source = $(media.matches ? '#right-page' : forward ? '#left-page' : '#right-page');
  const clone = source.cloneNode(true); clone.removeAttribute('id'); clone.hidden = false;
  front.replaceChildren(clone);
  const next = pageElement(media.matches ? prepared[1] : forward ? prepared[1] : prepared[0], forward ? 'right' : 'left');
  back.replaceChildren(next); leaf.style.visibility = 'visible'; fitPage(next);
  if (!media.matches) {
    const underPosition = forward ? 'left' : 'right';
    const underneath = pageElement(forward ? prepared[0] : prepared[1], underPosition);
    underneath.id = underPosition + '-page'; $(`#${underPosition}-page`).replaceWith(underneath); fitPage(underneath);
  }
  const sign = forward ? 1 : -1;
  const animation = leaf.animate([{transform: 'rotateY(0deg)', filter: 'brightness(1)'}, {transform: `rotateY(${sign * 70}deg)`, filter: fast ? 'brightness(.92) blur(.6px)' : 'brightness(.92)', offset:.42}, {transform: `rotateY(${sign * 180}deg)`, filter: 'brightness(1)'}], {duration, easing: fast ? 'cubic-bezier(.2,.05,.3,1)' : 'cubic-bezier(.3,.05,.2,1)', fill:'forwards'});
  try { await animation.finished; } catch { /* A resize or motion preference can end a transition. */ }
  leaf.style.visibility = 'hidden'; animation.cancel(); front.replaceChildren(); back.replaceChildren();
}
async function openBook(page = 1, animate = true) {
  if (state.opening) return;
  if (state.open) { await goToPage(page, 'jump'); return; }
  const target = normalizePage(page);
  const startPage = animate && !reducedMotion.matches ? 1 : target;
  const initialPages = preparePages(startPage).catch(() => null);
  preparePages(target).catch(() => {});
  state.opening = true; state.open = true;
  $('#open-button').disabled = true; $('#book-stage').setAttribute('aria-busy','true');
  const caption = $('#book-caption-label'); caption.textContent = 'PO HAPET KURANI';
  try {
    const [prepared] = await Promise.all([initialPages,animate ? bookScenePromise : null]);
    if (animate && !reducedMotion.matches) {
      if (bookScene && $('#book-canvas').classList.contains('ready')) await bookScene.open();
      else if (prepared?.[1]) {
        await document.fonts.load('49px Uthmani');
        const pageCanvas = createOpeningPage(prepared[1].data,prepared[1].font,state.chapters);pageCanvas.className='fallback-page';
        $('#fallback-book').append(pageCanvas); $('#fallback-book').classList.add('opening');
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      await new Promise(resolve=>setTimeout(resolve,550));
    }
    // Prepare real reading pages before revealing the reader, avoiding a blank handoff.
    await goToPage(startPage);
    if (animate && !reducedMotion.matches) {
      const fade = $('#landing').animate([{opacity:1},{opacity:0}],{duration:280,easing:'ease-in',fill:'forwards'});
      try { await fade.finished; } catch { /* Continue if the animation is interrupted. */ }
      fade.cancel();
    }
  } catch { toast('Po hapet hapësira e leximit…'); }
  finally { state.opening = false; $('#open-button').disabled = false; $('#book-stage').setAttribute('aria-busy','false');caption.textContent = 'PREK PËR TA HAPUR'; }
  $('#landing').hidden = true; $('#reader').hidden = false; document.body.classList.add('reader-visible');
  if (!$('#right-page').querySelector('.quran-lines') && !$('#right-page').querySelector('.page-error')) await goToPage(startPage);
  fitAll();
  window.scrollTo({top:0, behavior:'instant'});
  if (startPage !== target) await goToPage(target, 'jump');
  $('#close-book').focus({preventScroll:true});
}
function closeBook() {
  if (state.busy || state.opening) return;
  state.open = false; $('#reader').hidden = true; $('#landing').hidden = false; document.body.classList.remove('reader-visible', 'focus'); state.focus = false;
  $('#focus-button').setAttribute('aria-pressed','false'); if (bookScene) bookScene.close();
  $('#fallback-book').classList.remove('opening'); $('#fallback-book').querySelector('.fallback-page')?.remove();
  history.replaceState(null, '', location.pathname + location.search);
  showResume(); $('#open-button').focus({preventScroll:true}); window.scrollTo({top:0, behavior:'instant'});
}
function showResume() { const p = normalizePage(storage.get('lastPage',1)); $('#resume-button').hidden = p <= 1; $('#resume-page').textContent = `· Faqja ${p}`; }
async function showNavigation(tab = 'surahs') {
  state.tab = tab; $('#surah-search').value = ''; $('#navigation-dialog').showModal();
  $('#navigation-list').textContent = 'Po ngarkohet përmbajtja e Kuranit…';
  try { await loadMetadata(); renderNavigation(); } catch { const button = document.createElement('button'); button.className = 'empty-list'; button.textContent = 'Përmbajtja nuk u ngarkua. Prek për të provuar përsëri.'; button.onclick = async () => { await loadMetadata(); renderNavigation(); }; $('#navigation-list').replaceChildren(button); }
}
function renderNavigation() {
  document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === state.tab)));
  const search = $('#surah-search'); search.hidden = state.tab !== 'surahs'; search.closest('label').hidden = state.tab !== 'surahs';
  const list = $('#navigation-list'); list.replaceChildren();
  const query = normalizeSearch(search.value.trim());
  if (state.tab === 'surahs') {
    const chapters = state.chapters.filter(c => [c.name_simple, c.name_arabic, surahMeaning(c.id), String(c.id)].some(t => normalizeSearch(t).includes(query)));
    for (const chapter of chapters) list.append(navigationRow(chapter.id, surahMeaning(chapter.id), `${chapter.name_simple} · ${chapter.verses_count} ajete`, chapter.name_arabic, chapter.pages[0]));
    if (!chapters.length) emptyNavigation('Nuk u gjet asnjë sure për këtë kërkim.');
  } else if (state.tab === 'juz') {
    for (let juz = 1; juz <= 30; juz++) { const info = state.index.find(p => p.juz === juz); if (info) list.append(navigationRow(juz, `Xhuzi ${juz}`, `${chapterName(info.chapters[0])} · fillon te ajeti ${info.first}`, 'الجزء ' + arabicNumber(juz), info.page)); }
  } else {
    for (const page of [...state.bookmarks].sort((a,b) => a-b)) {
      const info = state.index[page-1]; const wrapper = document.createElement('div'); wrapper.className = 'bookmark-row';
      const row = navigationRow(page, info.chapters.map(chapterName).join(' · '), `Faqja ${page} · Xhuzi ${info.juz}`, '', page);
      const remove = document.createElement('button'); remove.className = 'remove-bookmark'; remove.textContent = '×'; remove.setAttribute('aria-label', `Hiqe faqen ${page} nga të ruajturat`); remove.onclick = () => { state.bookmarks = state.bookmarks.filter(n => n !== page); storage.set('bookmarks', state.bookmarks); renderNavigation(); if (state.open) updateUI(); };
      wrapper.append(row, remove); list.append(wrapper);
    }
    if (!state.bookmarks.length) emptyNavigation('Faqet e ruajtura do të shfaqen këtu.\nGjatë leximit, prek shenjën e ruajtjes për të ruajtur faqen.');
  }
}
function emptyNavigation(message) { const div = document.createElement('div'); div.className = 'empty-list'; div.textContent = message; $('#navigation-list').append(div); }
function navigationRow(number, title, subtitle, arabic, page) {
  const button = document.createElement('button'); button.className = 'surah-row';
  const n = document.createElement('span'); n.className = 'row-number'; n.textContent = number;
  const label = document.createElement('span'); label.className = 'row-label'; const strong = document.createElement('strong'); strong.textContent = title; const small = document.createElement('small'); small.textContent = subtitle; label.append(strong, small);
  const ar = document.createElement('span'); ar.className = 'row-arabic'; ar.lang = 'ar'; ar.textContent = arabic;
  const p = document.createElement('span'); p.className = 'row-page'; p.textContent = 'f. ' + page;
  button.append(n, label, ar, p); button.onclick = () => { $('#navigation-dialog').close(); openBook(page, !state.open); };
  return button;
}
function step(direction) { if (!state.open || state.busy || state.opening) return; const next = adjacentPage(state.page,media.matches,direction); const currentSpread = spreadFor(state.page,media.matches)[1]; if (spreadFor(next,media.matches)[1] === currentSpread || (direction < 0 && currentSpread === 1)) return; goToPage(next,true,direction); }
$('#open-button').onclick = () => openBook(1);
$('#fallback-book').onclick = () => openBook(1);
$('#book-canvas').onclick = () => openBook(1);
$('#book-canvas').onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBook(1); } };
$('#resume-button').onclick = () => openBook(normalizePage(storage.get('lastPage',1)));
$('#close-book').onclick = closeBook;
$('#explore-button').onclick = () => showNavigation(); $('#contents-button').onclick = () => showNavigation();
$('#next-page').onclick = () => step(1); $('#previous-page').onclick = () => step(-1);
$('#page-form').onsubmit = event => { event.preventDefault(); if ($('#page-form').reportValidity()) goToPage($('#page-input').value, 'jump'); };
$('#page-input').oninvalid = () => $('#page-input').setCustomValidity('Shkruaj një numër të plotë të faqes nga 1 deri në 604.');
$('#page-input').oninput = () => $('#page-input').setCustomValidity('');
$('#bookmark-button').onclick = () => { if (state.busy) return; const saved = state.bookmarks.includes(state.page); state.bookmarks = saved ? state.bookmarks.filter(n => n !== state.page) : [...state.bookmarks,state.page]; storage.set('bookmarks', state.bookmarks); updateUI(); toast(saved ? 'Faqja u hoq nga të ruajturat' : `Faqja ${state.page} u ruajt`); };
$('#theme-button').onclick = () => { state.night = !state.night; storage.set('night',state.night); applyTheme(); };
function applyTheme() { document.body.classList.toggle('night',Boolean(state.night)); $('#theme-button').setAttribute('aria-pressed',String(Boolean(state.night))); $('#theme-button').setAttribute('aria-label',state.night ? 'Kalo në pamjen e letrës së çelët' : 'Kalo në leximin e natës'); }
$('#focus-button').onclick = () => { state.focus = !state.focus; document.body.classList.toggle('focus',state.focus); $('#focus-button').setAttribute('aria-pressed',String(state.focus)); $('#focus-button').setAttribute('aria-label',state.focus ? 'Çaktivizo leximin pa shpërqendrime' : 'Aktivizo leximin pa shpërqendrime'); requestAnimationFrame(fitAll); };
document.querySelectorAll('.about-trigger').forEach(button => button.onclick = () => $('#about-dialog').showModal());
document.querySelectorAll('.dialog-close').forEach(button => button.onclick = () => button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); }));
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { state.tab = button.dataset.tab; renderNavigation(); });
$('.tab-list').addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; const tabs = [...document.querySelectorAll('[data-tab]')]; const current = tabs.indexOf(document.activeElement); if (current < 0) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); });
$('#surah-search').oninput = renderNavigation;
$('.brand').onclick = event => { event.preventDefault(); if (state.open) closeBook(); else window.scrollTo({top:0,behavior:'smooth'}); };
let touchStart;
$('#mushaf-book').addEventListener('touchstart', event => { if (event.touches.length === 1) touchStart = {x:event.touches[0].clientX,y:event.touches[0].clientY}; }, {passive:true});
$('#mushaf-book').addEventListener('touchend', event => { if (!touchStart || !event.changedTouches.length) return; const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y; if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4) step(dx>0?1:-1); touchStart=null; }, {passive:true});
document.addEventListener('keydown',event => { if (!state.open || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return; if (event.key==='ArrowLeft') { event.preventDefault(); step(1); } if (event.key==='ArrowRight') { event.preventDefault(); step(-1); } if (event.key==='Escape' && state.focus) $('#focus-button').click(); });
document.addEventListener('copy',event => { const selection = getSelection(); if (!selection?.rangeCount || selection.isCollapsed || !$('#mushaf-book').contains(selection.anchorNode)) return; const fragment = selection.getRangeAt(0).cloneContents(); const words=[...fragment.querySelectorAll('[data-text]')]; if (!words.length) { const anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement; const word = anchor?.closest('.quran-word'); if(word) words.push(word); } if (words.length && event.clipboardData) { event.clipboardData.setData('text/plain',words.map(w=>w.dataset.text).join(' ')); event.preventDefault(); } });
let mouseStart;
$('#mushaf-book').addEventListener('pointerdown', event => { if (event.pointerType === 'mouse' && !event.target.closest('.quran-word')) mouseStart = {x:event.clientX,y:event.clientY}; });
window.addEventListener('pointerup', event => { if (!mouseStart) return; const dx=event.clientX-mouseStart.x,dy=event.clientY-mouseStart.y; if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.4) step(dx>0?1:-1); mouseStart=null; });
const resizeObserver = new ResizeObserver(() => { if (state.open && !state.busy) fitAll(); }); resizeObserver.observe($('#mushaf-book'));
media.addEventListener('change', () => { if (state.open && !state.opening) { if (state.busy) setTimeout(() => goToPage(state.page),800); else goToPage(state.page); } });
window.addEventListener('hashchange', () => { const match=location.hash.match(/^#page=(\d+)$/); if(match) openBook(normalizePage(match[1]),false); });
window.addEventListener('mushaf:back', () => {
  const dialog = document.querySelector('dialog[open]');
  const action = nativeBackAction({dialogOpen: Boolean(dialog), busy: state.busy, opening: state.opening, focus: state.focus, readerOpen: state.open});
  if (action === 'close-dialog') dialog.close();
  if (action === 'leave-focus') $('#focus-button').click();
  if (action === 'close-reader') closeBook();
  if (action === 'minimize') globalThis.MushafNative?.minimize();
});
showResume(); applyTheme();
loadMetadata().catch(() => {});
getPage(1).catch(() => {}); getPage(2).catch(() => {}); getFont(1).catch(() => {}); getFont(2).catch(() => {});
const initialPage = resumePage({native: isNativeApp, hash: location.hash, savedPage: storage.get('lastPage', null)});
export const readerReady = initialPage !== null ? openBook(initialPage, false) : Promise.resolve();
if (initialPage === null) bookScenePromise = import('./book-scene.js').then(async ({createBookScene}) => {
  const pages = await preparePages(1,true);
  const firstPage = {...pages[1],chapters:state.chapters};
  bookScene = await createBookScene($('#book-canvas'),reducedMotion.matches,firstPage);
}).catch(() => { /* The original illustrated cover remains a fully functional fallback. */ });
