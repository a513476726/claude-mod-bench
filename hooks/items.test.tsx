import { expect, test } from 'claude-code/testing'

import type { Call, SoundSettings, SpecChange } from '../types'
import { DETAIL_BUDGET, drillItemsOf, itemsOf, takeRows } from './items'

const sounds: SoundSettings = { isOn: true, decision: true, done: true, error: true }

/** The budget is per page: it stops a long list before the tree outgrows the engine. */
test('takeRows stops at the serial budget and reports what was not shown', () => {
  const items = Array.from({ length: 1_000 }, (_, at) => `task-${at}-${'x'.repeat(200)}`)
  const taken = takeRows(items, one => [`  ${one}`], DETAIL_BUDGET)

  expect(taken.shown).toBeGreaterThan(0)
  expect(taken.shown).toBeLessThan(items.length)
  expect(taken.hidden).toBe(items.length - taken.shown)
  expect(taken.lines).toHaveLength(taken.shown)
})

test('takeRows keeps one overlong item and marks the cut', () => {
  const one = 'y'.repeat(200_000)
  const taken = takeRows([one], item => [item], DETAIL_BUDGET)

  expect(taken.shown).toBe(1)
  expect(taken.lines[0]).toContain('达到显示上限')
  expect(taken.lines[0]?.length ?? 0).toBeLessThanOrEqual(DETAIL_BUDGET.serial)
})

test('takeRows respects the row budget', () => {
  const items = Array.from({ length: 10 }, (_, at) => `t${at}`)
  const taken = takeRows(items, item => [item, `${item}b`], { serial: 1_000_000, rows: 5 })

  expect(taken.shown).toBe(2)
  expect(taken.lines).toHaveLength(4)
  expect(taken.hidden).toBe(8)
})

test('takeRows counts the rows a long line wraps into', () => {
  const items = Array.from({ length: 200 }, (_, at) => `task-${at}-${'x'.repeat(100)}`)
  const budget = { serial: 20_000, rows: 1_500 }
  const wide = takeRows(items, item => [item], budget, 200)
  const narrow = takeRows(items, item => [item], budget, 20)

  expect(wide.shown).toBeLessThan(items.length)
  expect(narrow.shown).toBeLessThan(wide.shown)
})

test('a change detail shows every open task, or says how many it left', () => {
  const open = Array.from({ length: 1_000 }, (_, at) => `任务-${at}-${'x'.repeat(200)}`)
  const change: SpecChange = {
    name: 'long-change',
    repo: 'repo',
    done: 0,
    total: 1_000,
    hasTasks: true,
    files: [],
    mtime: 1,
    isArchived: false,
    needNo: '',
    archivedOn: '',
    authors: [],
    open,
  }
  const detail = itemsOf('spec', { changes: [change], turns: [], calls: [], sounds })[0]?.detailLines ?? []

  expect(detail[0]).toBe('long-change')
  expect(detail).toContain('未完成 1000 项：')
  expect(detail.some(line => line.includes('未显示（达到显示上限）'))).toBe(true)
  // A task longer than the old 160-cell slice is still whole.
  expect(detail.some(line => line.includes('x'.repeat(200)))).toBe(true)
})

test('an MCP server lists every call, newest first, under its own name', () => {
  const calls: Call[] = Array.from({ length: 100 }, (_, at) => ({
    id: `c${at}`,
    tool: 'mcp__srv__tool',
    server: 'srv',
    name: 'tool',
    at,
    ms: 1,
    summary: 's',
    detail: 'x'.repeat(2_000),
    isOk: true,
    result: '',
  }))
  const drill = drillItemsOf('conversation', { changes: [], turns: [], calls, sounds }, ['mcp', 'srv'])

  expect(drill.title).toBe('srv · 100 次')
  expect(drill.items).toHaveLength(100)
  // Newest first: the last call made leads the list.
  expect(drill.items[0]?.id).toBe('mcp:srv:c99')
})
