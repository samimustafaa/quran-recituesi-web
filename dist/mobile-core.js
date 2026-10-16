export function nativeBackAction({dialogOpen, busy, opening, focus, readerOpen}) {
  if (dialogOpen) return 'close-dialog';
  if (busy || opening) return 'wait';
  if (focus) return 'leave-focus';
  if (readerOpen) return 'close-reader';
  return 'minimize';
}
