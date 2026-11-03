import { Check, Monitor, Moon, Sun, SunMoon } from 'lucide-react'
import { useUI, type ThemeChoice } from '../../state/uiStore'
import { hintProps } from '../../state/hintStore'

const choices: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'pastel', label: 'Light', Icon: Sun },
  { value: 'dim', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle() {
  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square" {...hintProps('Appearance: light, dark or follow the system')}>
        <SunMoon size={16} strokeWidth={1.75} />
      </div>
      <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg z-50 w-40 p-1 mt-1 border border-base-content/10">
        {choices.map(({ value, label, Icon }) => (
          <li key={value}>
            <a
              className={`grid-cols-[auto_1fr_auto] ${theme === value ? 'active' : ''}`}
              onClick={() => { setTheme(value); (document.activeElement as HTMLElement | null)?.blur() }}
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
              {theme === value ? <Check size={13} strokeWidth={2} /> : <span />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
