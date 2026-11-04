import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { fold, rowsOf } from './format'

/**
 * A detail that folds its long bodies to the screen, and opens one whole on
 * request — while the tools, the cost and the end stay where the eye expects them.
 */

/** A pane at a known height, so half a screen is a number the test can hold. */
function pane(bodyRows: number) {
  return {
    plugin: 'bench',
    component: 'Pane',
    requestId: 'bench',
    props: { title: '开发者工作台', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} },
  } as const
}

function quiet(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  on('fs.stat', () => ({ value: { kind: 'other', size: 0, isLink: false, mtimeMs: 0 } }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('turn.start', () => ({ turnId: 'turn-1' }))
  on('turn.complete', () => ({ text: '' }))
}

const lines = (count: number, prefix = '第') => Array.from({ length: count }, (_, at) => `${prefix}${at + 1}行`)

/** Every text the pane draws, joined; the detail prints a field's value twice, which is fine here. */
/** The key of the first conversation row, which is the round this test opened. */
async function rowKey(ui: { findAll: (q: { type: string }) => Promise<unknown[]> }): Promise<string> {
  const keys = ((await ui.findAll({ type: 'Button' })) as { props: { key?: string } }[]).map(one => String(one.props.key ?? ''))
  const found = keys.find(key => key.startsWith('row-'))

  if (found === undefined) {
    throw new Error('no conversation row was drawn')
  }

  return found
}

async function textsOf(ui: { findAll: (q: { type: string }) => Promise<unknown[]> }): Promise<string> {
  const found = (await ui.findAll({ type: 'Text' })) as { text?: string }[]

  return found.map(one => String(one.text ?? '')).join('\n')
}

// ------------------------------------------------------------------ the measure

test('a line takes the rows its cells need', () => {
  expect(rowsOf('abc', 10)).toBe(1)
  // A CJK glyph is two cells: twenty of them over ten columns take four rows.
  expect(rowsOf('中文中文中文中文中文中文中文中文中文中文', 10)).toBe(4)
  // An empty line still takes one row.
  expect(rowsOf('', 10)).toBe(1)
})

test('folding keeps whole lines until the budget runs out', () => {
  const kept = fold(['a', 'b', 'c', 'd'], 2, 80)

  expect(kept.shown).toEqual(['a', 'b'])
  expect(kept.total).toBe(4)
})

test('a line taller than the budget is still shown once', () => {
  const kept = fold(['一条非常非常非常长的中文内容'.repeat(20)], 2, 10)

  expect(kept.shown).toHaveLength(1)
  expect(kept.total).toBe(1)
})

// ------------------------------------------------------------------ the pane

test('a short round is drawn whole, with no fold mark and no buttons', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '短输入' })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 800, answer: '短回答', isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(24), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })

  const text = await textsOf(ui)

  expect(text).toContain('短输入')
  expect(text).toContain('短回答')
  expect(text).not.toContain('查看全部')
  expect(await ui.find({ type: 'Button', key: 'full-input' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'full-answer' })).toBeUndefined()

  await ui.unmount()
})

test('a long answer folds to half the screen, and the end still shows', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '写个长报告' })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 3_000, answer: lines(200, '答').join('\n'), isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })

  // 40 rows → the answer may take 20; the fold says how many of the 200 it kept.
  expect((await ui.find({ type: 'Text', text: /共 200 行，已显示 \d+ 行/ }))?.text).toContain('共 200 行')
  expect(await ui.find({ type: 'Button', key: 'full-answer' })).toBeDefined()
  // The tail is drawn after the folded body, so it stays inside one screen.
  expect(await textsOf(ui)).toContain('结束')

  await ui.unmount()
})

test('a long input folds to six lines', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: lines(30).join('\n') })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 500, answer: '好', isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(60), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })

  expect((await ui.find({ type: 'Text', text: /共 30 行，已显示 6 行/ }))?.text).toContain('已显示 6 行')
  expect(await ui.find({ type: 'Button', key: 'full-input' })).toBeDefined()

  await ui.unmount()
})

test('the whole answer opens on request, and steps back to the detail', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '写个长报告' })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 3_000, answer: lines(200, '答').join('\n'), isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })
  await ui.press({ key: 'full-answer' })

  // The whole body, under its own heading, with the way back.
  expect((await ui.find({ type: 'Text', text: /── 回答（共 200 行）/ }))?.text).toContain('共 200 行')
  expect(await ui.find({ type: 'Button', key: 'full-detail-back' })).toBeDefined()
  expect((await textsOf(ui)).split('\n').some(row => row === '答200行')).toBe(true)

  await ui.press({ key: 'full-detail-back' })

  // Back on the detail: the fold is there again, and no full body.
  expect(await ui.find({ type: 'Text', text: /共 200 行，已显示/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'full-detail-back' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  await ui.unmount()
})

test('b steps back from the whole body to the detail, then to the list', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '写个长报告' })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 3_000, answer: lines(200, '答').join('\n'), isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })
  await ui.press({ key: 'full-answer' })
  expect(await ui.find({ type: 'Button', key: 'full-detail-back' })).toBeDefined()

  // `b` is the same door the button opens: the engine reports the element that took it.
  await ui.press({ key: 'full-detail-back' })
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()

  await ui.unmount()
})

test('the whole-body view is the whole pane: no tabs to wander off by', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '写个长报告' })
  await $.turn.complete({ turnId: 'turn-1', reason: 'answer', durationMs: 3_000, answer: lines(200, '答').join('\n'), isAborted: false } as never)

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })
  await ui.press({ key: 'full-answer' })

  expect(await ui.find({ type: 'Button', key: 'full-detail-back' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'tab-mcp' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()

  await ui.unmount()
})
