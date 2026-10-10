import {groupPageLines} from './reader-core.js';

// Paint the source glyphs with the same page font used by the HTML reader.
export function paintOpeningPage(context, data, font, chapters) {
  const width = 1024, height = 1536;
  context.fillStyle = '#fffaf0'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#a88449'; context.lineWidth = 3;
  for (const inset of [66, 75, 86]) context.strokeRect(inset, 104 + inset / 3, width - inset * 2, height - 230 - inset * 2 / 3);
  for (const x of [86, width - 86]) for (const y of [133, height - 153]) {
    context.save(); context.translate(x, y); context.rotate(Math.PI / 4);
    context.fillStyle = '#fffaf0'; context.fillRect(-18, -18, 36, 36); context.strokeRect(-18, -18, 36, 36); context.restore();
  }
  context.direction = 'rtl'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#756746'; context.font = '30px Uthmani';
  context.fillText('الجزء ١', width / 2, 77);
  const lines = groupPageLines(data, chapters);
  const top = 380, bottom = 1180;
  lines.forEach((line, index) => {
    const y = top + index * (bottom - top) / Math.max(1, lines.length - 1);
    if (line.type === 'surah') {
      context.fillStyle = '#a884491a'; context.fillRect(165, y - 38, 694, 76);
      context.strokeRect(165, y - 38, 694, 76);
      context.fillStyle = '#685b34'; context.font = '49px Uthmani';
      context.fillText('سورة ' + line.chapter.name_arabic, width / 2, y);
    } else if (line.type === 'words') {
      const glyphs = line.words.map(word => word.glyph).join(' ');
      context.font = `88px "${font}"`;
      const size = Math.min(88, 88 * 760 / Math.max(1, context.measureText(glyphs).width));
      context.font = `${size}px "${font}"`; context.fillStyle = '#252e29';
      context.fillText(glyphs, width / 2, y);
    }
  });
  context.fillStyle = '#8b784a'; context.font = '34px Uthmani';
  context.fillText('١', width / 2, height - 83);
}

export function createOpeningPage(data, font, chapters) {
  const page = document.createElement('canvas'); page.width = 1024; page.height = 1536;
  paintOpeningPage(page.getContext('2d'), data, font, chapters);
  return page;
}
