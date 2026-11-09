import { expect, mock, test } from 'claude-code/testing'

import { cellsOf } from './format'
import { ICON, ROUND, SP, bottomEdge, cardRow, footerOf, headOf, innerOf, lineOf, ruleOf, topEdge, widthsOf } from './ui'

test('every edge of a card is exactly as wide as the card', () => {
  for (const columns of [24, 40, 80, 100, 137]) {
    for (const icon of ['', ICON.openspec, ICON.branch]) {
      for (const aside of ['', '4/4 项', 'main', 'develop_20_20261012001']) {
        expect(cellsOf(topEdge('OpenSpec', aside, columns, icon))).toBe(columns)
      }
    }

    expect(cellsOf(bottomEdge(columns))).toBe(columns)
    // A row has no sides: it is the card's width on its own, so nothing beside
    // it can drift when the row is drawn from buttons or two Texts.
    expect(cellsOf(cardRow('一列数据数据 data', columns))).toBe(columns)
    expect(cellsOf(cardRow('', columns))).toBe(columns)
    expect(cellsOf(cardRow('很长很长很长很长很长很长很长很长很长很长', columns))).toBe(columns)
  }
})

test('a chinese title keeps the top edge the card\'s width', () => {
  const edge = topEdge('进行中 · 待归档 · 归档异常 · 无任务清单', '12 项', 80, ICON.openspec)

  expect(cellsOf(edge)).toBe(80)
  // The title starts in from the corner by the card's own margin, as the rows
  // below it do.
  expect(edge.startsWith(`╭─${' '.repeat(SP.inline)}📋 `)).toBe(true)
  expect(edge.endsWith('╮')).toBe(true)
})

test('the aside steps aside before the title does', () => {
  // Too narrow for both words: the title stays, the aside goes.
  const edge = topEdge('提示音', '四个开关', 22, ICON.sounds)

  expect(cellsOf(edge)).toBe(22)
  expect(edge).toContain('提示音')
  expect(edge).not.toContain('四个开关')
})

test('a long title is cut at the edge and never breaks the box', () => {
  const edge = topEdge('fix-signmanager-full-down-payment-20260920-and-then-some-more', '', 40, ICON.openspec)

  expect(cellsOf(edge)).toBe(40)
  expect(edge.endsWith('╮')).toBe(true)
  expect(edge).toContain('…')
})

test('the inner width is the card less its two edges and its padding', () => {
  expect(innerOf(80)).toBe(80 - 2 - SP.inline * 2)
  expect(cellsOf(ruleOf(innerOf(80)))).toBe(innerOf(80))
  expect(headOf('会话')).toBe('─ 会话')
})

test('the footer keeps its button on the right edge of the card', () => {
  const inner = innerOf(80)

  expect(cellsOf(footerOf('4/4 项 · 点行看详情', '[ 展开全部 ]', inner))).toBe(inner)
  // No button, no padding: the words stand as they are.
  expect(footerOf('4/4 项', '', inner)).toBe('4/4 项')
  // A hint too long for the row drops the button rather than overflowing.
  expect(footerOf('一'.repeat(inner), '[ 展开全部 ]', inner)).toBe('一'.repeat(inner))
})

test('a list shares one set of columns between its heading and its rows', () => {
  const cols = [
    { key: 'mark', width: 1 },
    { key: 'done', width: 7, align: 'right' as const },
    { key: 'age', width: 4, align: 'right' as const },
    { key: 'repo', width: 14 },
    { key: 'name' },
  ]
  const inner = innerOf(100)
  const widths = widthsOf(cols, inner)

  // One fill column, at the end, and it takes exactly what is left.
  expect(widths[4]).toBe(inner - 1 - 7 - 4 - 14 - SP.group * 4)
  expect(widths.reduce((sum, one) => sum + one, 0) + SP.group * (cols.length - 1)).toBe(inner)

  const head = lineOf(cols, ['', '任务', '时间', '仓库', '名称'], inner)
  const row = lineOf(cols, ['▸', '1/3', '6d', 'sales-platform', 'doing-one'], inner)

  expect(cellsOf(head)).toBe(inner)
  expect(cellsOf(row)).toBe(inner)
  // Each word starts on the same cell in the heading as its data does.
  const at = (text: string, word: string) => cellsOf(text.slice(0, text.indexOf(word)))
  expect(at(head, '仓库')).toBe(at(row, 'sales-platform'))
  expect(at(head, '名称')).toBe(at(row, 'doing-one'))
})

test('a column that does not fit its width is cut, not pushed into the next', () => {
  const cols = [
    { key: 'mark', width: 1 },
    { key: 'done', width: 7, align: 'right' as const },
    { key: 'age', width: 4, align: 'right' as const },
    { key: 'repo', width: 14 },
    { key: 'name' },
  ]
  const inner = innerOf(100)
  const row = lineOf(cols, ['▸', '1/3', '6d', 'a-very-long-repository-name-that-will-not-fit', 'doing-one'], inner)

  expect(cellsOf(row)).toBe(inner)
  expect(row).toContain('doing-one')
  expect(row).toContain('a-very-long-r…')
})

test('a right-aligned column keeps its numbers on one edge', () => {
  const cols = [{ key: 'done', width: 7, align: 'right' as const }, { key: 'name' }]
  const a = lineOf(cols, ['1/3', 'x'], 40)
  const b = lineOf(cols, ['28/32', 'x'], 40)

  expect(a.indexOf('1/3')).toBe(b.indexOf('28/32') + 2)
})

test('a page is a stack of full-width cards, titled on their top edge', async ($, on) => {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  on('fs.stat', () => ({ value: { kind: 'other', size: 0, isLink: false, mtimeMs: 0 } }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'bench',
    component: 'Pane',
    requestId: 'bench',
    props: { title: '开发者工作台', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} },
    surface: 'terminal',
  } as never)

  for (const tab of ['tab-openspec', 'tab-conversation', 'tab-mcp', 'tab-sounds']) {
    await ui.press({ key: tab })

    const rows = (await ui.findAll({ type: 'Text' })).map(one => String((one as { text?: string }).text ?? '')).filter(one => one !== ' ')
    const cards = rows.filter(one => one.startsWith(ROUND.topLeft))

    // The tab's own page is at least one card, and every card closes.
    expect(cards.length).toBeGreaterThan(0)
    expect(rows.filter(one => one.startsWith(ROUND.bottomLeft)).length).toBe(cards.length)

    // The card's edges and its own plain lines are the card's width. A row drawn
    // by a Button or two Texts side by side is laid out by the engine, not here.
    for (const row of rows.filter(one => one.startsWith(ROUND.topLeft) || one.startsWith(ROUND.bottomLeft) || one.startsWith(ROUND.line))) {
      expect(cellsOf(row)).toBe(80)
    }
  }

  await ui.unmount()
})

test('a heading and its rows are drawn from one column table, left to left', () => {
  const cols = [
    { key: 'cur', width: 1 },
    { key: 'mark', width: 1 },
    { key: 'done', width: 6, head: '任务' },
    { key: 'age', width: 5, head: '时间' },
    { key: 'repo', width: 14, head: '仓库' },
    { key: 'name', head: '名称' },
  ]
  const inner = innerOf(96)
  const head = lineOf(cols, ['', '', '任务', '时间', '仓库', '名称'], inner)
  const row = lineOf(cols, ['▸', '*', '24/24', '2h', 'sales-platform', 'fix-sdf-signrowid-filter-case'], inner)
  const at = (text: string, word: string) => cellsOf(text.slice(0, text.indexOf(word)))

  // Every heading word starts on the same cell as the data under it.
  expect(at(head, '任务')).toBe(at(row, '24/24'))
  expect(at(head, '时间')).toBe(at(row, '2h'))
  expect(at(head, '仓库')).toBe(at(row, 'sales-platform'))
  expect(at(head, '名称')).toBe(at(row, 'fix-sdf'))
  // And every column reads from the left: no cell is pushed to its right edge.
  expect(cellsOf(head)).toBe(inner)
  expect(cellsOf(row)).toBe(inner)
})

test('width counts emoji and CJK as two cells, and selectors as none', () => {
  // A card edge one cell short is the right corner the engine drops.
  for (const one of ['📋', '🔀', '🕒', '🏷️', '⏱️', '中']) {
    expect(cellsOf(one)).toBe(2)
  }

  for (const one of ['a', '…', '├']) {
    expect(cellsOf(one)).toBe(1)
  }

  expect(cellsOf('⌨️')).toBeGreaterThanOrEqual(1)
})
