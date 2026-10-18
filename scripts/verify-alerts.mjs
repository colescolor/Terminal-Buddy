/** Deterministic notification timing checks. Never opens desktop notifications. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/main/terminal-activity.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { TerminalActivity } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let now = 0, enabled = true
const alerts = []
const activity = new TerminalActivity((alert) => alerts.push(alert), () => enabled, () => now)
function pass(label, fn) { fn(); console.log('PASS ' + label) }
activity.register('plain', 'Shell'); activity.output('plain'); now = 10000; activity.tick()
pass('booting an unused shell does not alert', () => assert.equal(alerts.length, 0))
activity.input('plain', 'hello'); now += 10000; activity.tick()
pass('unsubmitted typing does not alert', () => assert.equal(alerts.length, 0))
activity.input('plain', '\r'); activity.output('plain'); now += 7999; activity.tick()
pass('short pauses do not alert', () => assert.equal(alerts.length, 0))
activity.rename('plain', "Praveen's persona"); now += 1; activity.tick()
pass('quiet alert uses the custom name and cautious status', () => assert.deepEqual(alerts.at(-1), { id: 'plain', title: "Praveen's persona", kind: 'quiet' }))
now += 40000; activity.tick()
pass('one alert per quiet episode', () => assert.equal(alerts.length, 1))
activity.output('plain'); now += 8000; activity.tick()
pass('resumed work can alert again when it pauses', () => assert.equal(alerts.length, 2))
activity.output('plain'); now += 8000; activity.tick()
pass('repeated pauses are rate limited', () => assert.equal(alerts.length, 2))
enabled = false; now += 30000; activity.tick(); enabled = true; now += 30000; activity.tick()
pass('re-enabling does not replay disabled episodes', () => assert.equal(alerts.length, 2))
activity.register('launch', 'Claude', true); activity.output('launch'); now += 8000; activity.tick()
pass('agent launch prompts alert without needing a transcript', () => assert.equal(alerts.at(-1).id, 'launch'))
activity.exit('launch')
pass('process exit is distinguished from a pause', () => assert.equal(alerts.at(-1).kind, 'exit'))
const beforeClose = alerts.length
activity.register('close', 'Closing', true); activity.remove('close'); activity.exit('close'); now += 30000; activity.tick()
pass('intentional close cancels pending alerts', () => assert.equal(alerts.length, beforeClose))
activity.register('protocol', 'Protocol'); activity.input('protocol', '\x1b[1;1R'); activity.output('protocol'); now += 10000; activity.tick()
pass('terminal protocol replies do not arm notifications', () => assert.equal(alerts.length, beforeClose))
const beforeHooked = alerts.length
activity.register('hooked', 'Claude', true, true); activity.output('hooked'); now += 60000; activity.tick()
pass('a reported agent never raises silence alerts', () => assert.equal(alerts.length, beforeHooked))
activity.agentState('hooked', 'working'); activity.agentState('hooked', 'needs', 'Claude needs your permission to use Bash')
pass('a reported question alerts at once with its text', () => assert.deepEqual(alerts.at(-1), { id: 'hooked', title: 'Claude', kind: 'needs', message: 'Claude needs your permission to use Bash' }))
activity.register('codex', 'Codex', true); activity.output('codex'); activity.agentState('codex', 'done', 'ok'); now += 8000; activity.tick()
pass('a reported finish replaces the vaguer pause alert', () => assert.deepEqual(alerts.slice(-1).map(x => x.kind), ['done']))

// Claude hooks: a real loopback server and the exact curl command Claude would run.
const hookSource = readFileSync(new URL('../src/main/agent-hooks.ts', import.meta.url), 'utf8')
const hookJs = ts.transpileModule(hookSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { AgentHooks, hookState } = await import('data:text/javascript;base64,' + Buffer.from(hookJs).toString('base64'))
const { mkdtempSync, rmSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const { exec } = await import('node:child_process')
// Async on purpose: a blocking exec would stall the in-process server it is calling.
const run = (cmd, input) => new Promise((resolve, reject) => { exec(cmd, (error) => error ? reject(error) : resolve()).stdin.end(input) })
pass('the idle reminder after a finish is ignored', () => assert.equal(hookState('needs', { message: 'Claude is waiting for your input', notification_type: 'idle_prompt' }), null))
pass('Stop carries the last reply', () => assert.deepEqual(hookState('done', { last_assistant_message: 'All done' }), { state: 'done', message: 'All done' }))
const dir = mkdtempSync(join(tmpdir(), 'buddy-hooks-'))
const states = []
const hooks = new AgentHooks(join(dir, 'hooks'), (id, state, message) => states.push({ id, state, message }))
await hooks.start()
pass('non-claude launches are left alone', () => assert.equal(hooks.inject('codex resume x', 'pane', 'pwsh'), null))
pass('WSL launches are left alone', () => assert.equal(hooks.inject('claude', 'pane', 'wsl'), null))
const command = hooks.inject('claude --resume abc', 'pane-1', 'pwsh')
const file = /--settings "([^"]+)"/.exec(command)[1]
pass('claude launches gain a settings file and keep their flags', () => assert.match(command, /^claude --settings "[^"]+" --resume abc$/))
const settings = JSON.parse(readFileSync(file, 'utf8'))
const notify = settings.hooks.Notification[0].hooks[0].command
await run(notify, JSON.stringify({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' }))
await run(notify.replace(/\/[0-9a-f]{32}\//, '/' + '0'.repeat(32) + '/'), '{}')
await new Promise((resolve) => setTimeout(resolve, 200))
pass('a hook POST reaches Buddy and a forged token does not', () => assert.deepEqual(states, [{ id: 'pane-1', state: 'needs', message: 'Claude needs your permission to use Bash' }]))
rmSync(dir, { recursive: true, force: true })
console.log('All notification timing checks passed')
