import { expect, test } from 'claude-code/testing'

import type { SpecChange } from '../types'
import { NO_FILTER, filterOf } from './items'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-06T15:00:00').getTime()

const one = (repo: string, mtime: number): SpecChange => ({
  name: `${repo}-one`,
  repo,
  done: 0,
  total: 1,
  hasTasks: true,
  files: [],
  mtime,
  isArchived: false,
  needNo: '',
  authors: [],
  open: [],
  archivedOn: '',
})

const CHANGES = [
  one('a', NOW - 60 * 60 * 1000), // an hour ago
  one('b', NOW - 3 * DAY), // three days ago
  one('a', NOW - 20 * DAY), // twenty days ago
  one('c', NOW - 90 * DAY), // three months ago
]

test('nothing narrowed keeps every change', () => {
  expect(filterOf(CHANGES, NO_FILTER, NOW)).toHaveLength(4)
})

test('one repo keeps only that repo', () => {
  const kept = filterOf(CHANGES, { repo: 'a', since: 'all' }, NOW)

  expect(kept.map(change => change.mtime)).toEqual([CHANGES[0]?.mtime, CHANGES[2]?.mtime])
})

test('today is the day the clock is on, not the last 24 hours', () => {
  // 00:30 this morning is "today" at 15:00, and so is 14:59.
  const early = new Date('2026-11-06T00:30:00').getTime()
  const late = new Date('2026-11-06T14:59:00').getTime()
  const lastNight = new Date('2026-11-05T23:59:00').getTime()

  expect(filterOf([one('x', early), one('x', late), one('x', lastNight)], { repo: 'all', since: 'today' }, NOW)).toHaveLength(2)
})

test('a week reaches back seven days and no further', () => {
  const kept = filterOf(CHANGES, { repo: 'all', since: '7d' }, NOW)

  expect(kept).toHaveLength(2)
})

test('a month reaches back thirty days', () => {
  expect(filterOf(CHANGES, { repo: 'all', since: '30d' }, NOW)).toHaveLength(3)
})

test('repo and age narrow together', () => {
  expect(filterOf(CHANGES, { repo: 'a', since: '7d' }, NOW)).toHaveLength(1)
  expect(filterOf(CHANGES, { repo: 'c', since: '7d' }, NOW)).toHaveLength(0)
})
