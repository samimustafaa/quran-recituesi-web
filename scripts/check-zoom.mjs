import assert from 'node:assert/strict';
import {constrainView, zoomAt} from '../dist/zoom-core.js';
import {createReaderZoom} from '../dist/reader-zoom.js';

const bounds = {width: 320, height: 460, bookWidth: 300, bookHeight: 460};
assert.deepEqual(constrainView({scale: 1, x: 100, y: -100}, bounds), {scale: 1, x: 0, y: 0});
assert.deepEqual(constrainView({scale: 99, x: -9999, y: 9999}, bounds), {scale: 3, x: -290, y: 460});
assert.deepEqual(constrainView({scale: NaN, x: NaN, y: Infinity}, bounds), {scale: 1, x: 0, y: 0});
const old = {scale: 2, x: -25, y: 30}, anchor = {x: 40, y: -50};
const magnified = zoomAt(old, 2.5, anchor, bounds);
assert.equal((anchor.x-old.x)/old.scale, (anchor.x-magnified.x)/magnified.scale);
assert.equal((anchor.y-old.y)/old.scale, (anchor.y-magnified.y)/magnified.scale);

class Element {
  listeners = new Map(); style = {}; attributes = {}; captures = new Set(); disabled = false; textContent = '';
  clientWidth = 320; clientHeight = 460; offsetWidth = 300; offsetHeight = 460;
  classes = new Set();
  classList = {add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)), toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)};
  addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) || []),fn]); }
  emit(type, values = {}) { const event = {type, target: this, button: 0, pointerType: 'touch', preventDefault() { this.prevented = true; }, ...values}; for (const fn of this.listeners.get(type) || []) fn(event); return event; }
  getAttribute(name) { return this.attributes[name]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest() { return null; }
  getBoundingClientRect() { return {left: 0, top: 0, width: this.clientWidth, height: this.clientHeight}; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  click() { if (!this.disabled) this.onclick?.(); }
}
globalThis.window = new Element(); globalThis.document = new Element();
document.querySelector = () => null;
const observers = [];
globalThis.ResizeObserver = class {constructor(fn) { observers.push(fn); } observe() {} };
const frames = new Map(); let id = 0, clock = performance.now();
globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
function settle() { let n = 0; while (frames.size && n++ < 100) { const current = [...frames.values()]; frames.clear(); clock += 16; current.forEach(fn => fn(clock)); } assert.equal(frames.size,0,'Zoom must stop scheduling frames when idle'); }
const viewport = new Element(), content = new Element(), book = new Element();
const minus = new Element(), plus = new Element(), reset = new Element(), hint = new Element();
const motion = new Element(); motion.matches = false;
const swipes = []; let active = true;
const zoom = createReaderZoom({viewport,content,book,minus,plus,reset,hint,reducedMotion: motion,active: () => active,onSwipe: direction => swipes.push(direction)});
assert.equal(reset.textContent,'100%'); assert.ok(minus.disabled);
plus.click(); settle(); assert.equal(reset.textContent,'125%'); assert.ok(viewport.classes.has('zoomed'));
for (let i = 0; i < 12; i++) plus.click(); settle(); assert.equal(reset.textContent,'300%'); assert.ok(plus.disabled);
reset.click(); settle(); assert.equal(reset.textContent,'100%'); assert.ok(!viewport.classes.has('zoomed'));
viewport.emit('pointerdown',{pointerId: 1,clientX: 90,clientY: 200});
window.emit('pointerup',{pointerId: 1,clientX: 170,clientY: 204});
assert.deepEqual(swipes,[1],'Ordinary right swipes must still turn the page forward');
viewport.emit('pointerdown',{pointerId: 2,clientX: 90,clientY: 200});
window.emit('pointercancel',{pointerId: 2,clientX: 190,clientY: 200});
assert.deepEqual(swipes,[1],'Cancelled touches must not turn pages');
viewport.emit('pointerdown',{pointerId: 3,clientX: 110,clientY: 200});
viewport.emit('pointerdown',{pointerId: 4,clientX: 210,clientY: 200});
viewport.emit('pointermove',{pointerId: 4,clientX: 290,clientY: 200});
assert.equal(reset.textContent,'180%');
window.emit('pointerup',{pointerId: 4,clientX: 290,clientY: 200});
window.emit('pointerup',{pointerId: 3,clientX: 110,clientY: 200});
assert.deepEqual(swipes,[1],'A pinch must never become a page swipe');
const beforePan = content.style.transform;
viewport.emit('pointerdown',{pointerId: 5,clientX: 160,clientY: 220});
viewport.emit('pointermove',{pointerId: 5,clientX: 210,clientY: 280});
window.emit('pointerup',{pointerId: 5,clientX: 210,clientY: 280});
assert.notEqual(content.style.transform,beforePan);
assert.deepEqual(swipes,[1],'Dragging an enlarged page must pan it without turning pages');
zoom.pageChanged(); assert.equal(reset.textContent,'180%');
assert.ok(content.style.transform.includes('translate3d(-110.00px,184.00px'),'New pages should open at the top-right reading edge');
viewport.clientWidth = 380; viewport.clientHeight = 540; book.offsetWidth = 360; book.offsetHeight = 540;
observers.forEach(fn => fn()); assert.ok(!content.style.transform.includes('NaN'));
motion.matches = true; reset.click(); assert.equal(frames.size,0); assert.equal(reset.textContent,'100%');
plus.click(); assert.equal(reset.textContent,'125%'); assert.equal(frames.size,0,'Reduced-motion zoom should update immediately');
book.attributes['aria-busy'] = 'true'; plus.click(); assert.equal(reset.textContent,'125%'); delete book.attributes['aria-busy'];
zoom.reset();
const wheel = viewport.emit('wheel',{ctrlKey: true,deltaY: -150,clientX: 190,clientY: 270});
assert.ok(wheel.prevented); assert.ok(Number(reset.textContent.replace('%',''))>100);
zoom.reset(); active = false; plus.click(); assert.equal(reset.textContent,'100%');
console.log('Passed: zoom limits, focal-point preservation, gestures, pan bounds, page changes, resize, reduced motion, busy state and idle animation.');
