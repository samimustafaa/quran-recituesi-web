import {MIN_ZOOM, MAX_ZOOM, constrainView, zoomAt} from './zoom-core.js';

export function createReaderZoom({viewport, content, book, minus, plus, reset, hint, reducedMotion, active, onSwipe}) {
  let view = {scale: 1, x: 0, y: 0}, target = {...view}, frame = 0, lastTime = 0;
  let gesture, mixedGesture = false;
  const pointers = new Map();
  const box = () => ({width: viewport.clientWidth, height: viewport.clientHeight, bookWidth: book.offsetWidth, bookHeight: book.offsetHeight});
  const busy = () => !active() || book.getAttribute('aria-busy') === 'true';
  const enlarged = () => Math.max(view.scale, target.scale) > 1.005;
  function updateControls() {
    const percentage = Math.round(target.scale * 100);
    reset.textContent = `${percentage}%`;
    reset.setAttribute('aria-label', `Zmadhimi ${percentage}%. Rikthe madhësinë fillestare`);
    minus.disabled = target.scale <= MIN_ZOOM;
    plus.disabled = target.scale >= MAX_ZOOM;
    hint.textContent = enlarged() ? 'Tërhiq faqen për ta lëvizur · Prek përqindjen për ta rikthyer' : 'Zmadho për lexim më të qartë';
  }
  function paint() {
    // Keep resting text on a 2D transform; only active motion requests a compositor layer.
    content.style.transform = `translate(${view.x.toFixed(2)}px,${view.y.toFixed(2)}px) scale(${view.scale.toFixed(4)})`;
    viewport.classList.toggle('zoomed', enlarged());
  }
  function tick(time) {
    frame = 0;
    const amount = 1 - Math.exp(-Math.min(64, time - lastTime) / 45); lastTime = time;
    for (const key of ['scale', 'x', 'y']) view[key] += (target[key] - view[key]) * amount;
    const done = Math.abs(view.scale-target.scale) < .001 && Math.abs(view.x-target.x) < .08 && Math.abs(view.y-target.y) < .08;
    if (done) view = {...target};
    paint();
    if (!done) frame = requestAnimationFrame(tick);
    else { viewport.classList.remove('zoom-moving'); updateControls(); }
  }
  function setView(next, smooth = true) {
    target = constrainView(next, box());
    updateControls();
    if (!smooth || reducedMotion.matches) {
      cancelAnimationFrame(frame); frame = 0; view = {...target}; paint();
      viewport.classList.remove('zoom-moving');
    } else if (!frame) {
      viewport.classList.add('zoom-moving'); lastTime = performance.now(); frame = requestAnimationFrame(tick);
    }
  }
  function changeZoom(scale, anchor = {x: 0, y: 0}) {
    if (busy()) return;
    const first = target.scale === 1 && scale > 1;
    const next = zoomAt(target, scale, anchor, box());
    setView(first && anchor.x === 0 && anchor.y === 0 ? startFor(next.scale) : next);
  }
  function startFor(scale) {
    const b = box();
    return constrainView({scale, x: -(b.bookWidth*scale-b.width)/2, y: (b.bookHeight*scale-b.height)/2}, b);
  }
  function point(event) { return {x: event.clientX, y: event.clientY}; }
  function relative(point) { const r = viewport.getBoundingClientRect(); return {x: point.x-r.left-r.width/2, y: point.y-r.top-r.height/2}; }
  function beginGesture() {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      mixedGesture = true;
      const center = {x: (points[0].x+points[1].x)/2, y: (points[0].y+points[1].y)/2};
      const anchor = relative(center);
      gesture = {kind: 'pinch', distance: Math.max(1, Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)), view: {...view}, world: {x: (anchor.x-view.x)/view.scale, y: (anchor.y-view.y)/view.scale}};
    } else if (points.length) gesture = {kind: enlarged() ? 'pan' : 'swipe', point: {...points[0]}, view: {...view}};
    viewport.classList.toggle('zoom-dragging', enlarged() && points.length > 0);
  }
  viewport.addEventListener('pointerdown', event => {
    if (busy() || (event.pointerType === 'mouse' && (event.button !== 0 || (!enlarged() && event.target.closest('.quran-word'))))) return;
    if (!pointers.size) mixedGesture = false;
    if (enlarged()) { setView(view, false); viewport.setPointerCapture(event.pointerId); }
    pointers.set(event.pointerId, point(event)); beginGesture();
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture || busy()) return;
    pointers.set(event.pointerId, point(event));
    if (gesture.kind === 'pinch') {
      const p = [...pointers.values()]; if (p.length < 2) return;
      const anchor = relative({x: (p[0].x+p[1].x)/2, y: (p[0].y+p[1].y)/2});
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gesture.view.scale*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/gesture.distance));
      viewport.classList.add('zoom-dragging');
      setView({scale, x: anchor.x-gesture.world.x*scale, y: anchor.y-gesture.world.y*scale}, false);
    } else if (gesture.kind === 'pan') {
      setView({...gesture.view, x: gesture.view.x+event.clientX-gesture.point.x, y: gesture.view.y+event.clientY-gesture.point.y}, false);
    }
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const swipe = gesture?.kind === 'swipe' && !mixedGesture && event.type === 'pointerup' && !busy();
    const dx = swipe ? event.clientX-gesture.point.x : 0, dy = swipe ? event.clientY-gesture.point.y : 0;
    pointers.delete(event.pointerId);
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (swipe && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)*1.4) onSwipe(dx > 0 ? 1 : -1);
    if (pointers.size) beginGesture();
    else { gesture = undefined; viewport.classList.remove('zoom-dragging'); }
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('touchmove', event => { if (event.touches.length > 1 || enlarged()) event.preventDefault(); }, {passive: false});
  viewport.addEventListener('wheel', event => {
    if (busy()) return;
    if (event.ctrlKey) {
      event.preventDefault(); changeZoom(target.scale*Math.exp(-event.deltaY*.002),relative(point(event)));
    } else if (enlarged()) {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const next = constrainView({...target, x: target.x-(event.shiftKey ? event.deltaY : event.deltaX)*unit, y: target.y-(event.shiftKey ? 0 : event.deltaY)*unit},box());
      if (next.x !== target.x || next.y !== target.y) { event.preventDefault(); setView(next); }
    }
  }, {passive: false});
  minus.onclick = () => changeZoom(target.scale-.25);
  plus.onclick = () => changeZoom(target.scale+.25);
  function resetView(smooth = true) {
    for (const id of pointers.keys()) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
    pointers.clear(); gesture = undefined; viewport.classList.remove('zoom-dragging');
    setView({scale: 1, x: 0, y: 0},smooth);
  }
  reset.onclick = () => resetView();
  window.addEventListener('blur', () => {
    for (const id of pointers.keys()) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
    pointers.clear(); gesture = undefined; viewport.classList.remove('zoom-dragging');
  });
  document.addEventListener('keydown', event => {
    if (busy() || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); plus.click(); }
    if (event.key === '-') { event.preventDefault(); minus.click(); }
    if (event.key === '0') { event.preventDefault(); reset.click(); }
  });
  new ResizeObserver(() => { if (viewport.clientWidth && viewport.clientHeight) setView(target,false); }).observe(viewport);
  reducedMotion.addEventListener('change', () => setView(target,false));
  updateControls(); paint();
  return {
    reset() { resetView(false); },
    pageChanged() { if (enlarged() && viewport.clientWidth) setView(startFor(target.scale),false); }
  };
}
