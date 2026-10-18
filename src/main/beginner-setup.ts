import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Installers update the saved PATH, but this process (and every terminal it
 * spawns) still has the PATH it started with. Merge in the saved entries so a
 * freshly installed `claude` works in the next pane without restarting Buddy.
 */
async function refreshPath(): Promise<void> {
  const extra = [join(homedir(), '.local', 'bin')]
  if (process.platform === 'win32') {
    try {
      const { stdout } = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"],
      { windowsHide: true, timeout: 10000 })
      extra.push(...stdout.trim().split(';'))
    } catch { /* keep the PATH we have */ }
  }
  const current = (process.env.PATH ?? '').split(delimiter)
  const seen = new Set(current.map((p) => p.toLowerCase()))
  const added = extra.filter((p) => p && existsSync(p) && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
  if (added.length) process.env.PATH = [...current, ...added].filter(Boolean).join(delimiter)
}

async function installed(tool: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') await run('where.exe', [tool], { windowsHide: true, timeout: 5000 })
    // macOS ships a `git` stub that only offers to install the developer tools.
    else if (tool === 'git' && process.platform === 'darwin') await run('/usr/bin/xcode-select', ['-p'], { timeout: 5000 })
    else await run('/bin/sh', ['-c', `command -v ${tool}`], { timeout: 5000 })
    return true
  } catch { return false }
}

export async function checkTools(): Promise<{ git: boolean; claude: boolean }> {
  await refreshPath()
  const [git, claude] = await Promise.all([installed('git'), installed('claude')])
  return { git, claude }
}
