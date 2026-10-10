export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, limit) => Math.min(limit, Math.max(-limit, finite(value))) || 0;

export function constrainView(view, box) {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(view.scale, 1)));
  const limitX = Math.max(0, (box.bookWidth * scale - box.width) / 2);
  const limitY = Math.max(0, (box.bookHeight * scale - box.height) / 2);
  return {scale, x: clamp(view.x, limitX), y: clamp(view.y, limitY)};
}

export function zoomAt(view, scale, anchor, box) {
  const next = constrainView({scale, x: 0, y: 0}, box).scale;
  const ratio = next / view.scale;
  return constrainView({scale: next, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio}, box);
}

