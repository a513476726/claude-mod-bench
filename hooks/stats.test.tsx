import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import type { NoteSeen } from './conversation'
import { attachTool, closeTurn, startTurn, statsOf, summaryOf } from './conversation'
import { cellsOf } from './format'
import { railOf } from './panes'

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

test('the session rail opens the tools, a tool opens its calls, a call opens itself', async ($, on) => {
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

test('a tab switch closes the drill and shows the new tab', async ($, on) => {
  worked(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')
  await $.tool.call({ tool: 'Bash', tool_use_id: 'c1', command: 'git status' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: 'stat-tools' })
  await ui.press({ key: 'drill-all:Bash' })
  // Quiet pages have no tabs: step back to the conversation list first.
  await ui.press({ key: 'back' })
  await ui.press({ key: 'back' })
  await ui.press({ key: 'tab-sounds' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(texts).toContain('提示音')
  expect(texts).not.toContain('调用列表')
  expect(await ui.find({ type: 'Button', key: 'sound-isOn' })).toBeDefined()

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
  // The cut says why it is a cut, not a wrapping row.
  expect(tool?.notes[0]?.summary).toContain('已达存储上限 200 字')
  expect(tool?.notes[0]?.detail).toContain('已达存储上限 2,000 字')
  expect(tool?.notes[0]?.result).toContain('已达存储上限 400 字')
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

/** The engine's own context reading: the window, and the fill it last measured. */
function measuring(on: On, tokens: number | undefined, window = 1_000_000) {
  on('session.usage', () => ({
    value: { startedAt: 0, context: tokens === undefined ? { window } : { tokens, window }, rateLimits: [] },
  }))
}

const RAIL_USAGE = {
  model: 'opus',
  input_tokens: 120_000,
  output_tokens: 8_000,
  cache_read_input_tokens: 340_000,
  cache_creation_input_tokens: 21_000,
}

/** One settled round, the hooks it needs, and the conversation tab. */
async function settled($: Engine, on: On) {
  worked(on)
  on('turn.complete', () => ({ text: 'ok' }))
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer', usage: RAIL_USAGE })
}

async function mountAt($: Engine, columns: number) {
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })

  return ui
}

async function conversationOf($: Engine, on: On, columns = 100) {
  await settled($, on)

  return await mountAt($, columns)
}

test('the session rail writes its tokens in K and names the context', async ($, on) => {
  measuring(on, 620_000)
  const ui = await conversationOf($, on)

  const label = String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')

  expect(label).toContain('入 120K')
  expect(label).toContain('出 8K')
  expect(label).toContain('缓存读 340K')
  expect(label).toContain('缓存写 21K')
  expect(label).toContain('CTX 62%')

  await ui.unmount()
})

test('the context reading changes colour at 70 and 90', async ($, on) => {
  measuring(on, 620_000)
  on('session.measure', () => ({ changed: ['context'] }))

  const ui = await conversationOf($, on)

  const reading = async () => {
    const texts = (await ui.findAll({ type: 'Text' })) as { text?: string; props?: { color?: string } }[]

    return texts.find(one => String(one.text ?? '').startsWith('CTX ') && one.props?.color !== undefined)
  }

  expect((await reading())?.text).toContain('CTX 62%')
  expect((await reading())?.props?.color).toBe('subtle')

  await $.session.measure({ context: { tokens: 700_000, window: 1_000_000 }, rateLimits: [], changed: ['context'] })
  expect((await reading())?.text).toContain('CTX 70%')
  expect((await reading())?.props?.color).toBe('warning')

  await $.session.measure({ context: { tokens: 900_000, window: 1_000_000 }, rateLimits: [], changed: ['context'] })
  expect((await reading())?.text).toContain('CTX 90%')
  expect((await reading())?.props?.color).toBe('error')

  await ui.unmount()
})

test('a narrow rail drops the context before it shortens its labels', async ($, on) => {
  measuring(on, 620_000)
  await settled($, on)

  const labelAt = async (columns: number) => {
    const ui = await mountAt($, columns)
    const label = String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')

    await ui.unmount()

    return label
  }
  const fits = (label: string, columns: number) => expect(cellsOf(label)).toBeLessThanOrEqual(columns - 8)

  const wideLabel = await labelAt(100)
  expect(wideLabel).toContain('CTX 62%')
  expect(wideLabel).toContain('缓存读')
  fits(wideLabel, 100)

  const tightLabel = await labelAt(72)
  expect(tightLabel).not.toContain('CTX')
  expect(tightLabel).toContain('缓存读')
  fits(tightLabel, 72)

  const shortLabel = await labelAt(60)
  expect(shortLabel).not.toContain('CTX')
  expect(shortLabel).toContain('读 340K')
  expect(shortLabel).not.toContain('缓存读')
  fits(shortLabel, 60)

  // Narrower than the short form: the row keeps its head and is cut, never wrapped.
  const clippedLabel = await labelAt(40)
  expect(clippedLabel).not.toContain('CTX')
  expect(clippedLabel).toContain('入 120K')
  fits(clippedLabel, 40)
})

test('the model drill writes its tokens in K and never a percentage', async ($, on) => {
  measuring(on, 620_000)
  const ui = await conversationOf($, on)

  await ui.press({ key: 'stat-models' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('入 120K')
  expect(page).toContain('出 8K')
  expect(page).not.toContain('%')

  await ui.unmount()
})

/** The engine's usage as the rail reads it: context, the ledger and the windows. */
function metered(
  on: On,
  reading: () => { tokens?: number; window?: number; usd?: number; limits?: { kind: string; percentUsed: number }[] },
) {
  on('session.usage', () => {
    const one = reading()
    const window = one.window ?? 1_000_000

    return {
      value: {
        startedAt: 0,
        context: one.tokens === undefined ? { window } : { tokens: one.tokens, window },
        rateLimits: one.limits ?? [],
        ...(one.usd === undefined ? {} : { cost: { usd: one.usd } }),
      },
    }
  })
}

async function railLabelAt($: Engine, columns: number) {
  const ui = await mountAt($, columns)
  const label = String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')

  await ui.unmount()

  return label
}

test('the rail ends with the context, the quota windows and the cost', async ($, on) => {
  worked(on)
  on('turn.complete', () => ({ text: 'ok' }))
  metered(on, () => ({
    tokens: 620_000,
    usd: 0.42,
    limits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 61 }],
  }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer', usage: RAIL_USAGE })

  const label = await railLabelAt($, 140)

  expect(label).toContain('· CTX 62% · 5h 38% · 7d 61% · $0.42')
})

test('a host without a ledger reads a dash, and a missing window is left out', async ($, on) => {
  worked(on)
  on('turn.complete', () => ({ text: 'ok' }))
  metered(on, () => ({ tokens: 620_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer', usage: RAIL_USAGE })

  const label = await railLabelAt($, 140)

  expect(label).toContain('$—')
  expect(label).not.toContain('5h')
  expect(label).not.toContain('7d')
  expect(label).not.toContain('0%')
})

test('the rail drops cost, then seven days, then five hours, before the context', () => {
  const reading = { text: '62%', tone: 'subtle' as const }
  const meter = {
    usd: 0.42,
    rateLimits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 61 }],
  }
  const ctxText = ' · CTX 62%'
  const fiveText = ' · 5h 38%'
  const sevenText = ' · 7d 61%'
  const usdText = ' · $0.42'
  const head = '6 轮 · 1 个模型  入 120K · 出 8K · 缓存读 340K · 缓存写 21K'
  const keysAt = (room: number) => railOf(head, head, reading, meter, room).parts.map(one => one.key)
  const whole = cellsOf(head) + cellsOf(ctxText) + cellsOf(fiveText) + cellsOf(sevenText) + cellsOf(usdText)

  expect(keysAt(whole)).toEqual(['ctx', 'five_hour', 'seven_day', 'usd'])
  expect(keysAt(whole - 1)).toEqual(['ctx', 'five_hour', 'seven_day'])
  expect(keysAt(whole - 1 - cellsOf(sevenText) - 1)).toEqual(['ctx', 'five_hour'])
  expect(keysAt(whole - 1 - cellsOf(sevenText) - cellsOf(fiveText) - 1)).toEqual(['ctx'])
  expect(keysAt(whole - 1 - cellsOf(sevenText) - cellsOf(fiveText) - cellsOf(ctxText) - 1)).toEqual([])
})

test('at 80, 64 and 48 columns the rail never overflows, and drops from the right', async ($, on) => {
  worked(on)
  on('turn.complete', () => ({ text: 'ok' }))
  metered(on, () => ({
    tokens: 620_000,
    usd: 0.42,
    limits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 61 }],
  }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await typed($, '先跑几个命令')
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer', usage: RAIL_USAGE })

  for (const columns of [80, 64, 48]) {
    const label = await railLabelAt($, columns)

    expect(cellsOf(label)).toBeLessThanOrEqual(columns - 8)
    // Whatever survived keeps the left-to-right order: a later part never outlives
    // an earlier one.
    const at = (part: string) => label.indexOf(part)
    const order = ['CTX', '5h', '7d', '$'].filter(part => at(part) !== -1)

    expect(order).toEqual(['CTX', '5h', '7d', '$'].slice(0, order.length))
  }
})

