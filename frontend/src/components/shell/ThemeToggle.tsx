import { Monitor, Moon, Sun } from 'lucide-react'
import { useUI } from '../../state/uiStore'

export function ThemeToggle() {
  const theme = useUI((s) => s.theme)
  const cycle = useUI((s) => s.cycleTheme)
  const Icon = theme === 'system' ? Monitor : theme === 'pastel' ? Sun : Moon
  const label = theme === 'system' ? 'Theme: follow system' : theme === 'pastel' ? 'Theme: light' : 'Theme: dark'
  return (
    <button className="btn btn-ghost btn-xs btn-square" onClick={cycle} title={label}>
      <Icon size={14} />
    </button>
  )
}
