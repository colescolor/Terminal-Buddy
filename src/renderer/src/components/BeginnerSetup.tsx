import { useEffect, useState } from 'react'
import { IS_MAC } from '../lib/shortcuts'
import { useStore } from '../store/useStore'
import Buddy from './Buddy'

/**
 * A checklist for someone who has never used Claude Code. It sits beside the
 * terminals instead of covering them, so every install runs in plain view and
 * any question the installer asks can be answered right there.
 */
export default function BeginnerSetup(): React.JSX.Element {
  const shells = useStore((s) => s.shells)
  const [tools, setTools] = useState<{ git: boolean; claude: boolean } | null>(null)
  const [error, setError] = useState('')
  const close = (): void => useStore.setState({ setupOpen: false })

  // Installers finish on their own schedule; keep the ticks honest without a "check" button.
  useEffect(() => {
    let live = true
    const check = (): void => { void window.buddy.app.checkTools().then((t) => { if (live) setTools(t) }).catch(() => {}) }
    check()
    const timer = setInterval(check, 3000)
    return () => { live = false; clearInterval(timer) }
  }, [])

  const powershell = shells.find((s) => s.id === 'pwsh') ?? shells.find((s) => s.id === 'powershell')
  const openTerminal = async (title: string, initialCommand: string, shellId?: string, agent?: 'claude'): Promise<void> => {
    setError('')
    const { home } = await window.buddy.app.paths()
    const id = await useStore.getState().openSession({ cwd: home, title, initialCommand, shellId, agent })
    if (!id) setError('Could not open a terminal. Close one and try again.')
    else useStore.getState().setLocked(true)
  }
  const installGit = (): Promise<void> => IS_MAC
    ? openTerminal('Installing Git', 'xcode-select --install')
    : openTerminal('Installing Git', 'winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements', powershell?.id)
  const installClaude = (): Promise<void> => IS_MAC
    ? openTerminal('Installing Claude Code', 'curl -fsSL https://claude.ai/install.sh | bash')
    : powershell
      ? openTerminal('Installing Claude Code', 'irm https://claude.ai/install.ps1 | iex', powershell.id)
      : openTerminal('Installing Claude Code', 'curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd', 'cmd')
  const link = (url: string): void => window.buddy.app.openExternal(url)
  const done = (ok: boolean | undefined): React.JSX.Element =>
    <span className={`setup-tick ${ok ? 'is-ok' : ''}`}>{ok === undefined ? 'Checking…' : ok ? '✓ Installed' : 'Not yet'}</span>

  return <aside className="beginner-setup" role="dialog" aria-labelledby="setup-title">
    <div className="walkthrough-meta"><Buddy mood="calm" size={34} /><span>GETTING SET UP</span>
      <button className="btn tiny" data-setup-close onClick={close}>Close</button></div>
    <h2 id="setup-title">Let’s get you coding with Claude</h2>
    <p className="muted">Four steps, top to bottom. Each install opens in a terminal on the left so you can watch it work.</p>
    <ol>
      <li>
        <strong>Make your accounts</strong>
        <p>Claude Code needs a paid Claude plan (Pro or Max). The free plan doesn’t include it. A GitHub account is where your projects get saved and shared.</p>
        <div className="setup-actions">
          <button className="btn" data-setup-link="claude" onClick={() => link('https://claude.com/pricing')}>Get a Claude plan ↗</button>
          <button className="btn" data-setup-link="github" onClick={() => link('https://github.com/signup')}>Make a GitHub account ↗</button>
        </div>
      </li>
      <li>
        <strong>Install Git</strong> {done(tools?.git)}
        <p>Git keeps the history of your work and talks to GitHub.{IS_MAC ? ' A Mac window will pop up; click Install.' : ' Windows may ask for permission; click Yes.'}</p>
        {!tools?.git && <div className="setup-actions">
          <button className="btn primary" data-setup-install="git" disabled={!tools} onClick={() => void installGit()}>Install Git</button>
          {!IS_MAC && <button className="btn tiny" onClick={() => link('https://git-scm.com/downloads/win')}>Or download it yourself ↗</button>}
        </div>}
      </li>
      <li>
        <strong>Install Claude Code</strong> {done(tools?.claude)}
        <p>The official installer from Anthropic. It takes about a minute and updates itself after that.</p>
        {!tools?.claude && <div className="setup-actions">
          <button className="btn primary" data-setup-install="claude" disabled={!tools} onClick={() => void installClaude()}>Install Claude Code</button>
        </div>}
      </li>
      <li>
        <strong>Sign in and say hi</strong>
        <p>This opens Claude. Your browser will ask you to sign in; come back here once it says you’re done. Then type what you want in plain English, like “make me a to-do list website”.</p>
        <div className="setup-actions">
          <button className="btn primary" data-setup-start disabled={!tools?.claude} onClick={() => void openTerminal('My first Claude chat', 'claude', undefined, 'claude')}>Open Claude</button>
        </div>
      </li>
    </ol>
    {error && <p role="alert">{error}</p>}
    <div className="guide-actions"><span className="muted">When Claude needs you, its terminal says <b>Needs you</b>.</span><span />
      <button className="btn" data-setup-tour onClick={() => useStore.setState({ setupOpen: false, walkthroughOpen: true })}>Show me around</button></div>
  </aside>
}
