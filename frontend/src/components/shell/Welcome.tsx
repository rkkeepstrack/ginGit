import { FolderOpen } from 'lucide-react'
import { useRepo } from '../../state/repoStore'
import { modKey } from '../../lib/platform'
import { Logo } from './Logo'
import { TitleBar } from './TitleBar'
import { Notice } from './Notice'

export function Welcome() {
  const recent = useRepo((s) => s.recent)
  const open = useRepo((s) => s.open)
  const error = useRepo((s) => s.error)
  const gitMissing = useRepo((s) => s.gitMissing)
  return (
    <div className="h-full flex flex-col">
    <TitleBar />
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-4">
        <Logo size={56} />
        <div>
          <div className="text-2xl font-semibold tracking-tight">ginGit</div>
          <div className="text-sm opacity-60">Read-only git history, multi-commit review.</div>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 w-80">
        {gitMissing && <Notice kind="error">git was not found on PATH. Install git and restart ginGit.</Notice>}
        {error && !gitMissing && <Notice kind="error">{error}</Notice>}
        <button className="btn btn-primary btn-sm" onClick={() => void open()}>
          <FolderOpen size={15} strokeWidth={1.75} /> Open repository… <kbd className="kbd kbd-xs ml-1">{modKey} O</kbd>
        </button>
        {recent.length > 0 && (
          <ul className="menu menu-sm p-0 mt-2 w-full">
            <li className="menu-title text-[10px]">Recent</li>
            {recent.map((r) => (
              <li key={r.path}>
                <a onClick={() => void open(r.path)} title={r.path} className="flex flex-col items-start gap-0 py-1">
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-[10px] opacity-50 truncate w-full">{r.path.replace(/^\/(?:Users|home)\/[^/]+/, '~')}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </div>
  )
}
