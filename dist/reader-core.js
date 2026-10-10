export const TOTAL_PAGES = 604;
export function normalizePage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(TOTAL_PAGES, Math.max(1, Math.floor(number))) : 1;
}
export function spreadFor(page, mobile) {
  const p = normalizePage(page);
  if (mobile) return [null, p];
  const right = p % 2 ? p : p - 1;
  return [right + 1, right];
}
export function adjacentPage(page, mobile, direction) {
  const right = spreadFor(page, mobile)[1];
  return normalizePage(right + direction * (mobile ? 1 : 2));
}
export function pageTurnJourney(from, to, mobile) {
  const target = normalizePage(to);
  const start = spreadFor(from, mobile)[1];
  const end = spreadFor(target, mobile)[1];
  const stride = mobile ? 1 : 2;
  const distance = Math.abs(end - start) / stride;
  if (!distance) return [];
  const count = Math.min(8, distance);
  const direction = end > start ? 1 : -1;
  return Array.from({length: count}, (_, i) => i === count - 1 ? target : start + direction * Math.round(distance * (i + 1) / count) * stride);
}
export function journeyTurnDuration(index, count) {
  if (index === count - 1) return 260;
  if (index === 0) return 160;
  return index < count / 2 ? 115 : 90;
}
export function groupPageLines(data, chapters) {
  const lines = Array.from({length: 15}, () => ({type: 'words', words: []}));
  for (const verse of data.verses) {
    for (const word of verse.words) lines[word[0] - 1].words.push({glyph: word[1], text: word[2], kind: word[3], key: verse.key});
    if (verse.key.endsWith(':1')) {
      const chapterId = Number(verse.key.split(':')[0]);
      const firstLine = verse.words[0][0];
      const headerIndex = firstLine - (chapterId === 1 || chapterId === 9 ? 2 : 3);
      if (headerIndex >= 0 && !lines[headerIndex].words.length) {
        lines[headerIndex] = {type: 'surah', chapter: chapters.find(c => c.id === chapterId), words: []};
        if (chapterId !== 1 && chapterId !== 9 && headerIndex + 1 < firstLine - 1) lines[headerIndex + 1] = {type: 'bismillah', words: []};
      }
    }
  }
  return data.page <= 2 ? lines.filter(l => l.type !== 'words' || l.words.length) : lines;
}
