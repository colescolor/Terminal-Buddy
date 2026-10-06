import type { AgentState } from '@shared/types'

export type TerminalAlert = { id: string; title: string; kind: 'quiet' | 'exit' | 'needs' | 'done'; message?: string }
type Activity = { title: string; submitted: boolean; pending: boolean; lastActivity: number; lastAlert: number; reported: boolean }

/** Output silence is a pause signal, never proof that an agent completed its task. */
export class TerminalActivity {
  private sessions = new Map<string, Activity>()
  constructor(private emit: (alert: TerminalAlert) => void, private enabled: () => boolean,
    private now: () => number = Date.now, private quietMs = 8000, private cooldownMs = 30000) {}

  /** `reported` sessions announce their own state, so silence never raises an alert for them. */
  register(id: string, title: string, launched = false, reported = false): void {
    this.sessions.set(id, { title, submitted: launched, pending: launched, lastActivity: this.now(), lastAlert: -Infinity, reported })
  }
  /** The agent said so itself; no silence window or cooldown applies. */
  agentState(id: string, state: AgentState, message?: string): void {
    const s = this.sessions.get(id)
    if (!s || state === 'working') return
    // This pause is now explained; don't follow it with a vaguer "output paused".
    s.pending = false
    s.lastAlert = this.now()
    if (this.enabled()) this.emit({ id, title: s.title, kind: state, message })
  }
  rename(id: string, title: string): void { const s = this.sessions.get(id); if (s) s.title = title }
  input(id: string, data: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    // Ignore device-status replies and arrows. Enter submits a command/answer;
    // ordinary typing postpones a pending alert rather than creating one.
    if (!/[\r\n]/.test(data) && !/^[^\x00-\x1f\x7f]/.test(data) && data !== '\x03') return
    s.lastActivity = this.now()
    if (/[\r\n]/.test(data) || data === '\x03') { s.submitted = true; s.pending = true }
    else s.pending = false
  }
  output(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    s.lastActivity = this.now()
    if (s.submitted) s.pending = true
  }
  tick(): void {
    const now = this.now()
    for (const [id, s] of this.sessions) {
      if (s.reported || !s.pending || now - s.lastActivity < this.quietMs || now - s.lastAlert < this.cooldownMs) continue
      s.pending = false
      // Consume quiet episodes even while disabled, so enabling isn't a burst
      // of stale notifications about work that ended long ago.
      if (!this.enabled()) continue
      s.lastAlert = now
      this.emit({ id, title: s.title, kind: 'quiet' })
    }
  }
  exit(id: string): void {
    const s = this.sessions.get(id)
    if (s && s.submitted && this.enabled()) this.emit({ id, title: s.title, kind: 'exit' })
    this.sessions.delete(id)
  }
  remove(id: string): void { this.sessions.delete(id) }
}
