import { Check } from 'lucide-react'
import { useHint } from '../../state/hintStore'

/** Short confirmations ("Copied …") as a pill above the status bar. */
export function Toasts() {
  const flash = useHint((s) => s.flash)
  if (!flash) return null
  return (
    <div className="toast toast-center toast-bottom z-50 mb-8 pointer-events-none">
      <div className="alert py-1.5 px-3 min-h-0 text-[12px] shadow-md border border-base-content/10 bg-base-100 text-base-content gap-2">
        <Check size={14} strokeWidth={2} className="brand" />
        <span>{flash}</span>
      </div>
    </div>
  )
}
