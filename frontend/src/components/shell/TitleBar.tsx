import { WindowToggleMaximise } from '../../../wailsjs/runtime/runtime'
import { Logo } from './Logo'

/** Logo only. It is the window's drag handle, nothing else lives here. */
export function TitleBar() {
  return (
    <div
      className="drag-region flex items-center justify-center h-[38px] shrink-0 hairline-b brand"
      onDoubleClick={() => WindowToggleMaximise()}
    >
      <Logo size={22} />
      <span className="ml-2 text-[13px] font-semibold tracking-tight">ginGit</span>
    </div>
  )
}
