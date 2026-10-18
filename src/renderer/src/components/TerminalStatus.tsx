import type { Session } from '../store/useStore'

/** These labels describe observations or what the agent itself reported, never guessed completion. */
export default function TerminalStatus({ session }: { session: Session }): React.JSX.Element {
  const reported = session.attention ? session.agentState : undefined
  const [state, label, hint] = session.status === 'exited'
    ? ['exited', 'Exited', 'This terminal process has ended.']
    : session.replacing
      ? ['sending', 'Opening', 'The saved session is being opened in this terminal.']
      : reported === 'needs'
        ? ['attention', 'Needs you', session.agentMessage ?? 'The agent is waiting for your answer in the terminal.']
        : session.busy
          ? ['active', 'Output active', 'The terminal is producing output. Input remains available.']
          : reported === 'done'
            ? ['done', 'Finished', session.agentMessage ?? 'The agent finished its turn. Click this terminal to clear its light.']
            : session.attention
              ? ['attention', 'Take a look', 'Output paused. Click this terminal to clear its light; no typing required. This is not a confirmed completion or approval request.']
              : session.agentState === 'working'
                ? ['active', 'Working', 'The agent reported it is still working on your request.']
                : ['quiet', 'Quiet', 'No recent output. Check the native prompt before replying; silence does not prove completion.']
  return <span className={`terminal-status is-${state}`} title={hint} role="status"><i aria-hidden="true" />{label}</span>
}
