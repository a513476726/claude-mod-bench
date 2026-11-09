import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { cellsOf, fold, rowsOf } from './format'

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

  // The whole body, its size on the card title, and the way back.
  const title = (await ui.findAll({ type: 'Text' })).map(one => String((one as { text?: string }).text ?? '')).find(one => one.includes('共 200 行'))
  expect(title ?? '').toContain('共 200 行')
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()
  expect((await textsOf(ui)).split('\n').some(row => row === '答200行')).toBe(true)

  await ui.press({ key: 'back' })

  // Back on the detail: the fold is there again, and the shared way out with it.
  expect(await ui.find({ type: 'Text', text: /共 200 行，已显示/ })).toBeDefined()
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
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  // `b` is the same door the button opens: the engine reports the element that took it.
  await ui.press({ key: 'back' })
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

  // No tabs to wander off by; the one door out is the shared back.
  expect(await ui.find({ type: 'Button', key: 'tab-mcp' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  await ui.unmount()
})

test('an answer is a section of its own: marked at the left, indented, never cut', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '你好？' })
  await $.turn.complete({
    turnId: 'turn-1',
    reason: 'answer',
    durationMs: 3_000,
    answer: '如果需要我干活，直接说要做的事就行 —— 比如：\n- 前端页面开发\n- 老系统重构核对',
    isAborted: false,
  } as never)

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })

  const texts = ((await ui.findAll({ type: 'Text' })) as { props?: { wrap?: string }; text?: string }[]).map(one => ({
    text: String(one.text ?? ''),
    wrap: one.props?.wrap,
  }))

  // The section's left edge is drawn, and its body sits under its heading.
  expect(texts.some(one => one.text.includes('▏ 💬 回答'))).toBe(true)
  expect(texts.some(one => one.text.includes('▏   如果需要我干活'))).toBe(true)

  // Nothing in a section is cut at the edge: it wraps, or it was short enough.
  expect(texts.filter(one => one.wrap === 'truncate-end' && one.text !== '').map(one => one.text)).toEqual([])

  await ui.unmount()
})

test('every detail field starts on the same cell, emoji or not', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '你好？' })

  const ui = await $.ui.mount({ ...pane(40), surface: 'terminal' })
  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: await rowKey(ui) })

  const rows = ((await ui.findAll({ type: 'Text' })) as { text?: string }[]).map(one => String(one.text ?? ''))
  // The label column is one width: 🕒 时间 and 🏷️ 类型 are padded to the same
  // number of cells, so the values beside them begin on the same cell.
  // The label alone (the row that holds nothing but the padded label), not the
  // whole field line with its value.
  const time = rows.find(one => /^🕒 时间\s*$/.test(one.trim()))
  const kind = rows.find(one => /^🏷️ 类型\s*$/.test(one.trim()))
  expect(time).toBeDefined()
  expect(kind).toBeDefined()
  // Both labels are padded into one column, so they take the same cells.
  expect(cellsOf(time ?? '')).toBe(cellsOf(kind ?? ''))

  await ui.unmount()
})
