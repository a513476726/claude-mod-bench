import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import type { NoteSeen } from './conversation'
import { attachTool, closeTurn, startTurn, statsOf, summaryOf } from './conversation'

const at = 1_700_000_000_000

const PANE = {
  plugin: 'bench',
  component: 'Pane' as const,
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

const note = (summary: string, isOk = true, detail = ''): NoteSeen => ({ at, ms: 12, isOk, summary, detail, result: '' })

function quiet(on: On) {
  mock.clock(on, { now: at })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  on('fs.stat', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
}

/** The person types a prompt: the engine's submission, and the plugin's own answer. */
async function typed($: Engine, text: string): Promise<void> {
  await $.prompt.submit({ text } as never).catch(() => undefined)
}

/** Two rounds: the first two Bash calls and a Read, the second a Skill and one failed Bash. */
function worked(on: On) {
  quiet(on)
  on('tool.call', () => ({ result: { text: 'ok' } }))
}

test('the session’s cost is summed model by model, with a total', () => {
  let turns = startTurn([], { id: 'a', kind: 'input', at, text: '一' })
  turns = closeTurn(turns, 'a', {
    reason: 'answer',
    durationMs: 1,
    answer: '',
    usage: { model: 'opus', input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 5, cache_creation_input_tokens: 1 },
  })
  turns = startTurn(turns, { id: 'b', kind: 'input', at: at + 1, text: '二' })
  turns = closeTurn(turns, 'b', {
    reason: 'answer',
    durationMs: 1,
    answer: '',
    usage: { model: 'opus', input_tokens: 20, output_tokens: 4, cache_read_input_tokens: 6, cache_creation_input_tokens: 2 },
  })
  turns = startTurn(turns, { id: 'c', kind: 'input', at: at + 2, text: '三' })
  turns = closeTurn(turns, 'c', {
    reason: 'answer',
    durationMs: 1,
    answer: '',
    usage: { model: 'haiku', input_tokens: 7, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  })

  const stats = statsOf(turns)

  expect(stats.models.map(one => [one.model, one.turns, one.input])).toEqual([
    ['opus', 2, 30],
    ['haiku', 1, 7],
  ])
  expect(stats.total).toEqual({ input: 37, output: 7, cacheRead: 11, cacheWrite: 3 })
})

test('tool kinds and calls are counted, and commands with them', () => {
  let turns = startTurn([], { id: 'a', kind: 'input', at, text: '一' })
  turns = attachTool(turns, 'a', 'Bash', note('ls'))
  turns = attachTool(turns, 'a', 'Bash', note('pwd'))
  turns = attachTool(turns, 'a', 'Read', note('a.ts'))
  turns = attachTool(turns, 'a', 'Write', note('b.ts'))

  const stats = statsOf(turns)

  expect(stats.toolKinds).toBe(3)
  expect(stats.toolCalls).toBe(4)
  expect(stats.commandCalls).toBe(2)
})

test('a session with nothing yet has nothing to total', () => {
  const stats = statsOf(startTurn([], { id: 'a', kind: 'input', at, text: '一' }))

  expect(stats.models).toEqual([])
  expect(stats.toolKinds).toBe(0)
  expect(stats.commandCalls).toBe(0)
})

test('the session block opens the tools, a tool opens its calls, a call opens itself', async ($, on) => {
  worked(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')

  await $.tool.call({ tool: 'Bash', tool_use_id: 'c1', command: 'git status' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'c2', command: 'npx tsc' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'c3', file_path: 'a.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })

  const tools = await ui.find({ type: 'Button', key: 'stat-tools' })
  expect(String((tools as unknown as { props: { label: string } }).props.label)).toContain('工具 2 种 · 3 次')
  expect((await ui.find({ type: 'Button', key: 'stat-commands' }))?.text ?? '').toContain('命令 2 次')

  await ui.press({ key: 'stat-tools' })
  expect((await ui.find({ type: 'Button', text: /Bash/ }))?.text ?? '').toContain('Bash')

  // The tool's calls, newest first: the two Bash commands, each a door of its own.
  await ui.press({ key: 'drill-all:Bash' })
  expect(await ui.find({ type: 'Text', text: /npx tsc/ })).toBeDefined()

  // Newest first: npx tsc ran after git status. Pressing a row opens the next level,
  // and one call's own page is a detail: its arguments, drawn where the list stood.
  await ui.press({ key: 'drill-call:1700000000000-0:Bash:1' })

  // One call's own page: its whole arguments, drawn as a detail.
  // The level above, the call list, still stands behind this one; what the page
  // itself says is the detail, its title and the way out.
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(page).toContain('参数')
  expect(page).toContain('npx tsc')

  await ui.press({ key: 'back' })

  // Back at the tool's calls, the tool's name still heads them.
  const back = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(back).toContain('Bash · 2 次')

  // Two more steps: the tools list, then the conversation list.
  await ui.press({ key: 'back' })
  await ui.press({ key: 'back' })
  const top = (await ui.findAll({ type: 'Button' })).map(one => (one as unknown as { key?: string }).key)
  expect(top).toContain('stat-tools')

  await ui.unmount()
})

test('a round’s tool name opens that tool’s calls for the round', async ($, on) => {
  worked(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '修一下分支')
  await $.tool.call({ tool: 'Bash', tool_use_id: 'c1', command: 'git status' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'c2', command: 'npx tsc' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })

  const row = await ui.find({ type: 'Button', text: /修一下分支/ })

  if (row !== undefined) {
    await ui.press({ key: (row as unknown as { key: string }).key })
  }

  const bash = await ui.find({ type: 'Button', text: /Bash ×2/ })

  expect(bash).toBeDefined()

  await ui.unmount()
})

test('the commands list says so when nothing was run', async ($, on) => {
  worked(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: 'stat-commands' })

  expect(await ui.find({ type: 'Text', text: /本次会话没有执行命令/ })).toBeDefined()

  await ui.unmount()
})

test('a call’s note is cut where a row stops reading, and the newest 50 stand', () => {
  let turns = startTurn([], { id: 't', kind: 'input', at, text: '一' })
  const long = 'x'.repeat(5_000)

  for (let at0 = 0; at0 < 60; at0 += 1) {
    turns = attachTool(turns, 't', 'Bash', { at: at0, ms: 1, isOk: true, summary: long, detail: long, result: long })
  }

  const tool = turns[0]?.tools[0]

  expect(tool?.count).toBe(60)
  expect(tool?.notes).toHaveLength(50)
  // Oldest first, the last 50 kept: note 60 is the one still there at the end.
  expect(tool?.notes[0]?.at).toBe(10)
  expect(tool?.notes[49]?.at).toBe(59)
  expect((tool?.notes[0]?.summary.length ?? 0)).toBeLessThanOrEqual(201)
  expect((tool?.notes[0]?.detail.length ?? 0)).toBeLessThanOrEqual(2_001)
  expect((tool?.notes[0]?.result.length ?? 0)).toBeLessThanOrEqual(401)
})

test('a Skill call is noted by the skill it loaded', () => {
  let turns = startTurn([], { id: 't', kind: 'input', at, text: '一' })

  turns = attachTool(turns, 't', 'Skill', note('openspec-propose'))
  turns = attachTool(turns, 't', 'Skill', note('feature-doc-regression'))

  expect(turns[0]?.tools[0]?.notes.map(one => one.summary)).toEqual(['openspec-propose', 'feature-doc-regression'])
})

test('a summary names a Bash command, a Skill, or the tool and its first argument', () => {
  expect(summaryOf('Bash', { command: 'git   status\n', tool: 'Bash' })).toBe('git status')
  expect(summaryOf('Skill', { skill: 'openspec-propose' })).toBe('openspec-propose')
  expect(summaryOf('Read', { file_path: 'hooks/scan.ts' })).toBe('Read · hooks/scan.ts')
})
