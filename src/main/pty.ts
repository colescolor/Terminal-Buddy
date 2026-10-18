import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import type { ResumeRef, SessionInfo, SessionSpec, ShellDef } from '@shared/types'
import { resolveShell } from './shells'
import { Terminal as HeadlessTerminal } from '@xterm/headless'
import { SerializeAddon } from '@xterm/addon-serialize'
import type { TerminalSnapshot } from '@shared/types'
import type { TerminalColors } from '@shared/themes'

type IPty = {
  pid: number
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
}

// Required lazily so a load failure surfaces as a readable error rather than a
// blank window at startup.
function loadPty(): { spawn: (f: string, a: string[], o: object) => IPty } {
  return require('@lydell/node-pty')
}

/** Flush window for pty output. Batching matters a lot with 8 panes streaming at once. */
const FLUSH_MS = 8
const FLUSH_BYTES = 48 * 1024

interface Entry {
  screen: HeadlessTerminal
  serializer: SerializeAddon
  seq: number
  exitCode?: number
  id: string
  pty: IPty
  info: SessionInfo
  buffer: string[]
  bufferedBytes: number
  timer: NodeJS.Timeout | null
  exited: boolean
  sawFirstData: boolean
  pendingCommand: string | null
  submitting?: boolean
  inputRevision?: number
}

export class PtyManager {
  private entries = new Map<string, Entry>()
  private target: WebContents | null = null
  onEvent: ((channel: string, ...args: unknown[]) => void) | null = null
  private scrollback = 5000
  private colors = { foreground: '#ffffff', background: '#000000', cursor: '#ffffff' }

  setColors(colors: Pick<TerminalColors, 'foreground' | 'background' | 'cursor'>): void {
    this.colors = colors
  }

  setScrollback(value: number): void {
    if (!Number.isFinite(value)) return
    this.scrollback = Math.max(0, Math.min(100000, Math.floor(value)))
    for (const entry of this.entries.values()) entry.screen.options.scrollback = this.scrollback
  }

  constructor(private shells: ShellDef[], private activity?: {
    register(id: string, title: string, launched: boolean, reported: boolean): void
    input(id: string, data: string): void
    output(id: string): void
    exit(id: string): void
    remove(id: string): void
  }, private hooks?: { inject(command: string, sessionId: string, shellId: string): string | null }) {}

  setTarget(wc: WebContents | null): void {
    this.target = wc
  }

  private send(channel: string, ...args: unknown[]): void {
    const wc = this.target
    if (wc && !wc.isDestroyed()) wc.send(channel, ...args)
    this.onEvent?.(channel, ...args)
  }

  private safeCwd(cwd: string | undefined): string {
    try {
      if (cwd && existsSync(cwd) && statSync(cwd).isDirectory()) return cwd
    } catch {
      /* fall through */
    }
    return homedir()
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v
    // Electron leaks these into children and they confuse CLIs.
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    // Launching Buddy from a Claude Code session leaks its per-session markers;
    // a claude started in a tab would think it's a nested child and stop saving transcripts.
    for (const k of ['CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_EXECPATH',
      'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_BRIDGE_SESSION_ID', 'CLAUDE_CODE_MESSAGING_SOCKET',
      'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_PID']) delete env[k]
    // The launcher (including coding tools) may disable color for its own
    // captured output. These children are real interactive, truecolor terminals.
    delete env.NO_COLOR
    env.FORCE_COLOR = '3'
    env.CLICOLOR = '1'
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'
    env.TERM_PROGRAM = 'terminal-buddy'
    return env
  }

  create(spec: SessionSpec): SessionInfo {
    const shell = resolveShell(this.shells, spec.shellId)
    const cwd = this.safeCwd(spec.cwd)
    if (spec.requireCwd && cwd !== spec.cwd) throw new Error('The saved project folder is unavailable; it was not replaced with a different folder.')
    const id = randomUUID()
    // Claude supports assigning an explicit ID before its first message. This
    // lets new chats be restored without guessing which transcript belongs to them.
    let resume = spec.resume
    let command = spec.initialCommand
    // Inline mode retains native scrollback. Respect explicit screen options and
    // custom launchers; this only adjusts Buddy's ordinary Codex launches.
    if (spec.agent === 'codex' && command && /^codex(?:\s|$)/.test(command) &&
        !command.includes('--no-alt-screen') && !command.includes('alternate_screen')) {
      command = command.replace(/^codex/, 'codex --no-alt-screen')
    }
    if (spec.agent === 'claude' && command === 'claude' && !resume) {
      const chatId = randomUUID()
      resume = { agent: 'claude', id: chatId, path: join(homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), chatId + '.jsonl') }
      command = `claude --session-id ${chatId}`
    }
    const hooked = command ? this.hooks?.inject(command, id, shell.id) : null
    if (hooked) command = hooked

    let pty: IPty
    try {
      pty = loadPty().spawn(shell.path, shell.args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: this.buildEnv(),
        // Use the bundled OpenConsole/ConPTY runtime. The OS copy can predate
        // synchronized output support, exposing a TUI's intermediate cursor
        // positions even when the visible xterm renderer supports that mode.
        ...(process.platform === 'win32' ? { useConptyDll: true } : {})
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Could not open ${shell.label} (${shell.path}). ${reason}\nChoose another default shell in Settings. If the error mentions node-pty or a native module, reinstall Terminal Buddy for your operating system and processor.`)
    }

    const info: SessionInfo = {
      id,
      cwd,
      shellId: shell.id,
      assistantId: spec.assistantId, assistantName: spec.assistantName,
      shellLabel: shell.label,
      title: spec.title || basename(cwd),
      pid: pty.pid,
      resume,
      hooks: !!hooked
    }

    const screen = new HeadlessTerminal({ cols: 80, rows: 24, scrollback: this.scrollback, scrollOnEraseInDisplay: true, allowProposedApi: true })
    const serializer = new SerializeAddon()
    screen.loadAddon(serializer)
    // One parser answers terminal queries even while a view is being attached.
    // Visible renderers suppress these replies so they cannot answer twice.
    screen.onData((data) => { try { pty.write(data) } catch { /* exited */ } })
    // Headless xterm has no browser ColorService. Visible views suppress query
    // replies, so answer default-color queries here, even before a view attaches.
    // Codex uses OSC 11 to choose the background of its full-width input area.
    const colorKeys = ['foreground', 'background', 'cursor'] as const
    for (const code of [10, 11, 12]) {
      screen.parser.registerOscHandler(code, (data) => {
        const requests = data.split(';')
        for (let i = 0; i < requests.length && code + i <= 12; i++) {
          if (requests[i] !== '?') continue
          const color = this.colors[colorKeys[code + i - 10]]
          const rgb = color.slice(1).match(/../g)!.map((part) => part + part).join('/')
          try { pty.write(`\x1b]${code + i};rgb:${rgb}\x1b\\`) } catch { /* exited */ }
        }
        return true
      })
    }
    const entry: Entry = {
      screen, serializer, seq: 0,
      id,
      pty,
      info,
      buffer: [],
      bufferedBytes: 0,
      timer: null,
      exited: false,
      sawFirstData: false,
      pendingCommand: command ?? null
    }
    this.entries.set(id, entry)
    this.activity?.register(id, info.title, !!spec.initialCommand, !!hooked)

    pty.onData((data) => {
      this.activity?.output(id)
      entry.buffer.push(data)
      entry.bufferedBytes += data.length

      // ConPTY fills in the pid asynchronously, so the value at spawn time is
      // always 0. By the time output arrives the real process exists.
      if (entry.info.pid !== pty.pid && pty.pid) {
        entry.info.pid = pty.pid
        this.send('pty:info', id, { pid: pty.pid })
      }

      if (!entry.sawFirstData) {
        entry.sawFirstData = true
        // Give the shell a beat to finish drawing its prompt before typing.
        if (entry.pendingCommand) {
          const cmd = entry.pendingCommand
          entry.pendingCommand = null
          setTimeout(() => {
            if (!entry.exited) entry.pty.write(cmd + '\r')
          }, 250)
        }
      }

      if (entry.bufferedBytes >= FLUSH_BYTES) this.flush(entry)
      else if (!entry.timer) entry.timer = setTimeout(() => this.flush(entry), FLUSH_MS)
    })

    pty.onExit(({ exitCode }) => {
      this.activity?.exit(id)
      entry.exited = true
      entry.exitCode = exitCode
      this.flush(entry)
      this.send('pty:exit', id, exitCode)
      // Retain the screen until the pane is closed; exited terminals can pop out too.
    })

    // Safety net: if the shell never emits anything, still run the command.
    if (entry.pendingCommand) {
      setTimeout(() => {
        if (entry.pendingCommand && !entry.exited) {
          const cmd = entry.pendingCommand
          entry.pendingCommand = null
          entry.pty.write(cmd + '\r')
        }
      }, 1500)
    }

    return info
  }

  private flush(entry: Entry): void {
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    if (entry.buffer.length === 0) return
    const data = entry.buffer.join('')
    entry.buffer = []
    entry.bufferedBytes = 0
    entry.screen.write(data, () => {
      if (this.entries.get(entry.id) !== entry) return
      this.send('pty:data', entry.id, data, ++entry.seq)
    })
  }

  write(id: string, data: string): void {
    const e = this.entries.get(id)
    if (e && !e.exited) {
      // A real keystroke while a paste is settling cancels the queued Enter.
      // Device-status replies are terminal plumbing, not user intervention.
      if (!/^\x1b\[[\d;?]*[Rcn]$/.test(data)) e.inputRevision = (e.inputRevision ?? 0) + 1
      this.activity?.input(id, data)
      e.pty.write(data)
    }
  }

  async submit(id: string, data: string): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry || entry.exited) throw new Error('This terminal has closed.')
    if (entry.submitting) throw new Error('A message is already being submitted.')
    entry.submitting = true
    try {
      this.write(id, data)
      const revision = entry.inputRevision
      // TUI paste handlers debounce input. An adjacent CR can be consumed as
      // part of the paste rather than a submit key, even across separate writes.
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      if (this.entries.get(id) !== entry || entry.exited) throw new Error('Terminal closed after pasting; Enter was not sent.')
      if (entry.inputRevision !== revision) throw new Error('Terminal input changed after pasting; queued Enter was cancelled. Check the terminal before sending again.')
      this.write(id, '\r')
    } finally {
      entry.submitting = false
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const e = this.entries.get(id)
    if (!e) return
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return
    const c = Math.max(2, Math.min(1000, Math.floor(cols)))
    const r = Math.max(1, Math.min(500, Math.floor(rows)))
    e.screen.resize(c, r)
    try {
      if (!e.exited) e.pty.resize(c, r)
    } catch {
      /* pty raced with exit */
    }
  }

  kill(id: string): void {
    this.activity?.remove(id)
    const e = this.entries.get(id)
    if (!e) return
    e.exited = true
    if (e.timer) clearTimeout(e.timer)
    try {
      e.pty.kill()
    } catch {
      /* already gone */
    }
    this.entries.delete(id)
    e.screen.dispose()
  }

  killAll(): void {
    for (const id of [...this.entries.keys()]) this.kill(id)
  }

  list(): SessionInfo[] {
    return [...this.entries.values()].filter((e) => !e.exited).map((e) => e.info)
  }

  describe(id: string): { session: SessionInfo; exited: boolean; exitCode?: number } | null {
    const e = this.entries.get(id)
    return e ? { session: e.info, exited: e.exited, exitCode: e.exitCode } : null
  }

  rename(id: string, title: string): void {
    const e = this.entries.get(id)
    if (e) e.info.title = title
  }

  link(id: string, resume: ResumeRef, cwd: string): SessionInfo {
    const entry = this.entries.get(id)
    if (!entry) throw Error('This terminal has closed.')
    entry.info = { ...entry.info, resume, cwd }
    return entry.info
  }

  snapshot(id: string): Promise<TerminalSnapshot> {
    const e = this.entries.get(id)
    if (!e) return Promise.reject(Error('This terminal has closed.'))
    this.flush(e)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Terminal state could not be captured in time.')), 10000)
      timeout.unref()
      e.screen.write('', () => {
        clearTimeout(timeout)
        if (this.entries.get(id) !== e) return reject(Error('This terminal has closed.'))
        resolve({ data: e.serializer.serialize(), seq: e.seq, cols: e.screen.cols, rows: e.screen.rows })
      })
    })
  }
}

function basename(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || p
}
