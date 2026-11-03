/** Stable 0..7 bucket for a string, used to pick a lane color for people. */
export function bucket(s: string, n = 8): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % n
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const kinds: Record<string, string> = {
  feat: 'feat', feature: 'feat',
  fix: 'fix', hotfix: 'fix', bugfix: 'fix',
  chore: 'chore', build: 'chore', ci: 'chore', deps: 'chore', release: 'chore',
  refactor: 'refactor', perf: 'refactor', style: 'refactor',
  docs: 'docs', doc: 'docs',
  test: 'test', tests: 'test',
  revert: 'fix',
}

/**
 * Splits "feat(LD-1): add x" into the colored prefix and the rest.
 * Returns null when the subject does not follow the convention.
 */
export function conventionalPrefix(subject: string): { prefix: string; kind: string; rest: string } | null {
  const m = /^([a-z]+)(\([^)]*\))?(!)?:\s/.exec(subject)
  if (!m) return null
  const kind = kinds[m[1]]
  if (!kind) return null
  return { prefix: m[0].trimEnd(), kind, rest: subject.slice(m[0].length) }
}
