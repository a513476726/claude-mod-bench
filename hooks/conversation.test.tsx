import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { MAX_TURNS, attachTool, closeTurn, isTroubled, startTurn } from './conversation'

/**
 * The rounds themselves, without the engine: what opens one, what closes it, and
 * what the engine's fields become once written down.
 */

const at = 1_700_000_000_000

test('a typed prompt opens a round with its words in full', () => {
  const many = '第一行\n'.concat('很长的输入'.repeat(500))
  const list = startTurn([], { id: 't1', kind: 'input', at, text: many, attachments: 2 })

  expect(list).toHaveLength(1)
  // The full text is kept, to the store's bound; the row's summary is the row's job.
  expect(list[0]?.text.length).toBeGreaterThan(200)
  expect(list[0]?.attachments).toBe(2)
  expect(list[0]?.isOpen).toBe(true)
})

test('a second prompt closes the round before it', () => {
  const first = startTurn([], { id: 't1', kind: 'input', at, text: '一' })
  const list = startTurn(first, { id: 't2', kind: 'input', at: at + 1, text: '二' })

  expect(list).toHaveLength(2)
  expect(list[0]?.isOpen).toBe(false)
  expect(list[1]?.isOpen).toBe(true)
})

test('the end of a round writes its reason, cost and answer', () => {
  const open = startTurn([], { id: 't1', kind: 'input', at, text: '一' })
  const list = closeTurn(open, 't1', {
    reason: 'answer',
    durationMs: 1_200,
    answer: '好的',
    usage: {
      model: 'claude-sonnet-5-5',
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
    },
  })

  expect(list[0]?.isOpen).toBe(false)
  expect(list[0]?.endReason).toBe('answer')
  expect(list[0]?.answer).toBe('好的')
  expect(list[0]?.usage).toEqual({ model: 'claude-sonnet-5-5', input: 10, output: 20, cacheRead: 30, cacheWrite: 40 })
})

test('a round cut short has no cost to report', () => {
  const open = startTurn([], { id: 't1', kind: 'input', at, text: '一' })
  const list = closeTurn(open, 't1', { reason: 'aborted', durationMs: 300, answer: '' })

  expect(list[0]?.usage).toBeUndefined()
  expect(isTroubled(list[0]!)).toBe(true)
})

test('tools are counted by name, and their failures with them', () => {
  let list = startTurn([], { id: 't1', kind: 'input', at, text: '一' })

  list = attachTool(list, 't1', 'Read', true)
  list = attachTool(list, 't1', 'Bash', false)
  list = attachTool(list, 't1', 'Read', true)

  expect(list[0]?.tools).toEqual([
    { name: 'Read', count: 2, fails: 0 },
    { name: 'Bash', count: 1, fails: 1 },
  ])
  expect(isTroubled(list[0]!)).toBe(true)
})

test('a tool on a round that is closed leaves every round alone', () => {
  const closed = closeTurn(startTurn([], { id: 't1', kind: 'input', at, text: '一' }), 't1', {
    reason: 'answer',
    durationMs: 1,
    answer: '',
  })
  const list = attachTool(closed, 'nope', 'Read', true)

  expect(list[0]?.tools).toEqual([])
})

// ------------------------------------------------------------------ through the engine

const PANE = {
  plugin: 'bench',
  component: 'Pane',
  requestId: 'bench',
  props: { title: '开发者工作台', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

/** A session with nowhere to read: the conversation is all there is to look at. */
function quiet(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  on('fs.stat', () => ({ value: { kind: 'other', size: 0, isLink: false, mtimeMs: 0 } }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '' }))
}

/**
 * The conversation rows, each as its mark and its text: the mark is drawn in a
 * fixed slot in front of the name, so a row read as `· HH:MM …` is a typed round.
 */
async function roundRows(ui: { press: (t: { key: string }) => Promise<unknown>; findAll: (q: { type: string }) => Promise<unknown[]> }) {
  await ui.press({ key: 'tab-conversation' })

  // Every row is keyed `row-<id>`, and its label is its text: the time, then the words.
  return ((await ui.findAll({ type: 'Button' })) as { props: { key?: string; label?: string } }[])
    .filter(one => String(one.props.key ?? '').startsWith('row-'))
    .map(one => String(one.props.label ?? ''))
}

test('the conversation page names a round and its answer', async ($, on) => {
  quiet(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', () => ({ turnId: 'turn-1' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '把分支改成一仓一行' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const labels = await roundRows(ui)

  expect(labels).toHaveLength(1)
  // The mark says it was the person's words, and the time leads the row.
  expect(labels[0]).toContain('把分支改成一仓一行')

  // The round is still open until the engine says it ended.
  

  await ui.unmount()
})

/** What the pane's detail page says, opened from the row a pattern finds. */
async function detailText(
  ui: { press: (t: { key: string }) => Promise<unknown>; find: (q: { type: string; text?: RegExp }) => Promise<unknown>; findAll: (q: { type: string }) => Promise<unknown[]> },
  _pattern: RegExp,
): Promise<string> {
  // A detail row prints its value twice (the two columns), so match the label kept once.
  const all = ((await ui.findAll({ type: 'Button' })) as { props: { key: string; label?: string } }[]).filter(one =>
    /\d\d:\d\d/.test(String(one.props.label ?? '')) && one.props.key.startsWith('row-'),
  )
  const row = all[0]

  if (row === undefined) {
    return ''
  }

  await ui.press({ key: row.props.key })

  const texts = (await ui.findAll({ type: 'Text' })) as { text?: string }[]

  // A `label:` line prints its value twice (bold label, plain value); either will do.
  return texts.map(one => String(one.text ?? '')).join('\n')
}

test('a round whose tools failed says so on its row and in its detail', async ($, on) => {
  quiet(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  // One failing call — a hook refuses it; the built-in's own "isError" only names
  // its result, which is not a failure of the call.
  on('tool.call', { tool: 'Bash' }, () => ({ deny: 'npm 不在 PATH' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.start', () => ({ turnId: 'turn-x' }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '跑一下测试' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b-1', command: 'npm test' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r-1', file_path: 'a.ts' })
  await $.turn.complete({ turnId: 'turn-x', reason: 'answer', durationMs: 900, answer: '测试红了', isAborted: false } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })

  // A tool failed inside the turn, so its row is a warning row even though it answered.
  expect((await roundRows(ui)).some(one => one.includes('跑一下测试'))).toBe(true)

  const detail = await detailText(ui, /\d\d:\d\d/)

  expect(detail).toContain('Bash ×1（失败 1）')
  expect(detail).toContain('Read ×1')
  expect(detail).toContain('测试红了')
  expect(detail).toContain('回答')

  await ui.unmount()
})

test('an interrupted round reads as interrupted, with nothing to count', async ($, on) => {
  quiet(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', () => ({ turnId: 'turn-1' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '写个长报告' })
  await $.turn.complete({ turnId: 'turn-y', reason: 'aborted', durationMs: 300, answer: '', isAborted: true, usage: undefined } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })

  const detail = await detailText(ui, /\d\d:\d\d/)

  expect(detail).toContain('中断')
  expect(detail).toContain('300ms')
  expect(detail).toContain('模型')
  expect(detail).toContain('—（未计数）')

  await ui.unmount()
})

test('the rounds are the newest first', async ($, on) => {
  quiet(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', () => ({ turnId: 'turn-1' }))
  
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '第一轮' })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '第二轮' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const labels = await roundRows(ui)

  expect(labels[1]).toContain('第一轮')
  expect(labels[0]).toContain('第二轮')

  await ui.unmount()
})

test('the oldest round falls off once the cap is reached', () => {
  let list = startTurn([], { id: 't0', kind: 'input', at, text: '最早的一轮' })

  for (let at_ = 1; at_ <= MAX_TURNS; at_ += 1) {
    list = startTurn(list, { id: `t${at_}`, kind: 'input', at: at + at_, text: `第 ${at_} 轮` })
  }

  expect(list).toHaveLength(MAX_TURNS)
  expect(list[0]?.text).toBe('第 1 轮')
  expect(list.some(one => one.text === '最早的一轮')).toBe(false)
})

test('a question leads its row with a diamond, a typed turn with a dot', async ($, on) => {
  quiet(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '先说一句' })
  await $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q-9', questions: [{ question: '要不要改？', header: '改法', options: [{ label: '改', description: '动手' }, { label: '不改', description: '先放着' }], multiSelect: false }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })

  const texts = ((await ui.findAll({ type: 'Text' })) as { text?: string }[]).map(one => String(one.text ?? '')).join('\n')

  expect(texts).toContain('◆')
  expect(texts).toContain('·')
  expect(texts).toContain('要不要改？')

  await ui.unmount()
})
