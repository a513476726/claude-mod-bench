import { expect, mock, test } from 'claude-code/testing'

import { capMark, capText, cellsOf, wrapKeep, wrapName } from './format'
import { hintOf, listWindow } from './panes'
import { SP, STATUS_TAG, footerOf, lineOf, pageTitleOf, rowOf, ruleOf, tagOf, tagWidth, widthsOf } from './ui'

test('a rule and a flat row are exactly the page width', () => {
  for (const columns of [24, 40, 64, 80, 100, 137]) {
    expect(cellsOf(ruleOf(columns))).toBe(columns)
    expect(cellsOf(rowOf('', columns))).toBe(columns)
    expect(cellsOf(rowOf('  ▸ 进行  38/40  00d  bench  一个很长的名称', columns))).toBe(columns)
    expect(cellsOf(rowOf('一列数据数据 data', columns))).toBe(columns)
  }
})

test('the status table has one word and one colour per state', () => {
  expect(STATUS_TAG.doing).toMatchObject({ full: '进行中', short: '进行', mini: '进', tone: 'claude' })
  expect(STATUS_TAG.ready).toMatchObject({ full: '待归档', short: '待办', mini: '待', tone: 'warning' })
  expect(STATUS_TAG.broken).toMatchObject({ full: '归档异常', short: '异常', mini: '异', tone: 'error' })
  expect(STATUS_TAG.archived).toMatchObject({ full: '已归档', short: '完成', mini: '完', tone: 'success' })
  expect(STATUS_TAG.bare).toMatchObject({ full: '无任务清单', short: '无单', mini: '无', tone: 'subtle' })
})

test('the status column is five cells at normal widths and two at narrow ones', () => {
  expect(tagWidth(80)).toBe(5)
  expect(tagWidth(48)).toBe(5)
  expect(tagWidth(47)).toBe(2)
  expect(tagWidth(24)).toBe(2)
  expect(tagOf('doing', 80)).toBe('进行')
  expect(tagOf('doing', 40)).toBe('进')
  expect(tagOf('archived', 80)).toBe('完成')
  expect(tagOf('archived', 24)).toBe('完')
})

test('the footer keeps the right hint on the right edge', () => {
  for (const columns of [24, 40, 80]) {
    const line = footerOf('14/14 项 · 点行看详情', '1–5 页签 · 点状态筛选', columns)

    expect(cellsOf(line)).toBe(columns)
    if (columns >= 48) {
      expect(line).toContain('点状态筛选')
    }
  }

  expect(footerOf('4/4 项', '', 80)).toBe('4/4 项')
  // A left side too long for the page loses the right hint and is cut to the width.
  const long = footerOf('一'.repeat(80), '1–5', 80)
  expect(cellsOf(long)).toBe(80)
  expect(long).toContain('…')
})

test('a page title keeps every character and leaves the back room on its first row', () => {
  for (const title of [
    'detail-page-scroll-and-full-text',
    '一个很长很长的标题需要按宽度换行展示，不能截断',
    'fix-signmanager-full-down-payment-20260920-and-then-some-more',
  ]) {
    for (const columns of [24, 40, 80]) {
      const lines = pageTitleOf(title, columns)
      const room = columns - SP.inline - 10

      expect(lines.join('')).toBe(title)
      expect(cellsOf(lines[0] ?? '')).toBeLessThanOrEqual(room)
      for (const line of lines) {
        expect(cellsOf(line)).toBeLessThanOrEqual(room)
      }
    }
  }
})

test('wrapName breaks at hyphens before it breaks a word', () => {
  const name = 'detail-page-scroll-and-full-text'
  const lines = wrapName(name, 20)

  expect(lines.join('')).toBe(name)
  for (const line of lines) {
    expect(cellsOf(line)).toBeLessThanOrEqual(20)
  }
  expect(lines[0]).toEndWith('-')
  // A name with no hyphen still wraps, by display width.
  const plain = wrapName('一个没有连字符的很长标题', 10)

  expect(plain.length).toBeGreaterThan(1)
  expect(plain.join('')).toBe('一个没有连字符的很长标题')
})

test('a list shares one set of columns and one fill column at the end', () => {
  const cols = [
    { key: 'cur', width: 2 },
    { key: 'tag', width: 5 },
    { key: 'done', width: 6 },
    { key: 'age', width: 5 },
    { key: 'repo', width: 14 },
    { key: 'name' },
  ]
  const inner = 80 - SP.inline
  const widths = widthsOf(cols, inner)

  expect(widths[5]).toBe(inner - 2 - 5 - 6 - 5 - 14 - SP.group * 5)
  expect(widths.reduce((sum, one) => sum + one, 0) + SP.group * (cols.length - 1)).toBe(inner)

  const head = lineOf(cols, ['', '状态', '任务', '时间', '仓库', '名称'], inner)
  const row = lineOf(cols, ['▸', '进行', '38/40', '00d', 'sales-platform', 'detail-page-scroll-and-full-text'], inner)
  const at = (text: string, word: string) => cellsOf(text.slice(0, text.indexOf(word)))

  expect(at(head, '任务')).toBe(at(row, '38/40'))
  expect(at(head, '时间')).toBe(at(row, '00d'))
  expect(at(head, '仓库')).toBe(at(row, 'sales-platform'))
  expect(at(head, '名称')).toBe(at(row, 'detail-page'))
  expect(cellsOf(head)).toBe(inner)
  expect(cellsOf(row)).toBe(inner)
})

test('a column that does not fit is cut, not pushed into the next', () => {
  const cols = [
    { key: 'cur', width: 2 },
    { key: 'tag', width: 5 },
    { key: 'done', width: 6 },
    { key: 'repo', width: 14 },
    { key: 'name' },
  ]
  const inner = 64 - SP.inline
  const row = lineOf(cols, ['▸', '异常', '2/7', 'a-very-long-repository-name-that-will-not-fit', 'fix-openspec-scan'], inner)

  expect(cellsOf(row)).toBe(inner)
  expect(row).toContain('fix-openspec-scan')
  expect(row).toContain('a-very-long-r…')
})

test('a page is flat: rules are full width and no card edge remains', async ($, on) => {
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
    expect(rows.some(one => one.startsWith('╭') || one.startsWith('╰'))).toBe(false)

    const rules = rows.filter(one => one.startsWith('─'))
    expect(rules.length).toBeGreaterThan(0)

    for (const rule of rules) {
      expect(cellsOf(rule)).toBe(80)
    }
  }

  await ui.unmount()
})

test('width counts emoji and CJK as two cells, and selectors as none', () => {
  for (const one of ['📋', '🔀', '🕒', '🏷️', '⏱️', '中']) {
    expect(cellsOf(one)).toBe(2)
  }

  for (const one of ['a', '…', '├']) {
    expect(cellsOf(one)).toBe(1)
  }
})

test('a stored value stops at its cap and says why', () => {
  const mark = capMark(50)
  const cut = capText('x'.repeat(100), 50, mark)

  expect(cut).toHaveLength(50)
  expect(cut).toContain(mark)
  expect(capText('short', 50, mark)).toBe('short')
  expect(capMark(20_000)).toBe('…（已达存储上限 20,000 字）')
  expect(capMark(2_000)).toBe('…（已达存储上限 2,000 字）')
})

test('a list window leaves a row for the notice, and never slices negative', () => {
  expect(listWindow(20, 8, 1)).toEqual({ shown: 2, hidden: 18 })
  expect(listWindow(2, 8, 1)).toEqual({ shown: 2, hidden: 0 })
  expect(listWindow(20, 8, 5)).toEqual({ shown: 20, hidden: 0 })
  expect(listWindow(1_000, 8, 5)).toEqual({ shown: 200, hidden: 800 })
})

test('the position hint compacts to the width and clamps N', () => {
  expect(hintOf(9, 10, 100, 80)).toBe('第 10/100 行 · ↑↓ 滚动')
  expect(hintOf(9, 10, 100, 30)).toBe('10/100 · ↑↓ 滚动')
  expect(hintOf(9, 10, 100, 24)).toBe('10/100')
  expect(hintOf(9, 10, 0, 80)).toBe('↑↓ 滚动 · 第 10 行')
  expect(hintOf(99, 10, 100, 80)).toBe('第 100/100 行 · ↑↓ 滚动')
})

test('wrapKeep keeps every character and the leading whitespace', () => {
  const long = 'x'.repeat(200)
  const lines = wrapKeep(long, 80, 0)

  expect(lines.length).toBeGreaterThan(1)
  expect(lines.join('')).toBe(long)

  for (const line of lines) {
    expect(cellsOf(line)).toBeLessThanOrEqual(80)
  }

  const code = '    const value = 1'
  const kept = wrapKeep(code, 12, 0)

  expect(kept[0]).toStartWith('    ')
  expect(kept.join('')).toBe(code)

  const indented = `    ${'x'.repeat(100)}`
  const indentedRows = wrapKeep(indented, 20, 0)

  expect(indentedRows[0]).toStartWith('    x')
  expect(indentedRows.join('')).toBe(indented)

  const title = '一个很长很长的标题需要按宽度换行展示'
  const titleLines = wrapKeep(title, 10, 2)

  expect(titleLines.length).toBeGreaterThan(1)

  for (const line of titleLines.slice(1)) {
    expect(line).toStartWith('  ')
  }
})
