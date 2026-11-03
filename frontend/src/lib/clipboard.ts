import { runtime } from './api'

/** Wails' clipboard first (works without focus quirks), browser API as fallback for the dev tab. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (await runtime.setClipboard(text)) return true
  } catch { /* not inside wails, or the call failed */ }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
