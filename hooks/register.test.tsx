import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { cellsOf } from './format'

const PANE = {
  plugin: 'bench',
  component: 'Pane',
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** The engine, standing still: no change folder, no MCP call. */
function quiet(on: On, onOpen?: () => void) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => {
    onOpen?.()

    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/nowhere' }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  // One repo with no openspec/: the first-run page every project starts on.
  on('fs.stat', (_, e) =>
    e.path === '/nowhere' || e.path === '/nowhere/.git'
      ? { value: { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 } }
      : { deny: 'ENOENT' },
  )
  on('fs.list', () => ({ value: [] }))
}

test('the pane draws its titles and says when there is nothing to show', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Button', ...{ key: 'tab-spec' } })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'tab-more' })).toBeDefined()

    await ui.unmount()
  }
})

test('the four tabs carry the four hotkeys, and no old tab survives', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Button', key: 'tab-conversation' }))?.props?.hotkey).toBe('1')

  // A selected tab is plain; the other three keep their bracketed hotkey.
  await ui.press({ key: 'tab-conversation' })

  expect((await ui.find({ type: 'Button', key: 'tab-spec' }))?.props?.hotkey).toBe('2')
  expect((await ui.find({ type: 'Button', key: 'tab-agent' }))?.props?.hotkey).toBe('3')
  expect((await ui.find({ type: 'Button', key: 'tab-more' }))?.props?.hotkey).toBe('4')

  expect(await ui.find({ type: 'Button', key: 'tab-mcp' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'tab-sounds' })).toBeUndefined()

  // The agent page is a skeleton until iteration 4: an empty state, never a fake row.
  await ui.press({ key: 'tab-agent' })
  expect(await ui.find({ type: 'Text', text: /本会话还没有子代理/ })).toBeDefined()

  await ui.unmount()
})

test('an MCP call is kept under the server that served it', async ($, on) => {  quiet(on)
  on('tool.call', () => ({ result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__oracle-apex__oracle_query',
    tool_use_id: 'call-1',
    query: 'SELECT * FROM APP.ORDERS',
    mcp: { name: 'oracle-apex', source: 'user' },
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // MCP is a door on the conversation page now: the server, its calls, then the call.
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: 'stat-mcp' })

  expect(await ui.find({ type: 'Button', key: 'drill-mcp:oracle-apex' })).toBeDefined()

  await ui.press({ key: 'drill-mcp:oracle-apex' })
  await ui.press({ key: 'drill-mcp:oracle-apex:call-1' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(texts).toContain('参数')
  expect(texts).toContain('oracle-apex')

  // Back up one level at a time: the calls, the servers, then the conversation list.
  await ui.press({ key: 'back' })
  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('oracle-apex · 1 次')

  await ui.press({ key: 'back' })
  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('MCP · 1 个服务器')

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'stat-mcp' })).toBeDefined()

  await ui.unmount()
})

test('a built-in tool is not kept as an MCP call', async ($, on) => {
  quiet(on)
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'call-2', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: 'stat-mcp' })

  // A built-in call is not an MCP call: the server list stays empty of it.
  const empty = await ui.find({ type: 'Text', text: /本次会话没有 MCP 调用/ })

  expect(empty?.text).toContain('本次会话没有 MCP 调用')

  await ui.unmount()
})

/** Two shelves on a virtual disk: paths to their text, and every write recorded. */
function shelfWorld(on: On, files: Map<string, string>, writes: string[] = []) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/tester' }))
  on('fs.stat', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_, e) => (files.has(e.path) ? { value: files.get(e.path) as string } : { deny: 'ENOENT' }))
  on('fs.write', (_, e) => {
    files.set(e.path, e.text)
    writes.push(e.path)

    return { value: undefined }
  })

  return writes
}

test('a --project add writes the project shelf, and the same words may live on both', async ($, on) => {
  const files = new Map<string, string>()
  const writes = shelfWorld(on, files)

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

  const globalAdd = await $.command.run({ command: 'panel-prompt-add', args: '共同话术' } as never)
  const projectAdd = await $.command.run({ command: 'panel-prompt-add', args: '--project 共同话术' } as never)
  const again = await $.command.run({ command: 'panel-prompt-add', args: '--project 共同话术' } as never)

  expect(globalAdd.text).toBe('已收藏：共同话术')
  expect(projectAdd.text).toBe('已收藏（项目）：共同话术')
  expect(again.text).toBe('已存在：共同话术')

  const globalText = files.get('/home/tester/.claude/bench-prompts.json') ?? ''
  const projectText = files.get('/proj/.bench/prompts.json') ?? ''

  expect(globalText).toContain('"scope": "global"')
  expect(projectText).toContain('"scope": "project"')
  expect(writes.filter(one => one.endsWith('bench-prompts.json'))).toHaveLength(1)
  expect(writes.filter(one => one.endsWith('/.bench/prompts.json'))).toHaveLength(1)
})

test('a broken project shelf leaves the global shelf readable, and is not overwritten', async ($, on) => {
  const files = new Map<string, string>([
    [
      '/home/tester/.claude/bench-prompts.json',
      '{"version":2,"prompts":[{"id":"a","text":"全局话术","copies":2,"launches":1,"scope":"global","createdAt":1}]}',
    ],
    ['/proj/.bench/prompts.json', '{not json'],
  ])
  const writes = shelfWorld(on, files)

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-more' })
  await ui.press({ key: 'more:more-prompts' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('全局话术')
  expect(page).toContain('全局')
  expect(page).toContain('项目收藏读取失败')
  expect(writes).toHaveLength(0)

  await ui.unmount()
})

test('the band says what is still owed and opens the pane', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 620_000, window: 1_000_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({
    plugin: 'bench',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 1, bodyColumns: 80, scroll: { offset: 0, bodyRows: 1 }, view: {} },
    surface: 'terminal',
  })

  const open = await band.find({ type: 'Button', key: 'band-open' })

  expect(open).toBeDefined()
  // Nothing is owed and no agent runs: the band is the context reading alone.
  expect((await band.find({ type: 'Text', text: /CTX 62%/ }))?.text).toContain('CTX 62%')
  expect((await band.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('')).not.toContain('待收尾 0')

  await band.unmount()
})

/** The session's own reading of its window: what the status line shows, pushed. */
function measuring(on: On, reading: () => { tokens?: number; window: number }) {
  on('session.usage', () => ({ value: { startedAt: 0, context: reading(), rateLimits: [] } }))
}

const BAND = {
  plugin: 'bench',
  component: 'AbovePrompt' as const,
  surface: 'terminal' as const,
}

/** The saved prompts live under the person's home; the test's home is fixed. */
function promptHome(on: On, file: string | null | (() => string | null)) {
  on('env.get', () => ({ value: '/home/tester' }))
  on('fs.read', (_, e) => {
    // The project shelf is a different file; these tests keep it empty.
    if (e.path.endsWith('/.bench/prompts.json')) {
      return { deny: 'ENOENT' }
    }

    const text = typeof file === 'function' ? file() : file

    return text === null ? { deny: 'ENOENT' } : { value: text }
  })
}

test('the add command saves one prompt and refuses an exact duplicate', async ($, on) => {
  let opens = 0

  quiet(on, () => {
    opens += 1
  })

  // The add writes the file and the next add reads that file back, as at home.
  let shelf: string | null = null

  promptHome(on, () => shelf)

  const written: { path?: string; text?: string } = {}

  on('fs.write', (_, e) => {
    shelf = e.text
    written.path = e.path
    written.text = e.text

    return { value: undefined }
  })

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const openedAtStart = opens
  const first = await $.command.run({ command: 'panel-prompt-add', args: '  帮我做评审  ' } as never)

  expect(first.text).toBe('已收藏：帮我做评审')
  expect(written.path).toBe('/home/tester/.claude/bench-prompts.json')
  expect(written.text).toContain('帮我做评审')

  const again = await $.command.run({ command: 'panel-prompt-add', args: '帮我做评审' } as never)

  expect(again.text).toBe('已存在：帮我做评审')
  expect(opens).toBe(openedAtStart)
})

test('the add command explains itself when no text came', async ($, on) => {
  quiet(on)
  promptHome(on, null)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const bare = await $.command.run({ command: 'panel-prompt-add', args: '   ' } as never)

  expect(bare.text).toContain('用法')
})

test('the file is read at the start, so a saved prompt is already known', async ($, on) => {
  quiet(on)
  promptHome(on, '{"version":1,"prompts":[{"id":"a","text":"已有","copies":2,"createdAt":1}]}')
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const again = await $.command.run({ command: 'panel-prompt-add', args: '已有' } as never)

  expect(again.text).toBe('已存在：已有')
})

test('an add after a /clear keeps what the file holds, not the empty state', async ($, on) => {
  quiet(on)
  promptHome(on, '{"version":1,"prompts":[{"id":"a","text":"已有","copies":2,"createdAt":1}]}')

  let written = ''

  on('fs.write', (_, e) => {
    written = e.text

    return { value: undefined }
  })

  // No session.start: a /clear ends the session and starts another with no start
  // hook after it, so the shelf the first session read is gone and the file alone
  // still holds 「已有」.
  const added = await $.command.run({ command: 'panel-prompt-add', args: '新的' } as never)

  expect(added.text).toBe('已收藏：新的')
  expect(written).toContain('已有')
  expect(written).toContain('新的')
})

test('a broken file reads as none, and the next add writes a sound one', async ($, on) => {
  quiet(on)
  promptHome(on, '{not json')

  let written = ''

  on('fs.write', (_, e) => {
    written = e.text

    return { value: undefined }
  })

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const added = await $.command.run({ command: 'panel-prompt-add', args: '新的' } as never)

  expect(added.text).toBe('已收藏：新的')
  expect(written).toContain('新的')
  expect(written).not.toContain('{not json')
})

async function bandAt($: Engine, columns: number) {
  return await $.ui.mount({
    ...BAND,
    props: { hasSurvey: false, isWorking: false, maxRows: 1, bodyColumns: columns, scroll: { offset: 0, bodyRows: 1 }, view: {} },
  })
}

test('the band says how full the context window is, from the session’s own reading', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 620_000, window: 1_000_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await bandAt($, 80)

  expect((await band.find({ type: 'Text', text: /CTX 62%/ }))?.text).toContain('CTX 62%')

  await band.unmount()
})

test('a measurement moves the band without another turn', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 400_000, window: 1_000_000 }))
  on('session.measure', () => ({ changed: ['context'] }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await bandAt($, 80)

  expect((await band.find({ type: 'Text', text: /CTX 40%/ }))?.text).toContain('CTX 40%')

  await $.session.measure({ context: { tokens: 700_000, window: 1_000_000 }, rateLimits: [], changed: ['context'] })

  expect((await band.find({ type: 'Text', text: /CTX 70%/ }))?.text).toContain('CTX 70%')

  await band.unmount()
})

test('a turn’s end refreshes the reading where no measurement came', async ($, on) => {
  quiet(on)
  on('turn.complete', () => ({ text: 'ok' }))

  let tokens = 400_000

  measuring(on, () => ({ tokens, window: 1_000_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await bandAt($, 80)

  expect((await band.find({ type: 'Text', text: /CTX 40%/ }))?.text).toContain('CTX 40%')

  tokens = 620_000

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer' })

  expect((await band.find({ type: 'Text', text: /CTX 62%/ }))?.text).toContain('CTX 62%')

  await band.unmount()
})

test('the band’s context reading is text, not a door', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 620_000, window: 1_000_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await bandAt($, 80)
  const buttons = (await band.findAll({ type: 'Button' })) as { key?: string; props?: { key?: string; label?: string } }[]

  // One door on the band: the pane. The reading opens nothing.
  expect(buttons).toHaveLength(1)
  expect(String(buttons[0]?.props?.key ?? buttons[0]?.key ?? '')).toBe('band-open')

  await band.unmount()
})

test('the band colours the context reading like the rail', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 620_000, window: 1_000_000 }))
  on('session.measure', () => ({ changed: ['context'] }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await bandAt($, 80)
  const reading = async () =>
    ((await band.findAll({ type: 'Text' })) as { text?: string; props?: { color?: string } }[]).find(
      one => String(one.text ?? '').includes('CTX') && one.props?.color !== undefined,
    )

  expect((await reading())?.props?.color).toBe('subtle')

  await $.session.measure({ context: { tokens: 900_000, window: 1_000_000 }, rateLimits: [], changed: ['context'] })

  expect((await reading())?.props?.color).toBe('error')

  await band.unmount()
})

/** One repo whose only change has every task ticked: the band owes one archive. */
function readyBand(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/ws/app' }))
  on('session.root', () => ({ value: '/ws/app' }))
  on('env.get', () => ({ value: '/home/tester' }))
  on('fs.stat', (_, e) => {
    const dirs = [
      '/ws',
      '/ws/app',
      '/ws/app/.git',
      '/ws/app/openspec',
      '/ws/app/openspec/changes',
      '/ws/app/openspec/changes/ready-one',
    ]

    return dirs.includes(e.path)
      ? { value: { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 } }
      : { deny: 'ENOENT' }
  })
  on('fs.list', (_, e) => {
    if (e.path === '/ws') return { value: [{ name: 'app', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    if (e.path === '/ws/app') return { value: [{ name: 'openspec', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    if (e.path === '/ws/app/openspec/changes') {
      return { value: [{ name: 'ready-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 50 }] }
    }
    if (e.path.endsWith('ready-one')) {
      return {
        value: [
          { name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
          { name: 'proposal.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
        ],
      }
    }

    return { value: [] }
  })
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.git/HEAD')) return { value: 'ref: refs/heads/main\n' }
    if (e.path.endsWith('ready-one/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('proposal.md')) return { value: '# x\n' }

    return { value: '' }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 620_000, window: 1_000_000 }, rateLimits: [] } }))
  on('config.list', () => ({ value: [] }))
}

test('a tight band sheds the owed count before it sheds the context', async ($, on) => {
  readyBand(on)

  await $.session.start({ cwd: '/ws/app', surface: 'terminal', isInteractive: true })

  const lineOf = async (columns: number) => {
    const band = await bandAt($, columns)
    const line = (await band.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('')

    await band.unmount()

    return line
  }

  for (const columns of [80, 64, 40]) {
    const line = await lineOf(columns)

    expect(line).toContain('待收尾 1')
    expect(line).toContain('CTX 62%')
    expect(line).not.toContain('代理 0')
  }

  // At 24 columns only the reading the batch cannot do without survives.
  const ctxOnly = await lineOf(24)
  expect(ctxOnly).not.toContain('待收尾')
  expect(ctxOnly).toContain('CTX 62%')
})

/** The engine's usage as the pane reads it: context, ledger and windows together. */
function usageReading(
  on: On,
  reading: () => { tokens?: number; usd?: number; limits?: { kind: string; percentUsed: number }[] },
) {
  on('session.usage', () => {
    const one = reading()

    return {
      value: {
        startedAt: 0,
        context: one.tokens === undefined ? { window: 1_000_000 } : { tokens: one.tokens, window: 1_000_000 },
        rateLimits: one.limits ?? [],
        ...(one.usd === undefined ? {} : { cost: { usd: one.usd } }),
      },
    }
  })
}

/** The conversation rail's own words, at a width that fits them all. */
async function railLabel($: Engine, columns = 140) {
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })

  const label = String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')

  await ui.unmount()

  return label
}

test('a session’s start reads the cost and quota beside the context', async ($, on) => {
  quiet(on)
  usageReading(on, () => ({
    tokens: 620_000,
    usd: 0.42,
    limits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 61 }],
  }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const label = await railLabel($)

  expect(label).toContain('CTX 62%')
  expect(label).toContain('5h 38%')
  expect(label).toContain('7d 61%')
  expect(label).toContain('$0.42')
})

test('a measurement moves the cost and quota with the context', async ($, on) => {
  quiet(on)
  usageReading(on, () => ({ tokens: 620_000, usd: 0.42, limits: [{ kind: 'five_hour', percentUsed: 38 }] }))
  on('session.measure', () => ({ changed: ['context', 'rateLimits', 'cost'] }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 140 }, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })

  const labelOf = async () => String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')

  expect(await labelOf()).toContain('$0.42')

  await $.session.measure({
    context: { tokens: 700_000, window: 1_000_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 80 }],
    cost: { usd: 1.2 },
    changed: ['context', 'rateLimits', 'cost'],
  } as never)

  const label = await labelOf()

  expect(label).toContain('CTX 70%')
  expect(label).toContain('5h 80%')
  expect(label).toContain('$1.20')

  await ui.unmount()
})

test('a turn’s end re-reads the ledger where no measurement came', async ($, on) => {
  quiet(on)
  on('turn.complete', () => ({ text: 'ok' }))

  let usd = 0.42

  usageReading(on, () => ({ tokens: 620_000, usd }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 140 }, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })

  expect(String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')).toContain('$0.42')

  usd = 2.1
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-1', reason: 'answer' })

  expect(String((await ui.find({ type: 'Button', key: 'stat-models' }))?.props?.label ?? '')).toContain('$2.10')

  await ui.unmount()
})

test('a host without a ledger keeps the dash and never invents a window', async ($, on) => {
  quiet(on)
  usageReading(on, () => ({ tokens: 620_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const label = await railLabel($)

  expect(label).toContain('$—')
  expect(label).not.toContain('5h')
  expect(label).not.toContain('7d')
  expect(label).not.toContain('0%')
})

/** A spawn the test can start, and the roster the page reads. */
function spawning(on: On, id: string, type = 'Explore', description = '看依赖树') {
  on('agent.spawn', () => ({ agentId: id, model: 'haiku' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: 'ok' }))
}

async function textsIn(ui: { findAll: (query: { type: string }) => Promise<unknown[]> }) {
  const found = (await ui.findAll({ type: 'Text' })) as { text?: unknown }[]

  return found.map(one => String(one.text ?? '')).join('\n')
}

test('a spawn opens a row, its round and tools update it, and the main turns stay clean', async ($, on) => {
  quiet(on)
  spawning(on, 'a1')

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't', prompt: 'go', description: '看依赖树', subagentType: 'Explore' } as never)

  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'a.ts', agentId: 'a1' } as never)
  await $.turn.start({ turnId: 't1', agentId: 'a1', text: '' } as never)
  await $.turn.complete({ turnId: 't1', agentId: 'a1', reason: 'answer', answer: '看完了', usage: undefined } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-agent' })

  const page = await textsIn(ui)

  expect(page).toContain('完成')
  expect(page).toContain('Explore')
  expect(page).toContain('工具 1')

  // A subagent's round is not the person's: the conversation stays empty.
  await ui.press({ key: 'tab-conversation' })
  expect(await textsIn(ui)).toContain('本会话还没有对话')

  await ui.unmount()
})

test('engine list fills a gap and never deletes a local row', async ($, on) => {
  quiet(on)
  on('agent.spawn', () => ({ agentId: 'gone', model: 'haiku' }))
  on('agent.list', () => ({
    value: [{ id: 'new', type: 'Plan', description: '引擎里的新代理', status: 'running', parentId: undefined }],
  }))
  on('turn.complete', () => ({ text: 'ok' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't', prompt: 'go', description: '本地行', subagentType: 'Explore' } as never)
  await $.turn.complete({ turnId: 't', agentId: 'gone', reason: 'answer', answer: '好了' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-agent' })

  const page = await textsIn(ui)

  expect(page).toContain('本地行')
  expect(page).toContain('完成')
  expect(page).toContain('引擎里的新代理')

  await ui.unmount()
})

test('an agent detail reads its transcript and offers no way to steer it', async ($, on) => {
  quiet(on)
  spawning(on, 'a1')
  on('session.messages', () => ({ value: [{ role: 'assistant', text: '摘录一', toolUses: [] }] }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't', prompt: 'go', description: '看依赖树', subagentType: 'Explore' } as never)
  await $.turn.complete({ turnId: 't', agentId: 'a1', reason: 'answer', answer: '最后的回答' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-agent' })
  await ui.press({ key: 'row-a1' })

  const page = await textsIn(ui)

  expect(page).toContain('类型')
  expect(page).toContain('最后输出')
  expect(page).toContain('最后的回答')
  expect(page).toContain('摘录一')

  const buttons = (await ui.findAll({ type: 'Button' })) as { props?: { key?: string } }[]
  const keys = buttons.map(one => String(one.props?.key ?? ''))

  expect(keys.some(one => /kill|stop|send|restart/i.test(one))).toBe(false)

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'row-a1' })).toBeDefined()

  await ui.unmount()
})

test('a transcript the engine will not hand over says so', async ($, on) => {
  quiet(on)
  spawning(on, 'a1')
  on('session.messages', () => ({ deny: 'no transcript' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't', prompt: 'go', description: '看依赖树', subagentType: 'Explore' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-agent' })
  await ui.press({ key: 'row-a1' })

  expect(await textsIn(ui)).toContain('无法读取该代理的对话')

  await ui.unmount()
})

test('the roster lists three agents with their state, and fits 80, 40 and 24 columns', async ($, on) => {
  quiet(on)
  on('agent.spawn', (_, e) => ({ agentId: String(e.tool_use_id), model: 'haiku' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: 'ok' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  for (const [id, description] of [['a', '看依赖'], ['b', '找测试'], ['c', '写总结']] as const) {
    await $.agent.spawn({ tool_use_id: id, prompt: 'go', description, subagentType: 'Explore' } as never)
  }

  await $.turn.complete({ turnId: 't', agentId: 'c', reason: 'answer', answer: '写完' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-agent' })

  for (const id of ['a', 'b', 'c']) {
    expect(await ui.find({ type: 'Button', key: `row-${id}` })).toBeDefined()
  }

  const page = await textsIn(ui)
  expect(page).toContain('运行')
  expect(page).toContain('完成')
  expect(page).toContain('看依赖')

  await ui.unmount()

  for (const columns of [80, 40, 24]) {
    const narrow = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })

    for (const one of (await narrow.findAll({ type: 'Text' })) as { text?: string }[]) {
      expect(cellsOf(String(one.text ?? ''))).toBeLessThanOrEqual(columns)
    }

    await narrow.unmount()
  }
})

test('a project with no OpenSpec still opens every page with content', async ($, on) => {
  quiet(on)
  measuring(on, () => ({ tokens: 620_000, window: 1_000_000 }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The changes page says what is missing, not blank.
  expect(await textsIn(ui)).toContain('这个项目没有 openspec/changes')

  // The session page still has its readings.
  await ui.press({ key: 'tab-conversation' })
  const session = await textsIn(ui)
  expect(session).toContain('CTX 62%')
  expect(session).toContain('暂无用量')

  // More always has its three doors.
  await ui.press({ key: 'tab-more' })
  expect(await textsIn(ui)).toContain('编辑器')

  await ui.unmount()
})

test('an english environment says the same surfaces in English', async ($, on) => {
  quiet(on)
  on('env.get', () => ({ value: 'en_US.UTF-8' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await textsIn(ui)).toContain('This project has no openspec/changes.')

  await ui.press({ key: 'tab-agent' })
  expect(await textsIn(ui)).toContain('No subagents in this session yet.')

  await ui.unmount()
})

/** A project root the export can write to, and every file written. */
function exportWorld(on: On, stat: (path: string) => boolean, denyWrite = false) {
  const writes: { path: string; text: string }[] = []

  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/tester' }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', (_, e) => (stat(e.path) ? { value: { kind: 'file', size: 1, isLink: false, mtimeMs: 1 } } : { deny: 'ENOENT' }))
  on('fs.write', (_, e) => {
    if (denyWrite) return { deny: 'EACCES' }

    writes.push({ path: e.path, text: e.text })

    return { value: undefined }
  })

  return writes
}

test('the export writes a Markdown report with the warning, never overwriting', async ($, on) => {
  const writes = exportWorld(on, path => path.includes('bench-report-') && !path.endsWith('-2.md'))

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

  const reply = await $.command.run({ command: 'panel-export' } as never)

  expect(writes).toHaveLength(1)
  expect(writes[0]?.path).toMatch(/^\/proj\/bench-report-\d{8}-\d{4}-2\.md$/)
  expect(writes[0]?.text).toContain('# proj · 会话报告')
  expect(reply.text).toContain(writes[0]?.path ?? '')
  expect(reply.text).toContain('报告含完整 prompt 与工具结果，请自行检查敏感信息')
})

test('an export that cannot write says why and does not throw', async ($, on) => {
  exportWorld(on, () => false, true)

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

  const reply = await $.command.run({ command: 'panel-export' } as never)

  expect(reply.text).toContain('导出失败')
})

test('without changes the band is the context reading, and a running agent is counted', async ($, on) => {
  readyBand(on)
  on('agent.spawn', () => ({ agentId: 'a1', model: 'haiku' }))

  await $.session.start({ cwd: '/ws/app', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't', prompt: 'go', description: '跑一下', subagentType: 'Explore' } as never)

  const band = await bandAt($, 80)
  const line = (await band.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('')

  expect(line).toContain('待收尾 1')
  expect(line).toContain('代理 1')

  await band.unmount()
})
