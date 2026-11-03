import type { ReactNode } from 'react'

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'warning'; children: ReactNode }) {
  const cls = kind === 'error' ? 'alert-error' : kind === 'warning' ? 'alert-warning' : 'alert-info'
  return (
    <div className={`alert ${cls} alert-soft rounded-none py-1.5 px-3 text-xs shrink-0`}>
      <span className="min-w-0 break-words select-text">{children}</span>
    </div>
  )
}
