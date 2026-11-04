export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * A shortcut the way the platform writes it: keys('mod', 'shift', 'D') is
 * ⌘⇧D on a Mac and Ctrl+Shift+D elsewhere, where glyphs run together badly.
 */
export function keys(...parts: string[]): string {
  const names: Record<string, string> = isMac ? { mod: '⌘', shift: '⇧' } : { mod: 'Ctrl', shift: 'Shift' }
  return parts.map((p) => names[p] ?? p).join(isMac ? '' : '+')
}
export function hasMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}
