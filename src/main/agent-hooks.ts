import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentState } from '@shared/types'

/**
 * Claude reports its own state through hooks, so "needs you" and "finished"
 * are facts rather than guesses from output silence. Each Claude launch gets a
 * `--settings` file whose hooks POST to this loopback server; the user's own
 * Claude settings are never modified, and the random token keeps other local
 * processes from spoofing a pane.
 */
export class AgentHooks {
  private port = 0
  private readonly token = randomBytes(16).toString('hex')

  constructor(private dir: string, private onState: (sessionId: string, state: AgentState, message?: string) => void) {}

  start(): Promise<void> {
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
    const server = createServer((req, res) => {
      const [, token, sessionId, event] = (req.url ?? '').split('/')
      let body = ''
      req.on('data', (chunk) => { if (body.length < 65536) body += chunk })
      req.on('end', () => {
        res.end()
        if (token !== this.token || req.method !== 'POST' || !sessionId) return
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(body) } catch { /* state alone is enough */ }
        const parsed = hookState(event, input)
        if (parsed) this.onState(sessionId, parsed.state, parsed.message)
      })
    })
    return new Promise((resolve) => {
      // A failed listen leaves port 0, and launches simply go unhooked.
      server.once('error', () => resolve())
      server.listen(0, '127.0.0.1', () => {
        this.port = (server.address() as { port: number }).port
        server.unref()
        resolve()
      })
    })
  }

  /** Adds the hook settings to a `claude …` launch; anything else is returned unchanged. */
  inject(command: string, sessionId: string, shellId: string): string | null {
    // WSL can neither read a Windows path nor reach Windows' loopback.
    if (!this.port || shellId === 'wsl' || !/^claude(?:\s|$)/.test(command)) return null
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl'
    // "@-" is quoted because a bare @ starts a splat in PowerShell.
    const post = (event: string): { type: string; command: string }[] =>
      [{ type: 'command', command: `${curl} -s -m 2 -X POST --data-binary "@-" http://127.0.0.1:${this.port}/${this.token}/${sessionId}/${event}` }]
    const file = join(this.dir, `${sessionId}.json`)
    writeFileSync(file, JSON.stringify({ hooks: {
      UserPromptSubmit: [{ hooks: post('working') }],
      Notification: [{ hooks: post('needs') }],
      PreToolUse: [{ matcher: 'AskUserQuestion|ExitPlanMode', hooks: post('ask') }],
      Stop: [{ hooks: post('done') }]
    } }))
    // Forward slashes read the same in PowerShell, cmd, bash and to Claude itself.
    return command.replace(/^claude/, `claude --settings "${file.replace(/\\/g, '/')}"`)
  }
}

export function hookState(event: string | undefined, input: Record<string, unknown>): { state: AgentState; message?: string } | null {
  const text = (key: string): string | undefined => typeof input[key] === 'string' && input[key] ? String(input[key]).slice(0, 300) : undefined
  switch (event) {
    case 'working': return { state: 'working' }
    case 'done': return { state: 'done', message: text('last_assistant_message') }
    case 'ask':
      return { state: 'needs', message: input.tool_name === 'ExitPlanMode' ? 'Claude has a plan ready for you to review.' : 'Claude has a question for you.' }
    case 'needs': {
      // The idle reminder arrives a minute after Stop already reported "finished".
      const message = text('message')
      if (input.notification_type === 'idle_prompt' || /waiting for your input/i.test(message ?? '')) return null
      return { state: 'needs', message }
    }
    default: return null
  }
}
