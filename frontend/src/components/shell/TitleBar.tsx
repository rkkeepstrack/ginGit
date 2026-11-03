import { useEffect, useState } from 'react'
import { api, runtime } from '../../lib/api'
import { Logo } from './Logo'

let measured: number | null = null
const MIN_HEIGHT = 36

/** Logo only. It is the window's drag handle, nothing else lives here. */
export function TitleBar() {
  // The logo is centred on the traffic lights' own line, wherever macOS put
  // it, and the bar is only as tall as it has to be.
  const [center, setCenter] = useState<number | null>(measured)
  useEffect(() => {
    if (measured !== null) return
    api.titleBarCenter().then((y) => {
      if (y > 0) { measured = y; setCenter(y) }
    }, () => {})
  }, [])
  const height = Math.max(MIN_HEIGHT, center ? Math.round(center * 2) : 0)
  return (
    <div
      className="drag-region relative shrink-0 hairline-b text-base-content"
      style={{ height }}
      onDoubleClick={() => runtime.toggleMaximise()}
    >
      <div
        className="absolute left-0 right-0 flex items-center justify-center -translate-y-1/2"
        style={{ top: center ?? height / 2 }}
      >
        <span className="translate-y-[1px]"><Logo size={22} /></span>
        <span className="ml-2 text-[13px] font-semibold tracking-tight">ginGit</span>
      </div>
    </div>
  )
}
