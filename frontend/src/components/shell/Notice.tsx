import type { ReactNode } from 'react'

export function Notice({ kind = 'info', children, action }: { kind?: 'info' | 'error' | 'warning'; children: ReactNode; action?: ReactNode }) {
  const cls = kind === 'error' ? 'alert-error' : kind === 'warning' ? 'alert-warning' : 'alert-info'
  return (
    <div className={`alert ${cls} alert-soft rounded-none py-1.5 px-3 text-xs shrink-0 flex items-center justify-between gap-2`}>
      <span className="min-w-0 break-words select-text">{children}</span>
      {action}
    </div>
  )
}
