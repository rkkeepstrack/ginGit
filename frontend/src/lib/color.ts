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
