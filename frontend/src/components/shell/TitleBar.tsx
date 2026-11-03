import { useEffect, useState } from 'react'
import { WindowToggleMaximise } from '../../../wailsjs/runtime/runtime'
import { api } from '../../lib/api'
import { Logo } from './Logo'

let measured: number | null = null

/** Logo only. It is the window's drag handle, nothing else lives here. */
export function TitleBar() {
  // Height follows the traffic lights so the logo sits level with them.
  const [height, setHeight] = useState(measured ?? 40)
  useEffect(() => {
    if (measured !== null) return
    api.titleBarCenter().then((y) => {
      if (y > 0) { measured = Math.round(y * 2); setHeight(measured) }
    }, () => {})
  }, [])
  return (
    <div
      className="drag-region flex items-center justify-center shrink-0 hairline-b text-base-content"
      style={{ height }}
      onDoubleClick={() => WindowToggleMaximise()}
    >
      <span className="translate-y-[1px]"><Logo size={22} /></span>
      <span className="ml-2 text-[13px] font-semibold tracking-tight">ginGit</span>
    </div>
  )
}
