export function nativeBackAction({dialogOpen, busy, opening, focus, readerOpen}) {
  if (dialogOpen) return 'close-dialog';
  if (busy || opening) return 'wait';
  if (focus) return 'leave-focus';
  if (readerOpen) return 'close-reader';
  return 'minimize';
}

export function resumePage({native, hash, savedPage}) {
  const linked = hash.match(/^#page=(\d+)$/);
  const page = linked ? Number(linked[1]) : native ? savedPage : null;
  return Number.isInteger(page) && page >= 1 && page <= 604 ? page : null;
}
