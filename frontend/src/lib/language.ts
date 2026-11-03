import { LanguageDescription, type LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

const cache = new Map<string, Promise<LanguageSupport | null>>()

/** Lazily loads the grammar matching a filename; null when none is known. */
export function languageFor(path: string): Promise<LanguageSupport | null> {
  const name = path.split('/').pop() ?? path
  const desc = LanguageDescription.matchFilename(languages, name)
  if (!desc) return Promise.resolve(null)
  let p = cache.get(desc.name)
  if (!p) {
    p = desc.load().catch(() => null)
    cache.set(desc.name, p)
  }
  return p
}
